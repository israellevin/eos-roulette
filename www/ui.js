// UI module for eos-roulette.
// jshint esversion: 8
(function(){
    'use strict';

    let scatter;

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
    let PLAYERS_LIST;

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

    // Get the selected chip.
    function getSelectedChip(){
        return CHIP_SELECTOR.querySelector('div.chip:not(.iso)');
    }

    // Select a chip to set the bet size.
    function selectChip(mouseEvent){
        const chip = mouseEvent.currentTarget;
        const playerEntry = getPlayerEntry(scatter.account_name);
        const oldChip = playerEntry.querySelector('div.chip');
        changeClass(getSelectedChip(), 'iso', true);
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
        let playerEntry = PLAYERS_LIST.querySelector('[data-user="' + user + '"]');
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

        PLAYERS_LIST.appendChild(playerEntry);
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

    // Add temp chip to layout
    function addTempChip(chip, x, y){
        window.requestAnimationFrame(function(){
            LAYOUT.appendChild(chip);
            chip.style.position = 'absolute';
            chip.style.left = LAYOUT.rect.width - 20 + 'px';
            chip.style.top = LAYOUT.rect.height - 20 + 'px';
            chip.style.transition = 'all 0.4s ease-in';
            window.requestAnimationFrame(function(){
                chip.style.left = (x - LAYOUT.rect.left) + 'px';
                chip.style.top = (y - LAYOUT.rect.top) + 'px';
            });
        });
    }

    // Remove temp chip (or all temp chips, if not specified) from the layout.
    function removeTempChips(chip){
        if(!chip){
            return LAYOUT.querySelectorAll('div.chip.temporary').forEach(chip => chip.parentElement.removeChild(chip));
        }
        chip.style.left = LAYOUT.rect.width - 20 + 'px';
        chip.style.top = LAYOUT.rect.height - 20 + 'px';
        setTimeout(() => chip.parentElement.removeChild(chip), 300);
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

    // Place a chip on the layout.
    function placeChip(chip, coverage){
        const chipPosition = getChipPosition(coverage);
        if(chip.dataset.user === scatter.account_name){
            chip.style = '';
        }
        changeClass(chip, chipPosition.positions.concat(['small']), true);
        chipPosition.target.appendChild(chip);
        chip.dataset.coverage = coverage;
        chip.placed = true;
    }

    // Draw a bet on the felt.
    function drawBet(bet){
        if(bet.user === scatter.account_name){
            let chip = LAYOUT.querySelector(
                'div.chip[data-coverage="' + bet.coverage + '"][data-user="' + scatter.account_name + '"]');
            if(chip){
                changeClass(chip, 'temporary', false);
            }else{
                chip = createChip(bet.user, bet.larimers);
                changeClass(chip, 'iso', false);
                placeChip(chip, bet.coverage);
            }
            SOUNDS.CLICK.play();
        }else{
            // for now, space other players bets
            setTimeout(function(){
                placeChip(createChip(bet.user), bet.coverage);
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
                return setTimeout(resolve, 1000);
            }, {once: true});
            BALL_CONTAINER.style.transition = 'all ' + secondsPerTurn * turns + 's ease-in';
            let targetDeg = 1.5 * turns * -360 + winSlotDeg;
            BALL_CONTAINER.style.transform = 'rotate(' + targetDeg + 'deg)';
            BALL.style.transition = 'all ' + secondsPerTurn * turns + 's ease-out';
            BALL.style.transform = 'rotate(' + -1 * targetDeg + 'deg)';
        });
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
            if(!(chip.dataset.coverage)){
                removeTempChips(chip);
            }else if(chip.dataset.coverage.split(',').some(function(covered){
                return parseInt(covered, 10) === winningNumber;
            })){
                wonChips.push(chip);
            }else{
                houseChips.push(chip);
            }
        });
        houseChips.forEach(function(chip){
            drawLose(chip);
        });
        setTimeout(function(){
            wonChips.forEach(function(chip){
                drawWin(chip);
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
        scatter = window.roulette.scatter;
        initVolume();

        LAYOUT = document.getElementById('layout');
        LAYOUT.rect = LAYOUT.getBoundingClientRect();
        MAIN = document.getElementById('main-space');
        MAIN.rect = MAIN.getBoundingClientRect();
        CHIP_SELECTOR = document.getElementById('chip-selector');
        CHIP_SELECTOR.querySelectorAll('div.chip').forEach(chip => chip.addEventListener('click', selectChip));
        LOG = document.getElementById('log');
        MESSAGE = document.getElementById('message');
        BALANCE = document.getElementById('balance');
        WHEEL = document.getElementById('wheel');
        PLAYERS_LIST = document.getElementById('players-box');
        BALL_CONTAINER = document.getElementById('ballContainer');
        BALL = document.getElementById('ball');

        return LAYOUT;
    }

    // Update the user's balance.
    async function updateBalance(){
        if(scatter.account_name === null){
            return console.error('can not get balance when disconnected');
        }
        BALANCE.innerText = await roulette.client.getBalance();
    }

    // Login to scatter.
    function login(){
        if(scatter.account_name !== null){
            return showMessage('already logged in');
        }
        scatter.login(function(account_name){
            if(account_name){
                document.getElementById('user').innerText = account_name;
                document.getElementById('user').style.display = 'block';
                document.getElementById('connectBtn').style.display = 'none';
                CHIP_SELECTOR.getElementsByClassName('chip')[0].click();
                loginUpdater = setInterval(function(){
                    roulette.client.SOCKET.emit('heartbeat', scatter.account_name);
                    updateBalance();
                }, 1000);
                SOUNDS.WELCOME.play();
            }
        });
    }

    // Logout of scatter.
    function logout(){
        if(scatter.account_name === null){
            return showMessage('not logged in');
        }
        scatter.logout(function(){
            clearInterval(loginUpdater);
            document.getElementById('user').innerText = '';
            document.getElementById('connectBtn').style.display = 'block';
            SOUNDS.GOODBYE.play();
        });
    }

    // Show and hide menu.
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

    // Expose some functionality.
    window.roulette.ui = {
        init: init,
        login: login,
        logout: logout,
        clickMenu: clickMenu,
        changeClass: changeClass,
        showMessage: showMessage,
        addLogLine: addLogLine,
        hideRoulette: hideRoulette,
        getSelectedChip: getSelectedChip,
        createChip: createChip,
        addTempChip: addTempChip,
        removeTempChips: removeTempChips,
        highlightBet: highlightBet,
        drawBet: drawBet,
        updatePlayersBox: updatePlayersBox,
        cleanChips: cleanChips,
        placeChip: placeChip,
        showRoulette: showRoulette,
        dropBall: dropBall,
        displayResult: displayResult,
        SOUNDS: SOUNDS,
        startIntro: function(){introJs().start();},
        hintsShown: false,
        toggleHints: function(){
            introJs()[window.roulette.ui.hintsShown ? 'hideHints' : 'showHints']();
            window.roulette.ui.hintsShown = !window.roulette.ui.hintsShown;
        }
    };
}());
