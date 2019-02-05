// jshint esversion: 8
(function(){
    'use strict';

    const privateKey = '5J8jB9ErRQP1yuiPEDTfseoSC6DMYZrXSZDkn2Ehw3Mje2rA3Z4';
    const rpc = new eosjs_jsonrpc.default('http://127.0.0.1:8888');

    // Get a user's balance.
    function getBalance(user, success, failure){
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
                failure(e.json);
            }
        })();
    }
    window.getBalance = getBalance;

    const signatureProvider = new eosjs_jssig.default([privateKey]);
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

    window.bet = function(towin, larimers, seed, success, failure){
        (async() => {
            try{
                console.log('del', await deleteall());
                console.log('spn', await spin(888, 0, Math.round(new Date().getTime() / 1000) + 2));
                console.log('bet', await bet(888, towin, larimers, seed));

                alert('wheel is spinning');
                await function sleep(ms){
                    return new Promise(resolve => setTimeout(resolve, ms));
                }(3000);

                let payresult = await pay(888);
                console.log('pay', payresult);
                success(payresult.processed.action_traces[0].console);
            }catch(e){
                failure(e.json);
            }
        })();
    };
}());
