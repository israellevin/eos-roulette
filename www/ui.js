// jshint esversion: 8
(function(){
    'use strict';

    // Global element constants, initialized later (so not technically constants).
    let MAIN;
    let LOG;
    let MESSAGE;
    let BALANCE;
    let LAYOUT;
    let WHEEL;
    let BALL_CONTAINER;
    let BALL;
    let CHIP_SELECTOR;
    let PLAYERS_BOX;

    // Sounds.
    // Avoids silly browser error.
    Howler.usingWebAudio = false;
    const SOUNDS = {
        CLICK: new Howl({src: ['sounds/click.wav']}),
        CHEER: new Howl({src: ['sounds/cheers.ogg']}),
        WELCOME: new Howl({src: ['sounds/welcome.wav'], volume:0.5}),
        GOODBYE: new Howl({src: ['sounds/goodbye.wav']}),
        COIN: new Howl({src: ['sounds/coin.wav']}),
        NO_MORE_BETS: new Howl({src: ['sounds/no_more.wav'], volume:0.3 }),
    };

    // Global id of user details update interval.
    let loginUpdater;

    // Add log line.
    function addLogLine(line){
        LOG.innerHTML = line + '<br>' + LOG.innerHTML;
    }

    // Show a message.
    function showMessage(message){
        addLogLine(MESSAGE.innerText = message);
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

    // Hide the roulette.
    function hideRoulette(){
        WHEEL.style.opacity = '0';
        BALL_CONTAINER.style.transitionDelay = '3s';
        BALL_CONTAINER.style.opacity = '0';
        BALL_CONTAINER.style.transform = 'rotate(0deg)';
        BALL.style.transform = 'rotate(0deg)';
        changeClass(LAYOUT, 'eventless', false);
    }

    // Select a chip to set the bet size.
    function selectChip(mouseEvent){
        const chip = mouseEvent.currentTarget;
        const playerEntry = getPlayerEntry(roulette.scatter.account_name);
        const oldChip = playerEntry.querySelector('div.chip');
        changeClass(CHIP_SELECTOR.querySelector('div.chip:not(.iso)'), 'iso', true);
        changeClass(chip, 'iso', false);
        CHIP_SELECTOR.scrollTo({
            left: chip.offsetLeft - chip.parentElement.parentElement.clientWidth / 2 + 14, top: 0,
            behavior: 'smooth'
        });

        let newChip = chip.cloneNode(true);
        newChip.dataset.y = oldChip.dataset.y;
        changeClass(newChip, 'small', true);
        playerEntry.replaceChild(newChip, oldChip);
        showMessage('Each chip now worth ' + (chip.dataset.value / 10000) + ' EOS');
    }

    // Get a chip target cell and position relative to it from a coverage.
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
        chip.dataset.y = chip.getBoundingClientRect().y;
        return playerEntry;
    }

    // Get a new user chip to place on the layout.
    function createChip(user, larimers){
        let chip = getPlayerEntry(user).querySelector('div.chip').cloneNode(true);
        changeClass(chip, 'eventless', true);
        if(larimers){
            chip.className = 'chip small larimers' + larimers / 1000 + 'k';
        }
        return chip;
    }

    // Highlight potential bet and move betting chip if it exists.
    function highlightBet(mouseEvent, coverage){
        changeClass(LAYOUT.querySelectorAll('[data-coverage]'), 'highlight', false);
        changeClass(LAYOUT.querySelectorAll('[data-coverage]'), 'low-highlight', false);
        changeClass(mouseEvent.currentTarget, 'low-highlight', true);
        coverage.forEach(function(number){
            changeClass(LAYOUT.querySelector('[data-coverage="' + number + '"]'), 'low-highlight', false);
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

    // Place a temp chip on the layout.
    function placeChip(chip, coverage){
        const chipPosition = getChipPosition(coverage);
        if(chip.dataset.user === roulette.scatter.account_name){
            chip.style = '';
            changeClass(chip, 'temporary', true);
        }
        changeClass(chip, chipPosition.positions.concat(['small']), true);
        chipPosition.target.appendChild(chip);

        // Add some identifying data to the chip.
        chip.dataset.coverage = coverage;
        chip.dataset.user = roulette.scatter.account_name;
        chip.placed = true;
    }

    // Draw a bet on the felt.
    function drawBet(bet){
        let chip = LAYOUT.querySelector('div.chip[data-coverage="' + bet.coverage + '"][data-user="' + roulette.scatter.account_name + '"]');
        if(bet.user === roulette.scatter.account_name){
            if(chip){
                changeClass(chip, 'temporary', false);
            }else{
                chip = createChip(bet.user, bet.larimers);
                changeClass(chip, 'iso', false);
                chip.dataset.user = bet.user;
                placeChip(chip, bet.coverage);
                changeClass(chip, 'temporary', false);
            }
            SOUNDS.CLICK.play();
        }else{
            // for now, space other players bets
            setTimeout(function(){
                chip = createChip(bet.user);
                chip.dataset.user = bet.user;
                placeChip(chip, bet.coverage);
                SOUNDS.CLICK.play();
                }, 5000 * Math.random());
        }
        addLogLine(bet.user + ' placed ' + bet.larimers + ' larimers on ' + bet.coverage);
    }

    // Update the players box.
    function updatePlayersBox(bets){
        let betsIterator = Object.entries(bets);

        //// FIXME Demo only. Insert data for players who should always be there.
        ['alice', 'bob', 'carol'].forEach(function(user){
            if(!(user in bets)){
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

    // Show the roulette.
    function showRoulette(){
        showMessage('No more bets please');
        changeClass(LAYOUT, 'eventless', true);
        WHEEL.style.opacity = '1';
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

    // Clone a chip for win animation.
    function cloneChip(chip, chipRect, multiplier, index){
        chip.style.transition = 'all ' + (0.1 + chipRect.y / 1500) + 's ease-in';
        let replica = chip.cloneNode(false);
        replica.addEventListener('transitionend', function(){
                replica.parentElement.removeChild(replica);
                SOUNDS.COIN.play();
            },
            {once: true}
        );
        MAIN.appendChild(replica);
        let overlayY = chipRect.y - MAIN.rect.y + chipRect.height / 2;
        let overlayX = chipRect.x - MAIN.rect.x + chipRect.width / 2;
        overlayY -= index * 2;
        replica.style.top = overlayY + 'px';
        replica.style.left = overlayX + 'px';
        window.requestAnimationFrame(function(){
            replica.style.transitionDelay = (0.1 + (multiplier - index) / (multiplier + 2)) + 's';
            window.requestAnimationFrame(function(){
                replica.style.top = (chip.dataset.y - MAIN.rect.y) + 'px';
                replica.style.left = '250px';
            });
        });
    }

    // Animate a win.
    function drawWin(chip){
        let chipRect = chip.getBoundingClientRect();
        // how many coins will fly, never more than 12
        let multiplier = Math.min(12, 36 / chip.parentElement.dataset.coverage.length);
        for(let index = 0; index < multiplier; index++){
            cloneChip(chip, chipRect, multiplier, index);
        }
        chip.parentElement.removeChild(chip);
    }

    // Animate a lose.
    function drawLose(chip){
        chip.addEventListener('transitionend', () => chip.parentElement.removeChild(chip), {once: true});
        chip.style.transition = 'all 1s ease-in';
        chip.style.transform = 'translateY(400px)';
    }

    function cleanChips(winningNumber){
        let houseChips = [];
        let wonChips = [];
        LAYOUT.querySelectorAll('div.chip').forEach(function(chip){
            if(chip.dataset.coverage.split(',').some(function(covered){
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

    // Initialize UI.
    function init(){
        initVolume();
        MAIN = window.roulette.ui.MAIN = document.getElementById('main-space');
        LOG = window.roulette.ui.LOG = document.getElementById('log');
        MESSAGE = window.roulette.ui.MESSAGE = document.getElementById('message');
        BALANCE = window.roulette.ui.BALANCE = document.getElementById('balance');
        LAYOUT = window.roulette.ui.LAYOUT = document.getElementById('layout');
        WHEEL = window.roulette.ui.WHEEL = document.getElementById('wheel');
        BALL_CONTAINER = window.roulette.ui.BALL_CONTAINER = document.getElementById('ballContainer');
        BALL = window.roulette.ui.BALL = document.getElementById('ball');
        CHIP_SELECTOR = window.roulette.ui.CHIP_SELECTOR = document.getElementById('chip-selector');
        PLAYERS_BOX = window.roulette.ui.PLAYERS_BOX = document.getElementById('players-box').children[0];
        LAYOUT.rect = LAYOUT.getBoundingClientRect();
        MAIN.rect = MAIN.getBoundingClientRect();
        CHIP_SELECTOR.querySelectorAll('div.chip').forEach(chip => chip.addEventListener('click', selectChip));
        return window.roulette.ui;
    }

    // Login to scatter.
    function login(){
        if(roulette.scatter.account_name !== null){
            return showMessage('already logged in');
        }
        roulette.scatter.login(function(account_name){
            if(account_name){
                document.getElementById('user').innerText = account_name;
                document.getElementById('user').style.display = 'block';
                document.getElementById('connectBtn').style.display = 'none';
                CHIP_SELECTOR.getElementsByClassName('chip')[0].click();
                loginUpdater = setInterval(updateBalance, 1000);
                SOUNDS.WELCOME.play();
            }
        });
    }

    // Update the user's balance.
    async function updateBalance(){
        if(roulette.scatter.account_name === null){
            return console.error('can not get balance when disconnected');
        }
        BALANCE.innerText = await roulette.client.getBalance();
    }

    // Logout of scatter.
    function logout(){
        if(roulette.scatter.account_name === null){
            return showMessage('not logged in');
        }
        roulette.scatter.logout(function(){
            clearInterval(loginUpdater);
            document.getElementById('user').innerText = '';
            document.getElementById('connectBtn').style.display = 'block';
            SOUNDS.GOODBYE.play();
        });
    }

    // Expose some functionality.
    window.roulette.ui = {
        init: init,
        login: login,
        logout: logout,
        changeClass: changeClass,
        showMessage: showMessage,
        addLogLine: addLogLine,
        hideRoulette: hideRoulette,
        createChip: createChip,
        highlightBet: highlightBet,
        updatePlayersBox: updatePlayersBox,
        drawBet: drawBet,
        cleanChips: cleanChips,
        placeChip: placeChip,
        showRoulette: showRoulette,
        displayResult: displayResult,
        SOUNDS: SOUNDS
    };
}());
