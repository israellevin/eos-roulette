// jshint esversion: 8
(function(){
    'use strict';

    window.spin = null;

    // Place a bet.
    async function processBet(coverage, larimers){
        if(36 % coverage.length !== 0){
            console.error('coverage size must divide 36');
            return false;
        }

        try{
            window.roulette.poll(window.spin, -1, function(result){
                let message = 'Roulette stops on ' + result.winning_number + '! ' + window.roulette.account.account_name + ' ';
                if(coverage.indexOf(parseInt(result.winning_number, 10)) > -1){
                    message += ' won ' + (larimers * 36 / coverage.length) + ' larimers! Congrats!';
                }else{
                    message += ' lost...';
                }
                document.getElementById('message').innerText = message;
            });

            let hash = (await window.roulette.bet(
                window.spin.hash, coverage, parseInt(larimers, 10), +new Date()
            )).processed.action_traces[0].act.data.hash;

            if(hash){
                if(hash.name && hash.name === 'TypeError'){
                    console.error(hash);
                    document.getElementById('message').innerText = 'Could not place bet - aborting...';
                }else{
                    document.getElementById('message').innerText = 'Roulette is spinning... ' + window.roulette.account.account_name + ' placed ' + larimers + ' larimers on ' + coverage + ' to win...';
                    console.log(hash);
                }
            }else{
                document.getElementById('message').innerText = 'Could not connect to roulette - retrying...';
                setTimeout(function(){processBet(mouseEvent, larimers);}, 1000);
            }
        }catch(e){
            console.error(e);
            return e;
        }
    }
    // Get selected numbers from a mouse event on the layout.
    function getCoverage(mouseEvent){
        let cell = mouseEvent.target;
        if(!('bet' in cell.dataset && cell.dataset.bet)) return [];
        let selection = cell.dataset.bet.split(',').map(function(x){return parseInt(x, 10);});

        // Outer bets.
        if(selection.length > 1 || selection[0] === 0){
            return selection;
        }

        let rect = cell.getBoundingClientRect();
        let width = cell.offsetWidth;
        let height = cell.offsetHeight;
        let relativeX = (mouseEvent.clientX - rect.left) / width - 0.5;
        let relativeY = (mouseEvent.clientY - rect.top) / height - 0.5;
        if(relativeX > 0.3 && selection[0] % 3 !== 0){
            selection.push(selection[0] + 1);
        }else if(relativeX < -0.3 && selection[0] % 3 !== 1){
            selection.push(selection[0] - 1);
        }
        if(relativeY > 0.3 && selection[0] < 34){
            selection = selection.concat(selection.map(function(x){return x + 3;}));
        }else if(relativeY < -0.3 && selection[0] > 3){
            selection = selection.concat(selection.map(function(x){return x - 3;}));
        }
        return selection;
    }
    // Initialize an html element as a layout.
    // It is assumed that the element contains mouse sensitive elements with data-bet attributes.
    function init(layout){

        // Highlight on mouse movement.
        layout.onmousemove = function(mouseEvent){
            document.querySelectorAll('[data-bet]').forEach(function(element){
                element.classList.remove('highlight');
            });
            mouseEvent.target.classList.add('highlight');
            getCoverage(mouseEvent).forEach(function(number){
                document.querySelectorAll('[data-bet="' + number + '"]')[0].classList.add('highlight');
            });
        };

        // Place a bet on mouse click.
        layout.onclick = function(mouseEvent){
            processBet(getCoverage(mouseEvent), 50);
        };
    }

    // Login to roulette.
    window.roulette.login(function(accountName){

        // Balance updater.
        (async function updateBalance(){
            if(accountName){
                document.getElementById('user').innerText = accountName;
            }
            document.getElementById('balance').innerText = (await window.roulette.getBalance()).rows[0].balance;
            setTimeout(updateBalance, 1000);
        })();

        // user stats updater.
        (async function updateStats(){
            let cpu = (await window.roulette.getAccount()).cpu_limit;
            let net = (await window.roulette.getAccount()).net_limit;
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
                // console.log('current spin good for', spin.maxbettime - now, (await window.roulette.getBets(spin.hash)));
                document.getElementById('sec-left').innerText = spin.maxbettime - now

            }else{
                window.spin = spin = await window.roulette.getSpin(now + 30);
                console.log('got spin', spin);
                document.getElementById('log').innerHTML =
                    'got spin ' + spin.id + '<p>' +  document.getElementById('log').innerHTML
            }
            setTimeout(function(){updateSpin(spin);}, 1000);
        })();

        // Initialize roulette.
        init(document.getElementById('layout'));
    });
}());
