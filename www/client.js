// jshint esversion: 8
(function(){
    'use strict';

    // Global element constants, initialized in onload (so not technically constants).
    let MAIN;
    let LOG;
    let LAYOUT;
    let WHEEL;
    let BALL_CONTAINER;
    let BALL;
    let CHIP_SELECTOR;
    let PLAYERS_BOX;

    // Sounds.
    // Avoids silly browser error.
    Howler.usingWebAudio = false;
    const CLICK_SOUND = new Howl({src: ['sounds/click.wav']});
    const CHEER_SOUND = new Howl({src: ['sounds/cheers.ogg']});
    const WELCOME_SOUND = new Howl({src: ['sounds/welcome.wav']});
    const GOODBYE_SOUND = new Howl({src: ['sounds/goodbye.wav']});

    // Global state variables.
    let state = {
        bets: {},
        peers: {},
        spin: null,
        loginUpdater: null
    };

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
    function getNumberColor(number){
        if(LAYOUT.querySelector('[data-coverage="' + number + '"]').classList.contains('red')){
            return 'red';
        }
        if(LAYOUT.querySelector('[data-coverage="' + number + '"]').classList.contains('black')){
            return 'black';
        }
        return 'green';
    }

    // Add or remove classes to an element or an HTMLCollection.
    function changeClass(elements, classNames, add){
        if(!elements){
            return;
        }
        if(elements.classList){
            elements = [elements];
        }
        if(typeof classNames === 'string'){
            classNames = [classNames];
        }
        for(let element of elements){
            for(let className of classNames){
                element.classList[add ? 'add' : 'remove'](className);
            }
        }
    }

    // Add a roulette winning number to the history.
    function addResultToHistory(winning_number){
        showMessage('Roulette stops on ' + winning_number + '!');
        let entry = document.createElement('li');
        entry.appendChild(document.createTextNode(winning_number));
        changeClass(entry, getNumberColor(winning_number), true);
        let list = document.getElementById('history-ul');
        list.insertBefore(entry, list.childNodes[0]);
    }

    // Get the target cell and position relative to it of a chip from a coverage.
    function getChipPosition(coverage){
        let target = [];
        let positions = [];
        if(coverage.length === 1){
            target = coverage[0];
        }else if(coverage.length > 6){
            target = [...coverage].join(',');
        }else{
            target = Math.max(...coverage);
            if(coverage.length === 2){
                positions.push(Math.abs(coverage[0] - coverage[1]) === 1 ? 'td-W' : 'td-N');
            }else{
                positions.push('td-N');
                let streetLength = coverage.indexOf(0) === -1 ? 6 : 4;
                positions.push(coverage.length === streetLength ? 'td-E' : 'td-W');
            }
        }
        return {
            target: LAYOUT.querySelector('[data-coverage="' + target + '"]'),
            positions: positions
        };
    }

    // Get selected coverage from a mouse event on the layout.
    function getCoverage(mouseEvent){
        let cell = mouseEvent.target;
        if(!('coverage' in cell.dataset && cell.dataset.coverage)){
            throw 'illegal target: ' + cell.tagName;
        }
        let coverage = cell.dataset.coverage.split(',').map(function(x){return parseInt(x, 10);});
        let rect = cell.getBoundingClientRect();

        // Outer bets.
        if(coverage.length > 1){
            return coverage;
        }

        // Inner bets. Do the math, normalizing the position in the target.
        let relativeX = (mouseEvent.clientX - rect.left) / rect.width - 0.5;
        let relativeY = (mouseEvent.clientY - rect.top) / rect.height - 0.5;
        let target = coverage[0];

        // Special handling for zero, to allow for baskets and trios.
        if(target === 0){
            if(relativeY > 0.3){
                let interval = 1 / 9;
                if(relativeX > interval * 4){
                    coverage.push(1, 2, 3);
                }else if(relativeX > interval && relativeX < interval * 2){
                    coverage.push(2, 3);
                }else if(relativeX < -interval && relativeX > interval * -2){
                    coverage.push(1, 2);
                }
            }
        }else{
            // The rest of the inner bets. Start with columns.
            let column = (target - 1) % 3 + 1;
            // Left side of cell.
            if(relativeX < -0.3 && column > 1){
                // Split.
                coverage.push(--target);
            // Right side of cell.
            }else if(relativeX > 0.3){
                // Street.
                if(column === 3){
                    coverage.push(--target, --target);
                // Split.
                }else{
                    coverage.push(++target);
                }
            }
            // Basket and trios from zero's neighbours.
            if(relativeY < -0.3 && target in [1, 2, 3] && coverage.length > 1){
                coverage.push(0);
            // Bottom edges of upper 34 rows.
            }else if(relativeY > 0.3 && target < 34){
                coverage = coverage.concat(coverage.map(function(x){return x + 3;}));
            // Top edges of lower 34 rows.
            }else if(relativeY < -0.3 && target > 3){
                coverage = coverage.concat(coverage.map(function(x){return x - 3;}));
            }
        }
        return coverage;
    }

    // Place a bet.
    function bet(coverage, larimers){
        if(state.spin === null){
            return showMessage('No spins currently in progress');
        }
        if(36 % coverage.length !== 0){
            return showMessage('coverage size must divide 36');
        }
        return new Promise(async function(resolve, reject){
            try{
                return resolve((await roulette.bet(
                    state.spin.hash, coverage, parseInt(larimers, 10), +new Date()
                )).processed.action_traces[0].act.data.hash);
            }catch(error){
                return reject(error);
            }
        });
    }

    // Get a chip according to user.
    function getChip(user){
        if(!user || user === roulette.account_name){
            return CHIP_SELECTOR.querySelector('div.chip:not(.iso)');
        }
        let chip = CHIP_SELECTOR.querySelector('div.chip').cloneNode(false);
        changeClass(chip, 'iso', false);
        chip.style.setProperty('--chip-face', state.peers[user].color);
        return chip;
    }

    // Select a chip to set the bet size.
    function selectChip(chip){
        changeClass(getChip(), 'iso', true);
        changeClass(chip, 'iso', false);
        showMessage('Each chip now worth ' + (chip.dataset.value / 10000) + ' EOS');
        CHIP_SELECTOR.scrollTo({
            left: chip.offsetLeft - chip.parentElement.parentElement.clientWidth / 2 + 14, top: 0,
            behavior: 'smooth'
        });
    }

    // Place a bet on the layout.
    async function placeBet(mouseEvent){
        let coverage = getCoverage(mouseEvent);
        let larimers = getChip().dataset.value;
        let hash = await bet(coverage, larimers);
        console.info(hash);
    }

    // Show a potential bet.
    function hoverBet(mouseEvent){
        if(roulette.account_name === null){
            return showMessage('Must be logged in to bet');
        }

        if(state.spin === null){
            return showMessage('No spins currently in progress');
        }

        let selectedChip = getChip();
        if(selectedChip === null){
            return showMessage('Please choose bet size');  // TODO open hint on selector
        }

        let chip = selectedChip.cloneNode(false);
        changeClass(chip, 'eventless', true);

        // Remove the chip if the user did not follow through.
        function removeChip(){
            chip.removeEventListener('transitionend', useChip);
            chip.style.left = LAYOUT.rect.width - 20 + 'px';
            chip.style.top = LAYOUT.rect.height - 20 + 'px';
            setTimeout(function(){
                chip.parentElement.removeChild(chip);
            }, 300);
        }
        document.addEventListener('mouseup', removeChip, {once: true});

        // Use the chip to make a bet if the user follows through.
        function useChip(){
            document.removeEventListener('mouseup', removeChip);
            chip.style.transition = 'all 0s linear';
            document.addEventListener('mouseup', function(mouseEvent){
                chip.parentElement.removeChild(chip);
                placeBet(mouseEvent);
            }, {once: true});
        }
        chip.addEventListener('transitionend', useChip, {once: true});

        window.requestAnimationFrame(function(){
            LAYOUT.appendChild(chip);
                chip.style.position = 'absolute';
                chip.style.left = LAYOUT.rect.width - 20 + 'px';
                chip.style.top = LAYOUT.rect.height - 20 + 'px';
            chip.style.transition = 'all 0.4s ease-in';
            window.requestAnimationFrame(function(){
                chip.style.left = (mouseEvent.clientX - LAYOUT.rect.left) + 'px';
                chip.style.top = (mouseEvent.clientY - LAYOUT.rect.top) + 'px';
            });
        });
    }

    // Highlight potential bet and move betting chip if it exists.
    function highlightBet(mouseEvent) {
        changeClass(LAYOUT.querySelectorAll('[data-coverage]'), 'highlight', false);
        let coverage = getCoverage(mouseEvent);
        coverage.forEach(function(number){
            changeClass(LAYOUT.querySelector('[data-coverage="' + number + '"]'), 'highlight', true);
        });
        let chip = LAYOUT.querySelector('#layout > .chip');
        if(chip){
            chip.style.left = (mouseEvent.clientX - LAYOUT.rect.left) + 'px';
            chip.style.top = (mouseEvent.clientY - LAYOUT.rect.top) + 'px';
        }
    }

    // Initialize an html element as a layout.
    // It is assumed that the element contains mouse sensitive elements with data-coverage attributes.
    function initLayout(layout){
        LAYOUT.addEventListener('mouseleave', function(){
            changeClass(LAYOUT.querySelectorAll('[data-coverage]'), 'highlight', false);
        });
        layout.querySelectorAll('[data-coverage]').forEach(function(tdElement){
            tdElement.addEventListener('mousemove', highlightBet);
            tdElement.addEventListener('mousedown', hoverBet);
            let val = tdElement.dataset.coverage;
            if (val.indexOf(',') < 0) {
                let innerDiv = document.createElement('div');
                changeClass(innerDiv, 'inner-td', true);
                tdElement.appendChild(innerDiv);
                let number = document.createElement('div');
                changeClass(number, 'td-number', true);
                number.innerText = val;
                innerDiv.appendChild(number);
            }
        });
    }

    // Update the user's balance.
    async function updateBalance(){
        if(roulette.account_name === null){
            return console.error('can not get balance when disconnected');
        }
        document.getElementById('balance').innerText = await roulette.getBalance();
    }

    // Hide the roulette.
    function hideRoulette(){
        WHEEL.style.opacity = '0';
        BALL_CONTAINER.style.transitionDelay = '3s';
        BALL_CONTAINER.style.opacity = '0';
        BALL_CONTAINER.style.transform = 'rotate(0deg)';
        BALL.style.transform = 'rotate(0deg)';
        changeClass(LAYOUT, 'eventless', false);
    }

    // Get a spin, preserving the resolve function across retries.
    // The oldResolve argument is used to maintain resolve function
    // persistance, and thus to keep a promise, across timeouts.
    async function getSpin(oldResolve){
        showMessage('Trying to get a spin...');
        const now = Math.round(new Date() / 1000);
        const spin = await roulette.selectSpin(
            now + (roulette.account_name ? 30 : 10));

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

    // Draw a bet on the felt.
    function drawBet(bet){
        let chip = getChip(bet.user).cloneNode(false);
        let chipPosition = getChipPosition(bet.coverage);
        changeClass(chip, chipPosition.positions.concat(['small', 'eventless']), true);
        chip.appendChild(document.createTextNode(bet.larimers / 10000));

        // TODO Make this pretty with a cool animation.
        // for now, space other players bets
        setTimeout(function(){chipPosition.target.appendChild(chip);}, 5000 * Math.random());
        CLICK_SOUND.play();

        addLogLine(bet.user + ' placed ' + bet.larimers + ' larimers on ' + bet.coverage);
    }

    // Convert a string to a number by splitting it to an array and reducing it
    // to sum its bytes multiplied by their positional value.
    function stringToNumber(string){
        return string.split('').reduce(
            (sum, character, position, array) => sum + character.charCodeAt(0) * (array.length - position) , 0
        );
    }

    // Turn a user name into a pseudo-random predictable color.
    function userColor(user){
        const seed = Math.sin(stringToNumber(user)) / 2 + 0.5;
        const randomInt = (min, max) => Math.floor(seed * (max - min + 1)) + min;
        // Avoid green hues.
        const avoid = 120;
        const avoidRange = 40;
        const hue = (randomInt(avoidRange, 360 - avoidRange) + avoid) % 360;
        const saturation = randomInt(80, 100);
        const lightness = randomInt(50, 80);
        return `hsl(${hue},${saturation}%,${lightness}%)`;
    }

    // Get a player's entry in the players box, creating and adding a new one if needed.
    function getPlayerEntry(name) {
        let playerEntry = PLAYERS_BOX.querySelector('[data-user="' + name + '"]');
        if(playerEntry){return playerEntry;}

        // TODO create a complex div with chip, name, bet info, etc
        playerEntry = document.createElement('li');
        playerEntry.dataset.user = name;
        playerEntry.innerHTML = '<i class="fa fa-dot-circle-o players-list-item"></i><span>' +
            name + '</span><span class="larimers"></span>';
        playerEntry.style.color = state.peers[name].color;
        PLAYERS_BOX.appendChild(playerEntry);
        playerEntry.fadeaway = function(){
            playerEntry.addEventListener('transitionend', () => PLAYERS_BOX.removeChild(playerEntry), {once: true});
            playerEntry.style.transition = 'opacity 1s';
            playerEntry.style.opacity = 0;
        };
        return playerEntry;
    }

    // Update the players box.
    function updatePlayersBox(){
        for(const [name, bets] of Object.entries(state.bets)){
            // Map the values of all this user's bets to an array of larimer values, then reduce it to it's sum.
            let totalLarimers = state.peers[name].larimers = Object.values(bets).map(bet => bet.larimers).reduce(
                (sum, current) => sum + current, 0
            );
            let playerEntry = getPlayerEntry(name);
            playerEntry.querySelector('.larimers').innerText = '[' + totalLarimers / 10000 + ']';
        }
    }

    // Update bets.
    async function updateBets(spin){
        (await roulette.getBets(spin.hash)).forEach(function(bet){
            if(!(bet.user in state.bets)){
                state.bets[bet.user] = {};
                state.peers[bet.user] = {color: userColor(bet.user)};
            }
            if(!(bet.id in state.bets[bet.user])){
                state.bets[bet.user][bet.id] = bet;
                drawBet(bet);
            }
        });
        updatePlayersBox();
    }

    // Update the felt.
    // The oldResolve argument is used to maintain resolve function
    // persistance, and thus to keep a promise, across timeouts.
    function updateFelt(spin, oldResolve){
        return new Promise(function(resolve){
            if(oldResolve){
                resolve = oldResolve;
            }

            updateBets(spin);
            let now = Math.round(new Date() / 1000);
            if(now < spin.maxbettime){
                document.getElementById('sec-left').innerText = spin.maxbettime - now;
                setTimeout(function(){updateFelt(spin, resolve);}, 1000);
            }else{
                document.getElementById('sec-left').innerText = '-';
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
        addLogLine('waiting for result');
        return await roulette.getWinningNumber(spin);
    }

    // Animate a win.
    function drawWin(chip){
        chip.addEventListener('transitionend', function(){chip.parentElement.removeChild(chip);}, {once: true});
        chip.style.transition = 'all 1s ease-in';
        chip.style.transform = 'scale(10)';
    }

    // Animate a lose.
    function drawLose(chip){
        chip.addEventListener('transitionend', function(){chip.parentElement.removeChild(chip);}, {once: true});
        chip.style.transition = 'all 1s ease-in';
        chip.style.transform = 'rotateX(1000deg)';
    }

    // Resolve the spin.
    function resolveSpin(winning_number, resolve){
        addResultToHistory(winning_number);
        for(const [user, bets] of Object.entries(state.bets)){
            for(const bet of Object.values(bets)){
                if(bet.coverage.indexOf(winning_number) > -1){
                    showMessage(user + ' won ' + (
                        bet.larimers * (36 / bet.coverage.length)
                    ) + ' larimers');
                    if(user === roulette.account_name){
                        CHEER_SOUND.play();
                    }
                }
            }
        }
        LAYOUT.querySelectorAll('div.chip').forEach(function(chip){
            if(chip.parentElement.dataset.coverage.split(',').some(function(covered){
                return parseInt(covered, 10) === winning_number;
            })){
                return drawWin(chip);
            }
            return drawLose(chip);
        });
        state.bets = {};
        state.peers = {};
        state.spin = null;
        PLAYERS_BOX.querySelectorAll('[data-user]').forEach(element => element.fadeaway());
        setTimeout(resolve, 3000);
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
        BALL_CONTAINER.style.opacity = '1';
        return new Promise(function(resolve){
            BALL_CONTAINER.addEventListener('transitionend', function(){
                resolveSpin(winning_number, resolve);
            }, {once: true});
            BALL_CONTAINER.style.transition = 'all ' + secondsPerTurn * turns + 's ease-in';
            var targetDeg = 1.5 * turns * -360 + winSlotDeg;
            BALL_CONTAINER.style.transform = 'rotate(' + targetDeg + 'deg)';
            BALL.style.transition = 'all ' + secondsPerTurn * turns + 's ease-out';
            BALL.style.transform = 'rotate(' + -1 * targetDeg + 'deg)';
        });
    }

    // Our lifeCycle.
    async function lifeCycle(){
        hideRoulette();
        state.spin = await getSpin();
        state.spin.maxbettime -= 3;
        await updateFelt(state.spin);
        showRoulette();
        await dropBall(await getResult(state.spin));
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
                document.getElementById('user').style.display = 'block';
                document.getElementById('connectBtn').style.display = 'none';
                CHIP_SELECTOR.getElementsByClassName('chip')[0].click();
                state.loginUpdater = setInterval(updateBalance, 1000);
                WELCOME_SOUND.play();
            }
        });
    }

    // Logout of scatter.
    function logout(){
        if(roulette.account_name === null){
            return showMessage('not logged in');
        }
        roulette.logout(function(){
            clearInterval(state.loginUpdater);
            document.getElementById('user').innerText = '';
            document.getElementById('connectBtn').style.display = 'block';
            GOODBYE_SOUND.play();
        });
    }

    // ensure click outside open Menu closes it
    function clickMenu(checkBox){
        function checkOutsideClick(mouseEvent) {
            if (!document.getElementById('menuToggle').contains(mouseEvent.target)) {
                checkBox.checked = false;
            }
        }

        // TODO how to ensure no further elements get the event?
        // As we discussed, make it a transparent div all over the viewport.
        if (checkBox.checked) {
            window.addEventListener('mousedown', checkOutsideClick);
        } else {
            window.removeEventListener('mousedown', checkOutsideClick);
        }
    }

    window.onload = function(){
        // Set howler's volume according to cookie so we don't go mad.
        // Use `document.cookie = 'volume=[value]'` in the console to set the cookie.
        try{
            Howler.volume(document.cookie.match(/(^|;)volume=([^;]*)/)[2]);
        }catch(error){
            console.error('no volume cookie found');
        }

        // Initialize DOM "constants".
        MAIN = document.getElementById('main-space');
        LOG = document.getElementById('log');
        LAYOUT = document.getElementById('layout');
        WHEEL = document.getElementById('wheel');
        BALL_CONTAINER = document.getElementById('ballContainer');
        BALL = document.getElementById('ball');
        CHIP_SELECTOR = document.getElementById('chip-selector');
        PLAYERS_BOX = document.getElementById('players-box').children[0];
        LAYOUT.rect = LAYOUT.getBoundingClientRect();

        // FIXME Just for debug.
        login();

        // Initialize game.
        initLayout(LAYOUT);
        lifeCycle();
    };

    // Expose some functionality.
    window.rouletteClient = {
        login: login,
        logout: logout,
        selectChip: selectChip,
        hintsShown: false,
        startIntro: function(){introJs().start();},
        toggleHints: function(){
            introJs()[window.rouletteClient.hintsShown ? 'hideHints' : 'showHints']();
            window.rouletteClient.hintsShown = !window.rouletteClient.hintsShown;
        },
        clickMenu: clickMenu,

        // FIXME This is for debug only.
        state: state
    };
}());
