// jshint esversion: 8
(function(){
    'use strict';

    const privateKey = '5J8jB9ErRQP1yuiPEDTfseoSC6DMYZrXSZDkn2Ehw3Mje2rA3Z4';
    const rpc = new eosjs_jsonrpc.default('http://127.0.0.1:8888');
    const signatureProvider = new eosjs_jssig.default([privateKey]);
    const api = new eosjs_api.default({rpc, signatureProvider});

    function getBalance(success, failure){
        (async() => {
            try{
                const result = await rpc.get_table_rows({
                    json: true,
                    code: 'eosio.token',
                    scope: 'alice',
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

    function bet(towin, larimers, seed, success, failure){
        (async() => {
            let result;
            try{
                result = await api.transact({
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

                result = await api.transact({
                    actions: [{
                        account: 'roulette',
                        name: 'spin',
                        authorization: [{
                            actor: 'roulette',
                            permission: 'owner',
                        }],
                        data: {
                            seed_hash: 888,
                            min_bet_time: 0,
                            max_bet_time: Math.round(new Date().getTime() / 1000) + 2,
                        },
                    }]
                }, {
                    blocksBehind: 3,
                    expireSeconds: 30,
                });

                result = await api.transact({
                    actions: [{
                        account: 'roulette',
                        name: 'bet',
                        authorization: [{
                            actor: 'alice',
                            permission: 'owner',
                        }],
                        data: {
                            user: 'alice',
                            spinseedhash: 888,
                            towin: towin,
                            larimers: larimers,
                            seed: 1,
                        },
                    }]
                }, {
                    blocksBehind: 3,
                    expireSeconds: 30,
                });

                await function sleep(ms){
                    return new Promise(resolve => setTimeout(resolve, ms));
                }(2000);

                result = await api.transact({
                    actions: [{
                        account: 'roulette',
                        name: 'pay',
                        authorization: [{
                            actor: 'roulette',
                            permission: 'owner',
                        }],
                        data: {
                            spinseed: 888,
                        },
                    }]
                }, {
                    blocksBehind: 3,
                    expireSeconds: 30,
                });

                success(result);
            }catch(e){
                failure(e.json);
            }
        })();
    }
    window.bet = bet;
}());
