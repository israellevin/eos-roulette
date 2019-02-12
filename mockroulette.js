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
        poll: function(towin, larimers, callback){
            if(parseInt(towin, 10) === 0) window.roulette._balance += 37 * larimers;
            setTimeout(function(){callback({winner: 0, mock: true});}, 1000);
        },
        autoBet: function(towin, larimers, callback){
            window.roulette.poll(towin, larimers, callback);
            return window.roulette.bet(0, towin, larimers);
        }
    };
}());
