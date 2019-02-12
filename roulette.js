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
        return await eos.getTableRows({
            json: true,
            code: 'eosio.token',
            scope: window.roulette.account.name,
            table: 'accounts',
            limit: 10,
        });
    }

    // Get the currently running spin with the smallest maxbettime.
    async function getSpin(){
        return (await eos.getTableRows({
            json: true,
            code: 'roulette',
            scope: 'roulette',
            table: 'spins',
            index_position: 3,
            key_type: 'i64',
            lower_bound: Math.round(new Date() / 1000) + 10,
            limit: 1,
        })).rows[0];
    }

    // Bet on an existing spin.
    async function bet(seedhash, coverage, larimers, salt){
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
                    seedhash: seedhash,
                    coverage: coverage,
                    larimers: larimers,
                    salt: salt,
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
        poll: async function(spin, after, callback){
            let actions = (await eos.getActions(window.roulette.account.name, after, 1)).actions;
            if(actions.length === 2){
                let action = actions[1].action_trace.act;
                if(action.name === 'notify' && action.data.seedhash === spin.seedhash){
                    callback(action.data);
                }
                after = actions[1].account_action_seq;
            }
            setTimeout(function(){window.roulette.poll(spin, after, callback);}, 1000);
        },
        autoBet: async function(coverage, larimers, callback){
            let spin = await getSpin();
            if(! spin){
                console.error('no spin found');
                return false;
            }
            window.roulette.poll(
                spin, (await eos.getActions(window.roulette.account.name, -1, -1)).actions[0].account_action_seq, callback
            );
            return await bet(spin.seedhash, coverage, parseInt(larimers, 10), +new Date());
        }
    };
}());
