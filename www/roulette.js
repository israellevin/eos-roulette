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
    const SOCKET = io.connect(location.protocol + '//' + document.domain + ':' + location.port);
    SOCKET.on('disconnect', function(){
        console.error('socket disconnected');
    });

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
                roulette.account_name = SCATTERJS.account('eos').name;
                success(roulette.account_name);
                let interval = setInterval(function() {SOCKET.emit('heartbeat', roulette.account_name);}, 1000);
            }).catch(error => {
                console.error('scatter login failed', error);
            });
        });
    }

    // Logout of scatter.
    function logout(success){
        SCATTERJS.scatter.logout().then(function(){
            roulette.account_name = null;
            success();
        });
    }

    // Await reply on socket.
    async function emit(call, data, call_back){
        return new Promise(function(resolve){
            SOCKET.once(call_back || call, function(data){
                resolve(data);
            });
            SOCKET.emit(call, data);
        });
    }

    // Get current user's balance.
    async function getBalance(){
        return await emit('get_balance', roulette.account_name, 'get_balance');
    }

    // Get the currently running spin with the smallest maxbettime larget than minMaxbettime.
    async function selectSpin(minMaxbettime){
        return await emit('get_spin', minMaxbettime);
    }

    // Get a spin's bets.
    async function getBets(hash){
        return await emit('get_bets', hash);
    }

    // Register to listen on a spin.
    async function monitorSpin(spin){
        return await emit('monitor_spin', {spin_hash: spin.hash, user: roulette.account_name}, 'bettor_joined');
    }

    // Wait for winning number.
    async function getWinningNumber(spin){
        return await emit('monitor_spin', {spin_hash: spin.hash, user: roulette.account_name}, 'winning_number');
    }

    // Bet on an existing spin.
    async function bet(hash, coverage, larimers, salt){
        return new Promise(function(resolve, reject){
            SCATTER.transaction(
                {actions: [{
                    account: 'roulette',
                    name: 'bet',
                    authorization: [{
                        actor: roulette.account_name,
                        permission: 'active',
                    }],
                    data: {
                        user: roulette.account_name,
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
    window.roulette = {
        chainid: roulette.chainid,
        account_name: null,
        login: login,
        logout: logout,
        getBalance: getBalance,
        selectSpin: selectSpin,
        getBets: getBets,
        monitorSpin: monitorSpin,
        getWinningNumber: getWinningNumber,
        bet: bet
    };

}());
