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

        // user stats updater.
        (async function updateStats(){
            let cpu = (await roulette.getAccount()).cpu_limit;
            let net = (await roulette.getAccount()).net_limit;
            document.getElementById('cpu').innerText = 'used:' + cpu.used + ' available:' + cpu.available +
                ' max:' + cpu.max + '.  ' + 100*cpu.used/cpu.available + '%';
            document.getElementById('net').innerText = 'used:' + net.used + ' available:' + net.available +
                ' max:' + net.max + '.  ' + 100*net.used/net.available + '%';
            setTimeout(updateStats, 1000);
        })();

        // Spin updater.
        (async function updateSpin(spin){
            let now = Math.round(new Date() / 1000);
            if(spin && now < spin.maxbettime){
                console.log('current spin good for', spin.maxbettime - now, (await roulette.getBets(spin.hash)));
            }else{
                roulette.spin = await roulette.getSpin(now + 30);
                console.log('got spin', roulette.spin);
            }
            setTimeout(function(){updateSpin(roulette.spin);}, 1000);
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

        try{
            window.roulette.poll(roulette.spin, -1, function(result){
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

            let hash = (await roulette.bet(
                roulette.spin.hash, coverage, parseInt(larimers, 10), +new Date()
            )).processed.action_traces[0].act.data.hash;

            if(hash){
                if(hash.name && hash.name === 'TypeError'){
                    console.error(hash);
                    document.getElementById('wheel').innerText = 'Could not place bet - aborting...';
                    document.getElementById('spinBtn').disabled = false;
                }else{
                    document.getElementById('spinBtn').disabled = true;
                    document.getElementById('wheel').innerText = 'Roulette is spinning... ' + roulette.account.account_name + ' placed ' + larimers + ' larimers on ' + coverage + ' to win...';
                    console.log(hash);
                }
            }else{
                document.getElementById('wheel').innerText = 'Could not connect to roulette - retrying...';
                setTimeout(function(){window.processBet(layoutForm);}, 1000);
            }
        }catch(e){
            console.error(e);
            return e;
        }
    };
}());
