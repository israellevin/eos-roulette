// jshint esversion: 8
(function(){
    'use strict';

    // Global element constants, initialized in onload (so not technically constants).
    let MAIN;
    let LOG;
    let LAYOUT;
    let WHEEL;
    let BALL;
    let BLL;
    let CHIP_SELECTOR;

    // Add log line.
    function addLogLine(line){
        LOG.innerHTML = line + '<br>' + LOG.innerHTML;
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
    function getPlacement(mouseEvent){
        let placement = {coverage: [], x: 0, y: 0};
        let cell = mouseEvent.target;
        if(!('bet' in cell.dataset && cell.dataset.bet)) return placement;
        let rect = cell.getBoundingClientRect();
        // console.warn(cell.offsetTop, cell.offsetLeft);
        placement.coverage = cell.dataset.bet.split(',').map(function(x){return parseInt(x, 10);});
        placement.x = cell.offsetLeft + rect.width / 2;
        placement.y = cell.offsetTop + rect.height / 2;

        // Outer bets.
        if(placement.coverage.length > 1){
            return placement;
        }

        // Inner bets. Do the math.
        let relativeX = (mouseEvent.clientX - rect.left) / rect.width - 0.5;
        let relativeY = (mouseEvent.clientY - rect.top) / rect.height - 0.5;

        // Special handling for zero, to allow for baskets and trios.
        if(placement.coverage[0] === 0){
            if(relativeY > 0.3){
                placement.y += rect.height / 2;
                let interval = 1 / 9;
                if(relativeX > interval * 4){
                    placement.x += rect.width * 0.5;
                    placement.coverage.push(1);
                    placement.coverage.push(2);
                    placement.coverage.push(3);
                }else if(relativeX < -interval && relativeX > interval * -2){
                    placement.x -= rect.width / 6;
                    placement.coverage.push(1);
                    placement.coverage.push(2);
                }else if(relativeX > interval && relativeX < interval * 2){
                    placement.x += rect.width / 6;
                    placement.coverage.push(2);
                    placement.coverage.push(3);
                }
            }
        }else{
            let column = (placement.coverage[0] - 1) % 3 + 1;
            // Left side of cell.
            if(relativeX < -0.3 && column > 1){
                // Split.
                placement.x -= rect.width / 2;
                placement.coverage.push(placement.coverage[0] - 1);
            // Right side of cell.
            }else if(relativeX > 0.3){
                placement.x += rect.width / 2;
                // Street.
                if(column === 3){
                    placement.coverage.push(placement.coverage[0] - 1);
                    placement.coverage.push(placement.coverage[1] - 1);
                // Split.
                }else{
                    placement.coverage.push(placement.coverage[0] + 1);
                }
            }

            // First fours and trios.
            if(relativeY < -0.3 && placement.coverage[0] in [1, 2, 3] && placement.coverage.length > 1){
                placement.y -= rect.height / 2;
                placement.coverage.push(0);
            // Bottom edges of upper 34 rows.
            }else if(relativeY > 0.3 && placement.coverage[0] < 34){
                placement.y += rect.height / 2;
                placement.coverage = placement.coverage.concat(placement.coverage.map(function(x){return x + 3;}));
            // Top edges of lower 34 rows.
            }else if(relativeY < -0.3 && placement.coverage[0] > 3){
                placement.y -= rect.height / 2;
                placement.coverage = placement.coverage.concat(placement.coverage.map(function(x){return x - 3;}));
            }
        }
        return placement;
    }

    // Place a bet.
    async function processBet(coverage, larimers, success){
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
                    addLogLine(roulette.account_name + ' placed ' + larimers + ' larimers on ' + coverage);
                    console.log(hash + '->' + coverage);
                    success();
                }
            }else{
                console.error('unable to get hash from contract');
            }
        }catch(e){
            console.error('unable to place bet: ' + e);
            return e;
        }
    }


    function onMouseMove(mouseEvent) {
        changeClass(document.querySelectorAll('[data-bet]'), 'highlight', false);
        let placement = getPlacement(mouseEvent);
        placement.coverage.forEach(function(number){
            changeClass(document.querySelectorAll('[data-bet="' + number + '"]'), 'highlight', true);
        });

        // // Temp illustration of the idea.
        // let market = document.getElementById('marker');
        // marker.style.top = (placement.y - marker.offsetHeight / 2) + 'px';
        // marker.style.left = (placement.x - marker.offsetWidth / 2) + 'px';
    }


    function showBet(size, placement) {
        let chip = document.createElement('DIV');
        chip.classList.add('chip', 'small', 'eventless');
        chip.style.position = 'absolute';
        chip.style.left = placement.x + 'px';
        chip.style.top = placement.y + 'px';
        chip.appendChild(document.createTextNode('!!!'));
        LAYOUT.appendChild(chip);

    }

    function onClick(mouseEvent){
        let placement = getPlacement(mouseEvent);
        if (placement.coverage.length < 1) {
            console.warn('click outside');
        }
        if(roulette.account_name === null){
            return showMessage('Must be logged in to bet');
        }
        if(rouletteClient.bet_size === null){
            return showMessage('No bet size selected');
        }
        // TODO should processBet receive placement xy and place the token?
        processBet(placement.coverage, rouletteClient.bet_size, function () {
            showBet(rouletteClient.bet_size, placement);
        });
    }

    async function highlightBetLocation(event) {
        let chip = document.createElement('DIV');
        console.log(MAIN);
        chip.classList.add('chip', 'small', 'eventless');
        chip.style.position = 'absolute';
        let main_rect = MAIN.getBoundingClientRect();
        let selector_rect = CHIP_SELECTOR.getBoundingClientRect();
        console.log(event.clientX, main_rect.left);
        chip.style.left = '280px';
        chip.style.top = '430px';
        chip.appendChild(document.createTextNode('???'));
        console.log(event);
        MAIN.appendChild(chip);
        setInterval(function () {
            chip.style.left = event.clientX-main_rect.left + 'px';
            chip.style.top = event.clientY-main_rect.top + 'px';
        }, 0);

    }

    let clickAllowed = false;

    // Initialize an html element as a layout.
    // It is assumed that the element contains mouse sensitive elements with data-bet attributes.
    function initLayout(layout){

        // Highlight on mouse movement.
        layout.addEventListener('mousemove', onMouseMove);
        layout.addEventListener('mousedown', function(event){
            clickAllowed = false;
            setTimeout(function(){
                clickAllowed = true;
            }, 300);
            highlightBetLocation(event);
        });
        layout.addEventListener('mouseup', function(event){
            if (clickAllowed){
                onClick(event);
            } else {
                console.warn("click too short");
            }
        });

        //remove all highlights when leaving the felt
        layout.addEventListener('mouseleave', function(mouseEvent){
            changeClass(document.querySelectorAll('[data-bet]'), 'highlight', false);
        });

        // Place a bet on mouse click.
        // layout.onclick = onClick;
    }

    // Update the user's balance.
    async function updateBalance(){
        if(roulette.account_name === null){
            return console.error('can not get balance when disconnected');
        }
        document.getElementById('balance').innerText = await roulette.getBalance();
    }

    // Select a token to set the bet size.
    function selectToken(element, value){
        rouletteClient.bet_size = value * 10000;
        let selector = CHIP_SELECTOR;
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
        WHEEL.style.opacity = '0';
        BALL.style.transitionDelay = '3s';
        BALL.style.opacity = '0';
        BALL.style.transform = 'rotate(0deg)';
        BLL.style.transform = 'rotate(0deg)';
        changeClass(LAYOUT, 'eventless', false);
    }

    // Get a spin, preserving the resolve function across retries.
    // The oldResolve argument is used to maintain resolve function
    // persistance, and thus to keep a promise, across timeouts.
    async function getSpin(oldResolve){
        showMessage('Trying to get a spin...');
        const now = Math.round(new Date() / 1000);
        const spin = await roulette.selectSpin(now + (roulette.account_name ? 20 : 10));

        return new Promise(function(resolve){
            if(oldResolve){
                resolve = oldResolve;
            }
            if(spin){
                showMessage('Connected to spin ' + spin.hash.substr(0, 4));
                resolve(spin);
                roulette.monitorSpin(spin);
            }else{
                showMessage('No spins found, will retry shortly');
                setTimeout(function(){getSpin(resolve);}, 3000);
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
            playerEntry.innerHTML = '<i class="fa fa-dot-circle-o players-list-item"></i>' +
                player.user + '<br>bets: ' + player.bets.reduce((acc, cur) => acc + cur.larimers, 0)/10000 + ' EOS';
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
        changeClass(LAYOUT, 'eventless', true);
        WHEEL.style.opacity = '1';
    }

    // Get the result of a spin.
    async function getResult(spin){
        addLogLine("waiting for result");
        return await roulette.getWinningNumber(spin);
    }

    // Drop the ball and reveal the winner.
    function dropBall(winning_number){
        const LAYOUT_NUMBERS = [
            0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
            5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
        ];
        const winSlotDeg = 360 / 37 * LAYOUT_NUMBERS.indexOf(winning_number);
        // const shift =  Math.floor(Math.random() * 360);
        const secondsPerTurn = 1.5;
        const turns = 2;
        BALL.style.opacity = '1';
        return new Promise(function(resolve){
            // callback for completion of ball drop transition
            function ballOnWinningNumber(){
                BALL.removeEventListener('transitionend', ballOnWinningNumber);
                addResultToHistory(winning_number);
                if(rouletteClient.coverage.indexOf(winning_number) >=  0){
                    showMessage(roulette.account_name + ' won ' + (
                        5000 * (36 / rouletteClient.coverage.length)
                    ) + ' larimers');
                }
                setTimeout(resolve, 5000);
            }
            BALL.addEventListener('transitionend', ballOnWinningNumber);
            BALL.style.transition = 'all ' + secondsPerTurn * turns + 's ease-out';
            var targetDeg = 1.5 * turns * -360 + winSlotDeg;
            BALL.style.transform = 'rotate(' + targetDeg + 'deg)';
            BLL.style.transition = 'all ' + secondsPerTurn * turns + 's ease-out';
            BLL.style.transform = 'rotate(' + -1*targetDeg + 'deg)';
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
                CHIP_SELECTOR.getElementsByClassName('chip')[0].click();
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
        MAIN = document.getElementById('main-space');
        LOG = document.getElementById('log');
        LAYOUT = document.getElementById('layout');
        WHEEL = document.getElementById('wheel');
        BALL = document.getElementById('ball');
        BLL = document.getElementById('bll');
        CHIP_SELECTOR = document.getElementById('chip-selector');
        initLayout(LAYOUT);
        lifeCycle();
    };

    // Expose some functionality.
    window.rouletteClient = {
        MAIN: MAIN,
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
