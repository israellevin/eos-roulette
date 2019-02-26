// jshint esversion: 8
(function(){
    'use strict';
    window.galgal = {
        chainid: 'mock',
        account: {name: 'alice'},
        login: function(success){return success(window.galgal.account);},
        logout: function(success){return success();},
        _balance: 1000.0,
        getBalance: function(){return {rows: [{balance: window.galgal._balance + ' EOS'}]};},
        getSpin: function(){return {
            id: 0, hash: "0000000000000000000000000000000000000000000000000000000000000000",
            mintarvuttime: 0, maxtarvuttime: 9999999999};
        },
        tarvut: function(hash, towin, larimers){
            window.galgal._balance -= parseInt(larimers, 10);
            return {processed: {action_traces: [{act: 'mock'}]}};
        },
        poll: function(towin, larimers, callback, force){
            setTimeout(function(){
                let winner = typeof(force) === 'undefined' ? 0 : force;
                if(parseInt(towin, 10) === winner) window.galgal._balance += 36 * larimers;
                callback({winner: winner, mock: true});
            }, 1000);
        },
        autoTarvut: function(towin, larimers, callback, force){
            window.galgal.poll(towin, larimers, callback, force);
            return window.galgal.tarvut(0, towin, larimers);
        }
    };
}());
