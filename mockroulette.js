// jshint esversion: 8
(function(){
    'use strict';
    window.roulette = {
        chainid: 'mock',
        account: {name: 'alice'},
        login: function(success){return success(window.roulette.account);},
        logout: function(success){return success();},
        _balance: 1000.0,
        getBalance: function(){return {rows: [{balance: window.roulette._balance + ' EOS'}]};},
        getSpin: function(){return {
            id: 0, seedhash: "0000000000000000000000000000000000000000000000000000000000000000",
            minbettime: 0, maxbettime: 9999999999};
        },
        bet: function(seedhash, towin, larimers){
            window.roulette._balance -= parseInt(larimers, 10);
            return {processed: {action_traces: [{act: 'mock'}]}};
        },
        poll: function(towin, larimers, callback, force){
            setTimeout(function(){
                let winner = typeof(force) === 'undefined' ? 0 : force;
                if(parseInt(towin, 10) === winner) window.roulette._balance += 36 * larimers;
                callback({winner: winner, mock: true});
            }, 1000);
        },
        autoBet: function(towin, larimers, callback, force){
            window.roulette.poll(towin, larimers, callback, force);
            return window.roulette.bet(0, towin, larimers);
        }
    };
}());
