// jshint esversion: 8
(function(){
    'use strict';

    // Login to roulette.
    roulette.login(function(accountName){

        // Balance updater.
        (async function updateBalance(){
            if(accountName){
                document.getElementById('user').innerText = accountName;
            }
            document.getElementById('balance').innerText = (await roulette.getBalance()).rows[0].balance;
            setTimeout(updateBalance, 1000);
        })();

        // user stats updater. TODO currently just shows used cpu (-1 on local) - expand...
        (async function updateStats(){
            let cpu = (await roulette.getAccount()).cpu_limit;
            document.getElementById('cpu').innerText = cpu.used;
            setTimeout(updateStats, 1000);
        })();
    });

    // Place a bet.
    window.processBet = async function(layoutForm){
        let coverage, larimers;
        try{
            coverage = Array.prototype.map.call(layoutForm.coverage.selectedOptions, function(option){
                return parseInt(option.value, 10);
            });
            larimers = parseInt(layoutForm.larimers.value, 10);
            if(36 % coverage.length !== 0){throw 'coverage size must divide 36';}
        }catch(e){
            console.error(e);
            return false;
        }

        document.getElementById('spinBtn').disabled = true;
        document.getElementById('wheel').innerText = 'Roulette is spinning... ' + roulette.account.account_name + ' placed ' + larimers + ' larimers on ' + coverage + ' to win...';

        try{
            let hash = await roulette.autoBet(coverage, larimers, function(result){
                let message = 'Roulette stops on ' + result.winning_number + '! ' + roulette.account.account_name + ' ';
                if(coverage.indexOf(parseInt(result.winning_number, 10)) > -1){
                    message += ' won ' + (larimers * 36 / coverage.length) + ' larimers! Congrats!';
                }else{
                    message += ' lost...';
                    // Uncomment this to play till you win - for debug.
                    // window.processBet(layoutForm);
                }
                document.getElementById('wheel').innerText = message;
                document.getElementById('spinBtn').disabled = false;
            });
            if(hash){
                if(hash.name && hash.name === 'TypeError'){
                    console.error(hash);
                    document.getElementById('wheel').innerText = 'Could not place bet - aborting...';
                    document.getElementById('spinBtn').disabled = false;
                }else{
                    console.log(hash);
                }
            }else{
                document.getElementById('wheel').innerText = 'Could not connect to roulette - retrying...';
                setTimeout(function(){window.processBet(layoutForm);}, 1000);
            }
        }catch(e){
            console.error(e);
            document.getElementById('wheel').innerText = 'Something weird happened - aborting...';
            document.getElementById('spinBtn').disabled = false;
        }
    };
}());
