// jshint esversion: 8
(function(){
    'use strict';

    // Login to galgal.
    galgal.login(function(accountName){

        // Balance updater.
        (async function updateBalance(){
            if(accountName){
                document.getElementById('user').innerText = accountName;
            }
            document.getElementById('balance').innerText = (await galgal.getBalance()).rows[0].balance;
            setTimeout(updateBalance, 1000);
        })();

        // user stats updater.
        (async function updateStats(){
            let cpu = (await galgal.getAccount()).cpu_limit;
            let net = (await galgal.getAccount()).net_limit;
            document.getElementById('cpu').innerText = 'used:' + cpu.used + ' available:' + cpu.available +
                ' max:' + cpu.max + '.  ' + 100*cpu.used/cpu.available + '%';
            document.getElementById('net').innerText = 'used:' + net.used + ' available:' + net.available +
                ' max:' + net.max + '.  ' + 100*net.used/net.available + '%';
            setTimeout(updateStats, 1000);
        })();

        // Spin updater.
        (async function updateSpin(spin){
            let now = Math.round(new Date() / 1000);
            if(spin && now < spin.maxtarvuttime){
                console.log('current spin good for', spin.maxtarvuttime - now, (await galgal.getTarvuts(spin.hash)));
            }else{
                galgal.spin = await galgal.getSpin(now + 30);
                console.log('got spin', galgal.spin);
            }
            setTimeout(function(){updateSpin(galgal.spin);}, 1000);
        })();

    });

    // Place a tarvut.
    window.processTarvut = async function(layoutForm){
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
            window.galgal.poll(galgal.spin, -1, function(result){
                let message = 'Galgal stops on ' + result.winning_number + '! ' + galgal.account.account_name + ' ';
                if(coverage.indexOf(parseInt(result.winning_number, 10)) > -1){
                    message += ' won ' + (larimers * 36 / coverage.length) + ' larimers! Congrats!';
                }else{
                    message += ' lost...';
                    // Uncomment this to play till you win - for debug.
                    // window.processTarvut(layoutForm);
                }
                document.getElementById('wheel').innerText = message;
                document.getElementById('spinBtn').disabled = false;
            });

            let hash = (await galgal.tarvut(
                galgal.spin.hash, coverage, parseInt(larimers, 10), +new Date()
            )).processed.action_traces[0].act.data.hash;

            if(hash){
                if(hash.name && hash.name === 'TypeError'){
                    console.error(hash);
                    document.getElementById('wheel').innerText = 'Could not place tarvut - aborting...';
                    document.getElementById('spinBtn').disabled = false;
                }else{
                    document.getElementById('spinBtn').disabled = true;
                    document.getElementById('wheel').innerText = 'Galgal is spinning... ' + galgal.account.account_name + ' placed ' + larimers + ' larimers on ' + coverage + ' to win...';
                    console.log(hash);
                }
            }else{
                document.getElementById('wheel').innerText = 'Could not connect to galgal - retrying...';
                setTimeout(function(){window.processTarvut(layoutForm);}, 1000);
            }
        }catch(e){
            console.error(e);
            return e;
        }
    };
}());
