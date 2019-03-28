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
    const WELCOME_SOUND = new Howl({src: ['sounds/welcome.wav'], volume:0.5});
    const GOODBYE_SOUND = new Howl({src: ['sounds/goodbye.wav']});
    const COIN_SOUND = new Howl({src: ['sounds/coin short 2.wav']});
    const NO_MORE_BETS_SOUND = new Howl({src: ['sounds/no more bets please.wav'], volume:0.3 });

    // Global state variables.
    let state = {
        bets: {},
        lastBets: {},
        spin: null,
        winningNumber: null,
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

    // Add a roulette winning number to the history and mark the winning cell.
    function displayResult(winning_number){
        showMessage('Roulette stops on ' + winning_number + '!');
        let entry = document.createElement('li');
        entry.appendChild(document.createTextNode(winning_number));
        changeClass(entry, getNumberColor(winning_number), true);
        let list = document.getElementById('history-ul');
        list.insertBefore(entry, list.childNodes[0]);

        let winning_cell = LAYOUT.querySelector('[data-coverage="' + winning_number + '"]');
        changeClass(winning_cell, 'winning-number', true);
        setTimeout(function(){
            changeClass(winning_cell, 'winning-number', false);
        }, 4000);

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

        let chip = getPlayerEntry(user).querySelector('.chip');
        changeClass(chip, 'iso', false);
        return chip;
    }

    // Select a chip to set the bet size.
    function selectChip(mouseEvent){
        const chip = mouseEvent.currentTarget;
        const playerEntry = getPlayerEntry(roulette.account_name);
        const oldChip = playerEntry.querySelector('div.chip');

        changeClass(CHIP_SELECTOR.querySelector('div.chip:not(.iso)'), 'iso', true);
        changeClass(chip, 'iso', false);
        CHIP_SELECTOR.scrollTo({
            left: chip.offsetLeft - chip.parentElement.parentElement.clientWidth / 2 + 14, top: 0,
            behavior: 'smooth'
        });
        showMessage('Each chip now worth ' + (chip.dataset.value / 10000) + ' EOS');

        let newChip = chip.cloneNode(true);
        newChip.dataset.y = oldChip.dataset.y;
        changeClass(newChip, 'small', true);
        playerEntry.replaceChild(newChip, oldChip);
    }

    // Place a bet on the layout.
    async function placeBet(mouseEvent){
        try{
            let coverage = getCoverage(mouseEvent);
            let larimers = getChip().dataset.value;
            let hash = await bet(coverage, larimers);
            console.info(hash, coverage);
        // Placement failed.
        }catch(error){
            console.error('placement failed', error);
            LAYOUT.querySelectorAll('#layout > .chip').forEach(chip => chip.parentElement.removeChild(chip));
        }
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

        let chip = selectedChip.cloneNode(true);
        changeClass(chip, 'eventless', true);

        // Remove the chip if the user did not follow through.
        function removeChip(){
            chip.removeEventListener('transitionend', useChip);
            chip.style.left = LAYOUT.rect.width - 20 + 'px';
            chip.style.top = LAYOUT.rect.height - 20 + 'px';
            setTimeout(() => chip.parentElement.removeChild(chip), 300);
        }
        document.addEventListener('mouseup', removeChip, {once: true});

        // Use the chip to make a bet if the user follows through.
        function useChip(){
            chip.used = true;
            document.removeEventListener('mouseup', removeChip);
            document.addEventListener('mouseup', function(mouseEvent){
                chip.placed = true;
                changeClass(chip, 'temporary', true);
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
    function highlightBet(mouseEvent){
        changeClass(LAYOUT.querySelectorAll('[data-coverage]'), 'highlight', false);
        let coverage = getCoverage(mouseEvent);
        coverage.forEach(function(number){
            changeClass(LAYOUT.querySelector('[data-coverage="' + number + '"]'), 'highlight', true);
        });
        let chip = LAYOUT.querySelector('#layout > .chip');
        if(chip && (!chip.placed)){
            if(chip.used){
                chip.style.transition = 'none';
            }else{
                chip.style.transition = 'all 0.1s linear';
            }
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
        MAIN.addEventListener('mousemove', function(mouseEvent){
            const bettingChip = LAYOUT.querySelector('#layout > .chip');
            if(bettingChip && (!bettingChip.placed)){
                bettingChip.style.opacity = LAYOUT.contains(mouseEvent.target) ? 1 : 0;
            }
        });
        layout.querySelectorAll('[data-coverage]').forEach(function(tdElement){
            tdElement.addEventListener('mousemove', highlightBet);
            tdElement.addEventListener('mousedown', hoverBet);
            let val = tdElement.dataset.coverage;
            if(val.indexOf(',') < 0){
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
        let chip;
        if(bet.user === roulette.account_name){
            chip = CHIP_SELECTOR.querySelector('div.chip[data-value="' + bet.larimers + '"]').cloneNode(true);
            chip.dataset.y = '120'; //send earnings to palyers box instead of selector
            changeClass(chip, 'iso', false);
        }else{
            chip = getChip(bet.user).cloneNode(true);
        }
        let chipPosition = getChipPosition(bet.coverage);
        changeClass(chip, chipPosition.positions.concat(['small', 'eventless']), true);
        chip.appendChild(document.createTextNode(bet.larimers / 10000));

        // TODO Make this pretty with a cool animation.
        if(bet.user === roulette.account_name){
            LAYOUT.querySelectorAll('#layout > .chip').forEach(chip => chip.parentElement.removeChild(chip));
            CLICK_SOUND.play();
            chipPosition.target.appendChild(chip);
        // for now, space other players bets
        }else{
            setTimeout(function(){
                chipPosition.target.appendChild(chip);
                CLICK_SOUND.play();
                }, 5000 * Math.random());
        }

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
    function getPlayerEntry(user){
        let playerEntry = PLAYERS_BOX.querySelector('[data-user="' + user + '"]');
        if(playerEntry){
            return playerEntry;
        }

        // TODO create a complex div with chip, user, bet info, etc
        playerEntry = document.createElement('li');
        playerEntry.style.position = 'relative';
        playerEntry.style.height = '1.8em';
        playerEntry.dataset.user = user;
        playerEntry.innerHTML = `<span style="padding-left: 20px">${user}</span><span class="larimers"></span>`;

        let chip = CHIP_SELECTOR.querySelector('div.chip').cloneNode(true);
        changeClass(chip, 'small', true);
        changeClass(chip, 'iso', false);
        chip.style.setProperty('--chip-face', userColor(user));
        playerEntry.appendChild(chip);

        PLAYERS_BOX.appendChild(playerEntry);
        chip.dataset.y = chip.getBoundingClientRect().y; //store screen location with chip
        return playerEntry;
    }

    // Update the players box.
    function updatePlayersBox(){
        let betsIterator = Object.entries(state.bets);

        // FIXME Demo only. Insert data for players who should always be there.
        ['alice', 'bob', 'carol'].forEach(function(user){
            if(!(user in state.bets)){
                betsIterator.push([user, []]);
            }
        });

        for(const [user, bets] of betsIterator){
            // Map the values of all this user's bets to an array of larimer values, then reduce it to it's sum.
            let totalLarimers = Object.values(bets).map(bet => bet.larimers).reduce(
                (sum, current) => sum + current, 0
            );
            let playerEntry = getPlayerEntry(user);
            playerEntry.querySelector('.larimers').innerText = '[' + totalLarimers / 10000 + ']';
        }
    }

    // Update bets.
    async function updateBets(spin){
        (await roulette.getBets(spin.hash)).forEach(function(bet){
            if(!(bet.user in state.bets)){
                state.bets[bet.user] = {};
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
        let overlay = MAIN;
        let chipRect = chip.getBoundingClientRect();
        // FIXME Should probably be one of our "consts".
        let overlayRect = overlay.getBoundingClientRect();
        // how many coins will fly, never more than 12
        let multiplier = Math.min(12, 36 / chip.parentElement.dataset.coverage.length);
        chip.style.transition = 'all ' + (0.1 + chipRect.y / 1500) + 's ease-in';
        chip.parentElement.removeChild(chip);
        for(let i = 0; i < multiplier; i++){
            let replica = chip.cloneNode(false);
            replica.addEventListener('transitionend', () => {
                    replica.parentElement.removeChild(replica);
                    COIN_SOUND.play();
                },
                {once: true});
            overlay.appendChild(replica);
            let overlayY = chipRect.y - overlayRect.y + chipRect.height / 2;
            let overlayX = chipRect.x - overlayRect.x + chipRect.width / 2;
            overlayY -= i * 2;
            replica.style.top = overlayY + 'px';
            replica.style.left = overlayX + 'px';
            window.requestAnimationFrame(function(){
                replica.style.transitionDelay = (0.1 + (multiplier - i) / (multiplier + 2)) + 's';
                window.requestAnimationFrame(function(){
                    replica.style.top = (chip.dataset.y - overlayRect.y) + 'px';
                    replica.style.left = '250px';
                });
            });
        }
        // chip.parentElement.removeChild(chip);
    }

    // Animate a lose.
    function drawLose(chip){
        chip.addEventListener('transitionend', () => chip.parentElement.removeChild(chip), {once: true});
        chip.style.transition = 'all 1s ease-in';
        chip.style.transform = 'translateY(400px)';
    }

    // Resolve the spin.
    function resolveSpin(winning_number, resolve){
        displayResult(winning_number);
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
        //clear moving chip - just in case
        LAYOUT.querySelectorAll('#layout > .chip').forEach(chip =>
            console.error('orphan chip', chip.parentElement.removeChild(chip)));
        try{
            state.lastBets = state.bets[roulette.account_name];
        }catch(error){}
        state.bets = {};
        state.spin = null;
        resolve();  //fixme - do we need?
    }

    // Drop the ball and reveal the winner.
    function dropBall(winning_number){
        const LAYOUT_NUMBERS = [
            0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
            5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
        ];
        const winSlotDeg = 360 / 37 * LAYOUT_NUMBERS.indexOf(winning_number);
        const secondsPerTurn = 1.5;
        const turns = 2;
        BALL_CONTAINER.style.opacity = '1';
        return new Promise(function(resolve){
            BALL_CONTAINER.addEventListener('transitionend', function(){
                resolveSpin(winning_number, resolve);
            }, {once: true});
            BALL_CONTAINER.style.transition = 'all ' + secondsPerTurn * turns + 's ease-in';
            let targetDeg = 1.5 * turns * -360 + winSlotDeg;
            BALL_CONTAINER.style.transform = 'rotate(' + targetDeg + 'deg)';
            BALL.style.transition = 'all ' + secondsPerTurn * turns + 's ease-out';
            BALL.style.transform = 'rotate(' + -1 * targetDeg + 'deg)';
        });
    }

    async function cleanChips(winningNumber){
        let houseChips = [];
        let wonChips = [];
        LAYOUT.querySelectorAll('div.chip').forEach(function(chip){
            if(chip.parentElement.dataset.coverage.split(',').some(function(covered){
                return parseInt(covered, 10) === winningNumber;
            })){
                wonChips.push(chip);
            } else {
                houseChips.push(chip);
            }
        });
        houseChips.forEach(function(chip){
            drawLose(chip);
        });
        setTimeout(function(){
            wonChips.forEach(function(chip){
                return drawWin(chip);
            });
        }, 800);
    }

    // Our lifeCycle.
    async function lifeCycle(){
        hideRoulette();
        // noinspection InfiniteLoopJS
        while (true) {
            state.spin = await getSpin();
            state.spin.maxbettime -= 3;
            await updateFelt(state.spin);
            NO_MORE_BETS_SOUND.play();
            showRoulette();
            let winningNumber = await getResult(state.spin);
            await dropBall(winningNumber);
            await cleanChips(winningNumber);
            hideRoulette();
        }
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

    // Repeat last bet.
    async function rebet(){
        for(const oldBet of Object.values(state.lastBets)){
            await bet(oldBet.coverage, oldBet.larimers);
        }
    }

    // ensure click outside open Menu closes it
    function clickMenu(checkBox){
        let overlay = document.getElementById("overlay");
        if(checkBox.checked){
            overlay.style.display = 'block';
            overlay.addEventListener('mousedown', function(){
                checkBox.checked = false;
                overlay.style.display = 'none';
            }, {once: true});
        } else {
            overlay.style.display = 'none';
        }
    }

    // Initialize volume handling.
    function initVolume(){
        const muteBox = document.getElementById('muteBox');
        let volume;
        try{
            volume = document.cookie.match(/(^|;)volume=([^;]*)/)[2];
        }catch(error){
            console.error('no volume cookie found');
            volume = '0.6';
        }
        Howler.volume(volume);
        muteBox.checked = volume > 0;
        muteBox.addEventListener('change', function(checkboxEvent){
            volume = checkboxEvent.target.checked ? 0.6 : 0;
            Howler.volume(volume);
            document.cookie = 'volume=' + volume;
        });

    }

    window.onload = function(){
        initVolume();

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

        // Initialize UI.
        CHIP_SELECTOR.querySelectorAll('div.chip').forEach(chip => chip.addEventListener('click', selectChip));
        initLayout(LAYOUT);

        // Start rolling.
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
        rebet: rebet,

        // FIXME This is for debug only.
        state: state
    };
}());
