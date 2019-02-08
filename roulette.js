// jshint esversion: 8
(function(){
    'use strict';

    const scatterjs = ScatterJS;
    window.ScatterJS = null;
    scatterjs.plugins(new ScatterEOS());

    const network = scatterjs.Network.fromJson({
        blockchain: 'eos',
        chainId: window.roulette.chainid,
        host: '127.0.0.1',
        port: 8888,
        protocol: 'http'
    });

    const rpc = new eosjs_jsonrpc.default(network.protocol + '://' + network.host + ':' + network.port);
    const eos = scatterjs.eos(network, Eos, {rpc, beta3:true});
    window.stam = eos;

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

    // Logout of scatter.
    function logout(success){
        scatterjs.scatter.logout().then(function(){
            delete window.roulette.account;
            success();
        });
    }

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

    // Get the currently running spin with the smallest maxbettime.
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

    // Bet on an existing spin.
    async function bet(spinseedhash, towin, larimers, seed){
        if(! window.roulette.account){
            console.error('not logged in');
        }
        return await eos.transaction({
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

    window.roulette = {
        chainid: window.roulette.chainid,
        login: login,
        logout: logout,
        getBalance: getBalance,
        getSpin: getSpin,
        bet: bet,
        autoBet: async function(towin, larimers){
            let spin = await getSpin();
            if(! spin){
                console.error('no spin found');
                return;
            }
            return await bet(spin.seed_hash, parseInt(towin, 10), parseInt(larimers, 10), +new Date());
        }
    };
}());
