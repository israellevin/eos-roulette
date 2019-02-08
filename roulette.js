// jshint esversion: 8
(function(){
    'use strict';

    const scatterjs = ScatterJS;
    window.ScatterJS = null;
    scatterjs.plugins(new ScatterEOS());

    // FIXME Set this in deploy.
    const network = scatterjs.Network.fromJson({
        blockchain:'eos',
        chainId:'cf057bbfb72640471fd910bcb67639c22df9f92470936cddc1ade0e2f2e7dc4f',
        host:'127.0.0.1',
        port:8888,
        protocol:'http'
    });
    const rpc = new eosjs_jsonrpc.default(network.protocol + '://' + network.host + ':' + network.port);
    const eos = scatterjs.eos(network, Eos, {rpc, beta3:true});

    // FIXME Hard coded permission to act as roulette account - soon to be removed.
    const privkey = window.roulette.privkey;
    const signatureProvider = new eosjs_jssig.default([privkey]);
    const api = new eosjs_api.default({rpc, signatureProvider});

    window.roulette = {};

    // Login to scatter.
    function login(success){
        scatterjs.connect('roulette', {network}).then(connected => {
            if(!connected) return false;
            scatterjs.scatter.login().then(function(){
                window.roulette.account = scatterjs.account('eos');
                success(window.roulette.account);
            });
        });
    }
    window.roulette.login = login;

    // Logout of scatter.
    function logout(success){
        scatterjs.scatter.logout().then(function(){
            delete window.roulette.account;
            success();
        });
    }
    window.roulette.logout = logout;

    // Get current user's balance.
    async function getBalance(){
        const result = await eos.getTableRows({
            json: true,
            code: 'eosio.token',
            scope: window.roulette.account.name,
            table: 'accounts',
            limit: 10,
        });
        return result;
    }
    window.roulette.getBalance = getBalance;

    // Get running spins TODO sorted by maxbettime.
    async function getSpin(){
        const result = await eos.getTableRows({
            json: true,
            code: 'roulette',
            scope: 'roulette',
            table: 'spins',
            index_position: 2,
            key_type: 'i64',
            lower_bound: Math.round(new Date() / 1000),
            limit: 1,
        });
        return result.rows[0];
    }
    window.roulette.getSpin = getSpin;

    // Bet on an existing spin.
    async function bet(spinseedhash, towin, larimers, seed){
        if(! window.roulette.account){
            return failure('not logged in');
        }
        return await api.transact({
            actions: [{
                account: 'roulette',
                name: 'bet',
                authorization: [{
                    actor: window.roulette.account.name,
                    permission: 'active',
                }],
                data: {
                    user: window.roulette.account.name,
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
    window.roulette.bet = bet;

    // FIXME Admin actionas for debug - soon to be removed.

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

    async function spin(seed_hash, minbettime, maxbettime){
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
                    minbettime: minbettime,
                    maxbettime: maxbettime,
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
                success(parseInt(payresult.processed.action_traces[0].console.slice(-2), 10));
            }catch(e){
                console.error(e.json);
                failure(e);
            }
        })();
    };
}());
