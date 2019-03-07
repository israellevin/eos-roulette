// jshint esversion: 8
(function(){
    'use strict';

    // Remove scatter from main scope.
    const SCATTERJS = ScatterJS;
    window.ScatterJS = null;

    // Initialize.
    SCATTERJS.plugins(new ScatterEOS());
    const NETWORK = SCATTERJS.Network.fromJson({
        blockchain: 'eos',
        chainId: roulette.chainid,
        host: '127.0.0.1',
        port: 8888,
        protocol: 'http'
    });
    const RPC = new eosjs_jsonrpc.default(NETWORK.protocol + '://' + NETWORK.host + ':' + NETWORK.port);
    const SCATTER = SCATTERJS.eos(NETWORK, Eos, {RPC, beta3:true});
    const SOCKET = io.connect(location.protocol + '//' + document.domain + ':' + location.port);

    // Send heartbeat while connected.
    SOCKET.on('connect', function(){
        setInterval(function() {SOCKET.emit('heartbeat', roulette.account_name)}, 1000);
    });

    // Report disconnections.
    SOCKET.on('disconnect', function(){
        console.error('socket disconnected');
    });

    // Login to scatter.
    function login(success){
        SCATTERJS.connect('roulette', {NETWORK}).then(connected => {
            if(!connected) return false;
            SCATTERJS.scatter.login().then(async function(){
                roulette.account_name = SCATTERJS.account('eos').name;
                success(roulette.account_name);
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
    async function emit(call, data){
        return new Promise(function(resolve){
            SOCKET.on(call, function(data){
                resolve(data);
            });
            SOCKET.emit(call, data)
        });
    }

    // Get current user's balance.
    async function getBalance(){
        return await emit('getBalance', roulette.account_name);
    }

    // Get the currently running spin with the smallest maxbettime larget than minMaxbettime.
    async function getSpin(minMaxbettime){
        return await emit('getSpin', minMaxbettime);
    }

    // Get a spin's bets.
    async function getBets(hash){
        return await emit('getBets', hash);
    }

    // Poll user actions to get notifications.
    // FIXME This will probably not work without history plugin.
    async function poll(spin, after, callback){
        if(after < 0){
            after = (await SCATTER.getActions('roulette', -1, -1)).actions[0].account_action_seq;
        }
        let actions = (await SCATTER.getActions('roulette', after, 100)).actions;
        if(actions.length > 0){
            actions.forEach(function(action){
                action = action.action_trace.act;
                if(
                    action.account === 'roulette' &&
                    action.name === 'publish' &&
                    action.data.hash === spin.hash
                ){
                    return callback(action.data);
                }
            });
            after = after + actions.length;
        }
        setTimeout(function(){roulette.poll(spin, after, callback);}, 1000);
    }

    // Bet on an existing spin.
    async function bet(hash, coverage, larimers, salt){
        try{
            return await SCATTER.transaction({
                actions: [{
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

    // Expose some functionality.
    window.roulette = {
        chainid: roulette.chainid,
        account_name: null,
        login: login,
        logout: logout,
        getBalance: getBalance,
        getSpin: getSpin,
        getBets: getBets,
        poll: poll,
        bet: bet
    };

}());
