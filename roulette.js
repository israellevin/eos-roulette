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
            scatterjs.scatter.login().then(async function(){
                window.roulette.scatterAccount = scatterjs.account('eos').name;
                success(window.roulette.scatterAccount);
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

    // Get current user's account.
    async function getAccount(){
        window.roulette.account = await eos.getAccount(window.roulette.scatterAccount);
        return window.roulette.account;
    }

    // Get current user's balance.
    async function getBalance(){
        return await eos.getTableRows({
            json: true,
            code: 'eosio.token',
            scope: window.roulette.scatterAccount,
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

    // Get a spin's bets.
    // FIXME Do this with secondary index, there has to be a way!
    async function getBets(seedhash){
        return Array.prototype.filter.call((await eos.getTableRows({
            json: true,
            code: 'roulette',
            scope: 'roulette',
            table: 'bets',
            limit: 9999,
        })).rows, function(row){
            return row.seedhash === seedhash;
        });
    }

    // Bet on an existing spin.
    async function bet(hash, coverage, larimers, salt){
        try{
            return await eos.transaction({
                actions: [{
                    account: 'roulette',
                    name: 'bet',
                    authorization: [{
                        actor: window.roulette.scatterAccount,
                        permission: 'active',
                    }],
                    data: {
                        user: window.roulette.scatterAccount,
                        hash: hash,
                        coverage: coverage,
                        larimers: larimers,
                        salt: salt,
                    },
                }]
            }, {
                blocksBehind: 3,
                expireSeconds: 30,
            });
        }catch(e){
            console.error(e);
            return false;
        }
    }

    window.roulette = {
        chainid: window.roulette.chainid,
        login: login,
        logout: logout,
        getAccount: getAccount,
        getBalance: getBalance,
        getSpin: getSpin,
        getBets: getBets,
        bet: bet,
        poll: async function(spin, after, callback){
            let actions = (await eos.getActions(window.roulette.scatterAccount, after, 1)).actions;
            if(actions.length === 2){
                let action = actions[1].action_trace.act;
                if(
                    action.account === 'roulette' &&
                    action.name === 'notify' &&
                    action.data.hash === spin.hash
                ){
                    return callback(action.data);
                }
                after = actions[1].account_action_seq;
            }
            setTimeout(function(){window.roulette.poll(spin, after, callback);}, 1000);
        },
        autoBet: async function(coverage, larimers, callback){
            if(! window.roulette.account){
                console.error('not connected to scatter');
                return false;
            }
            let spin = await getSpin();
            if(! spin){
                console.error('no spin found');
                return false;
            }
            window.roulette.poll(
                spin, (await eos.getActions(window.roulette.scatterAccount, -1, -1)).actions[0].account_action_seq, callback
            );
            try{
                return (await bet(
                    spin.hash, coverage, parseInt(larimers, 10), +new Date()
                )).processed.action_traces[0].act.data.hash;
            }catch(e){
                console.error(e);
                return e;
            }
        }
    };
}());
