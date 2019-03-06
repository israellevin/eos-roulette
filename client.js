// jshint esversion: 8
(function(){
    'use strict';

    // Add log line.
    function addLogLine(line){
        document.getElementById('log').innerHTML = line + '<p>' + document.getElementById('log').innerHTML;
    }

    // Show a message.
    function showMessage(message){
        document.getElementById('message').innerText = message;
        addLogLine('<u>' + message + '</u>');
    }

    // Get color of number.
    function getColor(number){
        if(document.querySelectorAll('[data-bet="' + number + '"]')[0].classList.contains('red')) return 'red';
        if(document.querySelectorAll('[data-bet="' + number + '"]')[0].classList.contains('black')) return 'black';
        return 'green';
    }

    // add a roulette winning number to the history.
    function addResultToHistory(winning_number){
        showMessage('Roulette stops on ' + winning_number + '!');
        let entry = document.createElement('li');
        entry.appendChild(document.createTextNode(winning_number));
        entry.classList.add(getColor(winning_number));
        let list = document.getElementById('history-ul');
        list.insertBefore(entry, list.childNodes[0]);
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

        // Inner bets. Do the math.
        // TODO Add sixes.
        let rect = cell.getBoundingClientRect();
        let width = cell.offsetWidth;
        let height = cell.offsetHeight;
        let relativeX = (mouseEvent.clientX - rect.left) / width - 0.5;
        let relativeY = (mouseEvent.clientY - rect.top) / height - 0.5;

        // Right edges of left two cols.
        if(relativeX > 0.3 && selection[0] % 3 !== 0){
            selection.push(selection[0] + 1);
        // Left edges of right two cols.
        }else if(relativeX < -0.3 && selection[0] % 3 !== 1){
            selection.push(selection[0] - 1);
        }
        // Bottom edges of upper 34 rows.
        if(relativeY > 0.3 && selection[0] < 34){
            selection = selection.concat(selection.map(function(x){return x + 3;}));
        // Top edges of lower 34 rows.
        }else if(relativeY < -0.3 && selection[0] > 3){
            selection = selection.concat(selection.map(function(x){return x - 3;}));
        }
        return selection;
    }

    // Place a bet.
    async function processBet(coverage, larimers){
        if(rouletteClient.spin === null){
            return showMessage('No spins currently in progress');
        }
        if(36 % coverage.length !== 0){
            return showMessage('coverage size must divide 36');
        }
        try{
            let hash = (await roulette.bet(
                rouletteClient.spin.hash, coverage, parseInt(larimers, 10), +new Date()
            )).processed.action_traces[0].act.data.hash;

            if(hash){
                if(hash.name && hash.name === 'TypeError'){
                    console.error(hash);
                    document.getElementById('message').innerText = 'Could not place bet - aborting...';
                }else{
                    rouletteClient.coverage = coverage;
                    addLogLine(roulette.account_name + ' placed ' + larimers + ' larimers on ' + coverage + ' to win');
                    console.log(hash + '->' + coverage);
                }
            }else{
                document.getElementById('message').innerText = 'Could not connect to roulette - retrying...';
                setTimeout(function(){processBet(mouseEvent, larimers);}, 1000);
            }
        }catch(e){
            console.error('unable to place bet');
            return e;
        }
    }

    // Initialize an html element as a layout.
    // It is assumed that the element contains mouse sensitive elements with data-bet attributes.
    function initLayout(layout){

        // Highlight on mouse movement.
        layout.addEventListener('mousemove', function(mouseEvent){
            document.querySelectorAll('[data-bet]').forEach(function(element){
                element.classList.remove('highlight');
            });
            getCoverage(mouseEvent).forEach(function(number){
                document.querySelectorAll('[data-bet="' + number + '"]')[0].classList.add('highlight');
            });
        });

        //remove all highlights when leaving the felt
        layout.addEventListener('mouseleave', function(mouseEvent){
            document.querySelectorAll('[data-bet]').forEach(function(element){
                element.classList.remove('highlight');
            });
        });

        // Place a bet on mouse click.
        layout.onclick = function(mouseEvent){
            if(roulette.account_name === null){
                return showMessage('Must be logged in to bet');
            }
            if(rouletteClient.bet_size === null){
                return showMessage('No bet size selected');
            }
            processBet(getCoverage(mouseEvent), rouletteClient.bet_size);
        };
    }

    // Update the user's balance.
    async function updateBalance(){
        if(roulette.account_name === null){
            return console.error('can not get balance when disconnected');
        }
        document.getElementById('balance').innerText = (await roulette.getBalance()).rows[0].balance;
    }


    // Select a token to set the bet size.
    function selectToken(element, value){
        rouletteClient.bet_size = value * 10000;
        let selector = document.getElementById("chip-selector");
        selector.scrollTo({
            left: element.offsetLeft - element.parentElement.parentElement.clientWidth/ 2 + 14, top: 0,
            behavior: 'smooth'
        });
        selector.querySelectorAll(".chip").forEach(function(chip){chip.classList.add("iso");});
        element.classList.remove("iso");
        let msg = "Each token now worth " + value + " EOS";
        addLogLine(msg);
        document.getElementById('message').innerText = msg;
    }

    // Hide the roulette.
    function hideRoulette(){
        document.getElementById('wheel').style.opacity = '0';
        document.getElementById('layout').classList.remove('eventless');
    }

    // Get a spin, preserving the resolve function across retries.
    async function getSpin(oldResolve){
        showMessage('Trying to get a spin...');
        const now = Math.round(new Date() / 1000);
        const spin = await roulette.getSpin(now + (roulette.account_name ? 20 : 10));

        return new Promise(function(resolve){
            if(oldResolve){
                resolve = oldResolve;
            }
            if(spin){
                showMessage('Connected to spin ' + spin.hash.substr(0, 4));
                // document.getElementById('timer').style.display = 'table-cell';
                resolve(spin);
            }else{
                showMessage('No spins found, will retry shortly');
                setTimeout(function(){getSpin(resolve);}, 5000);
            }
        });
    }

    // Update the felt.
    async function updateFelt(spin, oldResolve){
        let bettors = await roulette.getBets(spin.hash);
        let playersBox = document.getElementById('players-box');
        let playersBoxUl = playersBox.children[0];
        let newUL = playersBoxUl.cloneNode(false);
        bettors.forEach( function (fellow) {
            const playerEntry = document.createElement('li');
            playerEntry.innerHTML = '<i class="fa fa-dot-circle-o players-list-item"> </i>' +
                fellow.user + '<BR>bet:' + fellow.larimers/10000;
            newUL.appendChild(playerEntry);
        });
        playersBox.replaceChild(newUL, playersBoxUl);

        let now = Math.round(new Date() / 1000);
        return new Promise(function(resolve){
            //TODO explain this if with comment
            if(oldResolve){
                resolve = oldResolve;
            }
            if(now < spin.maxbettime){
                document.getElementById('sec-left').innerText = spin.maxbettime - now;
                setTimeout(function(){updateFelt(spin, resolve);}, 1000);
            }else{
                resolve();
            }
        });
    }

    // Show the roulette.
    function showRoulette(){
        showMessage('No more bets please');
        document.getElementById('layout').classList.add('eventless');
        document.getElementById('wheel').style.opacity = '1';
        // document.getElementById('timer').style.display = 'none';
    }

    // Get the result of a spin.
    async function getResult(spin){
        return new Promise(function(resolve){
            roulette.poll(spin, -1, function(result){
                resolve(result.winning_number);
            });
        });
    }

    // Drop the ball and reveal the winner.
    function dropBall(winning_number){
        const LAYOUT_NUMBERS = [
            0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
            5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
        ];
        const winSlotDeg = 360 / 37 * LAYOUT_NUMBERS.indexOf(winning_number);
        const shift =  Math.floor(Math.random() * 360);
        const ball = document.getElementById('ball');
        const secondsPerTurn = 1.5;
        const turns = 2;
        ball.style.opacity = 1;
        return new Promise(function(resolve){
            function done(){
                ball.removeEventListener('transitionend', done);
                addResultToHistory(winning_number);
                if(rouletteClient.coverage.indexOf(winning_number) > -1){
                    showMessage(roulette.account_name + ' won ' + (
                        5000 * (36 / rouletteClient.coverage.length)
                    ) + ' larimers');
                }
                setTimeout(resolve, 5000);
            }
            ball.addEventListener('transitionend', done);
            ball.style.transition = 'all ' + secondsPerTurn * turns + 's ease-out';
            ball.style.transform = 'rotate(' + (1.5 * turns * -360 + winSlotDeg) + 'deg)';
        });
    }

    // Our lifeCycle.
    async function lifeCycle(){
        hideRoulette();
        rouletteClient.spin = await getSpin();
        rouletteClient.spin.maxbettime -= 3;
        await updateFelt(rouletteClient.spin);
        showRoulette();
        await dropBall(await getResult(rouletteClient.spin));
        lifeCycle();
    }

    // Login to scatter.
    function login(){
        if(roulette.account_name !== null){
            return showMessage('already logged in');
        }
        roulette.login(function(account_name){
            if(account_name){
                document.getElementById('user').innerText = account_name;
                document.getElementById('connectBtn').style.display = 'none';
                document.getElementById('chip-selector').getElementsByClassName('chip')[0].click();
                rouletteClient.updater = setInterval(updateBalance, 1000);
            }
        });
    }

    // Logout of scatter.
    function logout(){
        if(roulette.account_name === null){
            return showMessage('not logged in');
        }
        roulette.logout(function(){
            clearInterval(rouletteClient.updater);
            document.getElementById('user').innerText = '';
            document.getElementById('connectBtn').style.display = 'block';
        });
    }

    // Initialize.
    window.onload = function(){
        initLayout(document.getElementById('layout'));
        lifeCycle();
    };

    // Expose some functionality.
    window.rouletteClient = {
        spin: null,
        bet_size: null,
        coverage: [],
        login: login,
        logout: logout,
        selectToken: selectToken,
        hintsShown: false,
        startIntro: function(){introJs().start();},
        toggleHints: function(){
            introJs()[rouletteClient.hintsShown ? 'hideHints' : 'showHints']();
            rouletteClient.hintsShown = !rouletteClient.hintsShown;
        },
    };

}());
