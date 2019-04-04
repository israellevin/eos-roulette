// jshint esversion: 8
(function(){
    'use strict';

    // Remove scatter from main scope.
    const SCATTERJS = ScatterJS;
    window.ScatterJS = null;

    // Initialize.
    SCATTERJS.plugins(new ScatterEOS());
    // DO NOT CHANGE THIS NAME, SCATTER DOES NOT REACT WELL TO OTHER NAMES.
    const network = SCATTERJS.Network.fromJson({
        blockchain: 'eos',
        chainId: roulette.chainid,
        host: '127.0.0.1',
        port: 8888,
        protocol: 'http'
    });
    const RPC = new eosjs_jsonrpc.default(network.protocol + '://' + network.host + ':' + network.port);
    const SCATTER = SCATTERJS.eos(network, Eos, {RPC, beta3:true});

    // Login to scatter.
    function login(success){
        SCATTERJS.connect('roulette', {network}).then(connected => {
            if(!connected) {
                console.error('could not connect to scatter');
                return false;
            }
            console.info('connected to scatter');
            SCATTERJS.scatter.login().then(function(){
                console.info('logged in to scatter');
                window.roulette.scatter.account_name = SCATTERJS.account('eos').name;
                success(window.roulette.scatter.account_name);
            }).catch(error => {
                console.error('scatter login failed', error);
            });
        });
    }

    // Logout of scatter.
    function logout(success){
        SCATTERJS.scatter.logout().then(function(){
            window.roulette.scatter.account_name = null;
            success();
        });
    }

    // Bet on an existing spin.
    async function bet(hash, coverage, larimers, salt){
        return new Promise(function(resolve, reject){
            SCATTER.transaction(
                {actions: [{
                    account: 'roulette',
                    name: 'bet',
                    authorization: [{
                        actor: window.roulette.scatter.account_name,
                        permission: 'active',
                    }],
                    data: {
                        user: window.roulette.scatter.account_name,
                        hash: hash,
                        coverage: coverage,
                        larimers: larimers,
                        salt: salt,
                    },
                }]}, {
                    blocksBehind: 3,
                    expireSeconds: 30,
                }
            ).then(resolve).catch(reject);
        });
    }

    // Expose some functionality.
    window.roulette.scatter = {
        account_name: null,
        bet: bet,
        login: login,
        logout: logout,
    };

}());
