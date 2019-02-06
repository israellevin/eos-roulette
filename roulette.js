// jshint esversion: 8
(function(){
    'use strict';

    const privkey = window.roulette.privkey;
    console.log(privkey);
    const rpc = new eosjs_jsonrpc.default('http://127.0.0.1:8888');
    window.roulette = {};

    // Get a user's balance.
    function getBalance(user, success){
        (async() => {
            try{
                const result = await rpc.get_table_rows({
                    json: true,
                    code: 'eosio.token',
                    scope: user,
                    table: 'accounts',
                    limit: 10,
                });
                success(result);
            }catch(e){
                console.error(e.json);
            }
        })();
    }
    window.roulette.getBalance = getBalance;

    const signatureProvider = new eosjs_jssig.default([privkey]);
    const api = new eosjs_api.default({rpc, signatureProvider});

    async function deleteall(){
        return await api.transact({
            actions: [{
                account: 'roulette',
                name: 'deleteall',
                authorization: [{
                    actor: 'roulette',
                    permission: 'owner',
                }],
                data: {},
            }]
        }, {
            blocksBehind: 3,
            expireSeconds: 30,
        });
    }

    async function spin(seed_hash, min_bet_time, max_bet_time){
        return await api.transact({
            actions: [{
                account: 'roulette',
                name: 'spin',
                authorization: [{
                    actor: 'roulette',
                    permission: 'owner',
                }],
                data: {
                    seed_hash: seed_hash,
                    min_bet_time: min_bet_time,
                    max_bet_time: max_bet_time,
                },
            }]
        }, {
            blocksBehind: 3,
            expireSeconds: 30,
        });
    }

    async function bet(spinseedhash, towin, larimers, seed){
        return await api.transact({
            actions: [{
                account: 'roulette',
                name: 'bet',
                authorization: [{
                    actor: 'alice',
                    permission: 'owner',
                }],
                data: {
                    user: 'alice',
                    spinseedhash: spinseedhash,
                    towin: towin,
                    larimers: larimers,
                    seed: seed,
                },
            }]
        }, {
            blocksBehind: 3,
            expireSeconds: 30,
        });
    }

    async function pay(spinseed){
        return await api.transact({
            actions: [{
                account: 'roulette',
                name: 'pay',
                authorization: [{
                    actor: 'roulette',
                    permission: 'owner',
                }],
                data: {
                    spinseed: spinseed,
                },
            }]
        }, {
            blocksBehind: 3,
            expireSeconds: 30,
        });
    }

    window.roulette.bet = function(towin, larimers, success, failure){
        (async() => {
            try{
                const runtime = +new Date();
                console.log('del', await deleteall());
                console.log('spn', await spin(runtime, 0, Math.round(runtime / 1000) + 2));
                console.log('bet', await bet(runtime, towin, larimers, runtime));

                await function sleep(ms){
                    return new Promise(resolve => setTimeout(resolve, ms));
                }(3000);

                let payresult = await pay(runtime);
                console.log('pay', payresult);
                success(payresult.processed.action_traces[0].console);
            }catch(e){
                console.error(e.json);
                failure(e);
            }
        })();
    };
}());
