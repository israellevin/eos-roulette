// jshint esversion: 8
(function(){

    // Initialize.
    let theChipSelector;
    let theLog;
    let theBall;
    let theWheel;
    'use strict';

    // Add log line.
    function addLogLine(line){
        theLog.innerHTML = line + '<p>' + theLog.innerHTML;
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

    // Add or remove class to an element or an HTMLCollection.
    function changeClass(elements, className, add){
        if(elements.classList){
            elements = [elements];
        }
        for(let element of elements){
            element.classList[add ? 'add' : 'remove'](className);
        }
    }

    // add a roulette winning number to the history.
    function addResultToHistory(winning_number){
        showMessage('Roulette stops on ' + winning_number + '!');
        let entry = document.createElement('li');
        entry.appendChild(document.createTextNode(winning_number));
        changeClass(entry, getColor(winning_number), true);
        let list = document.getElementById('history-ul');
        list.insertBefore(entry, list.childNodes[0]);
    }

    // Get selected numbers from a mouse event on the layout.
    function getCoverage(mouseEvent){
        let cell = mouseEvent.target;
        if(!('bet' in cell.dataset && cell.dataset.bet)) return [];
        let selection = cell.dataset.bet.split(',').map(function(x){return parseInt(x, 10);});

        // Outer bets.
        if(selection.length > 1){
            return selection;
        }

        // Inner bets. Do the math.
        let rect = cell.getBoundingClientRect();
        let width = cell.offsetWidth;
        let height = cell.offsetHeight;
        let relativeX = (mouseEvent.clientX - rect.left) / width - 0.5;
        let relativeY = (mouseEvent.clientY - rect.top) / height - 0.5;

        // Special handling for zero, to allow for baskets and trios.
        if(selection[0] === 0){
            if(relativeY > 0.3){
                let interval = 0.5 / 6;
                if(relativeX < interval * -5 || relativeX > interval * 5){
                    selection.push(1);
                    selection.push(2);
                    selection.push(3);
                }else if(relativeX < -interval && relativeX > interval * -2){
                    selection.push(1);
                    selection.push(2);
                }else if(relativeX > interval && relativeX < interval * 2){
                    selection.push(2);
                    selection.push(3);
                }
            }
        }else{
            let column = (selection[0] - 1) % 3 + 1;
            // Left side of cell.
            if(relativeX < -0.3){
                // Street.
                if(column === 1){
                    selection.push(selection[0] + 1);
                    selection.push(selection[1] + 1);
                // Split.
                }else{
                    selection.push(selection[0] - 1);
                }
            // Right side of cell.
            }else if(relativeX > 0.3){
                // Street.
                if(column === 3){
                    selection.push(selection[0] - 1);
                    selection.push(selection[1] - 1);
                // Split.
                }else{
                    selection.push(selection[0] + 1);
                }
            }

            // First fours and trios.
            if(relativeY < -0.3 && selection[0] in [1, 2, 3]){
                selection.push(0);
            // Bottom edges of upper 34 rows.
            }else if(relativeY > 0.3 && selection[0] < 34){
                selection = selection.concat(selection.map(function(x){return x + 3;}));
            // Top edges of lower 34 rows.
            }else if(relativeY < -0.3 && selection[0] > 3){
                selection = selection.concat(selection.map(function(x){return x - 3;}));
            }
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
                    showMessage('Could not place bet - aborting...');
                }else{
                    rouletteClient.coverage = coverage;
                    addLogLine(roulette.account_name + ' placed ' + larimers + ' larimers on ' + coverage + ' to win');
                    console.debug(hash + '->' + coverage);
                }
            }else{
                showMessage('Could not connect to roulette - retrying...');
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
            changeClass(document.querySelectorAll('[data-bet]'), 'highlight', false);
            getCoverage(mouseEvent).forEach(function(number){
                changeClass(document.querySelectorAll('[data-bet="' + number + '"]'), 'highlight', true);
            });
        });

        //remove all highlights when leaving the felt
        layout.addEventListener('mouseleave', function(mouseEvent){
            changeClass(document.querySelectorAll('[data-bet]'), 'highlight', false);
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
        let selector = theChipSelector;
        selector.scrollTo({
            left: element.offsetLeft - element.parentElement.parentElement.clientWidth/ 2 + 14, top: 0,
            behavior: 'smooth'
        });

        changeClass(selector.querySelectorAll(".chip"), 'iso', true);
        changeClass(element, 'iso', false);
        showMessage('Each token now worth ' + value + ' EOS');
    }

    // Hide the roulette.
    function hideRoulette(){
        theWheel.style.opacity = '0';
        theBall.style.transitionDelay = '3s';
        theBall.style.opacity = '0';
        theBall.style.transform = 'rotate(0deg)';
        changeClass(document.getElementById('layout'), 'eventless', false);
    }

    // Get a spin, preserving the resolve function across retries.
    // The oldResolve argument is used to maintain resolve function
    // persistance, and thus to keep a promise, across timeouts.
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
                resolve(spin);
            }else{
                showMessage('No spins found, will retry shortly');
                setTimeout(function(){getSpin(resolve);}, 5000);
            }
        });
    }

    // get players on a spin
    async function getPlayers(hash){
        return [
            {user: 'Aliza', bets: [{larimers: 5000, coverage: [1,2] }, {larimers: 10000, coverage: [12]}]},
            {user: 'Bob', bets: [{larimers: 5000, coverage: [30,33] }, {larimers: 10000, coverage: [19]}]},
            {user: 'Charlie', bets: []},
            {user: 'Dana', bets: []},
        ];
    }

    // Update the felt.
    // The oldResolve argument is used to maintain resolve function
    // persistance, and thus to keep a promise, across timeouts.
    async function updateFelt(spin, oldResolve){
        let Players = await getPlayers(spin.hash);
        let playersBox = document.getElementById('players-box');
        let playersBoxUl = playersBox.children[0];
        let newUL = playersBoxUl.cloneNode(false);
        Players.forEach( function (player) {
            const playerEntry = document.createElement('li');
            playerEntry.innerHTML = '<i class="fa fa-dot-circle-o players-list-item"> </i>'
                + player.user + '<br>bets: ' + player.bets.reduce( (acc, cur) => acc + cur.larimers, 0)/10000 + ' EOS';
            newUL.appendChild(playerEntry);
        });
        playersBox.replaceChild(newUL, playersBoxUl);

        let now = Math.round(new Date() / 1000);
        return new Promise(function(resolve){
            if(oldResolve){
                resolve = oldResolve;
            }
            document.getElementById('sec-left').innerText = spin.maxbettime - now;
            if(now < spin.maxbettime){
                setTimeout(function(){updateFelt(spin, resolve);}, 1000);
            }else{
                resolve();
            }
        });
    }

    // Show the roulette.
    function showRoulette(){
        showMessage('No more bets please');
        changeClass(document.getElementById('layout'), 'eventless', true);
        theWheel.style.opacity = '1';
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
        const secondsPerTurn = 1.5;
        const turns = 2;
        theBall.style.opacity = 1;
        return new Promise(function(resolve){
            function done(){
                theBall.removeEventListener('transitionend', done);
                addResultToHistory(winning_number);
                if(rouletteClient.coverage.indexOf(winning_number) > -1){
                    showMessage(roulette.account_name + ' won ' + (
                        5000 * (36 / rouletteClient.coverage.length)
                    ) + ' larimers');
                }
                setTimeout(resolve, 5000);
            }
            theBall.addEventListener('transitionend', done);
            theBall.style.transition = 'all ' + secondsPerTurn * turns + 's ease-out';
            theBall.style.transform = 'rotate(' + (1.5 * turns * -360 + winSlotDeg) + 'deg)';
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
                theChipSelector.getElementsByClassName('chip')[0].click();
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

    window.onload = function(){
        theWheel = document.getElementById('wheel');
        theBall = document.getElementById('ball');
        theLog = document.getElementById('log');
        theChipSelector = document.getElementById('chip-selector');
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
