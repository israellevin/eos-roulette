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
    let CLICK_SOUND;
    let CHEER_SOUND;
    let WELCOME_SOUND;
    let GOODBYE_SOUND;
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
        if(LAYOUT.querySelector('[data-coverage="' + number + '"]').classList.contains('red')) return 'red';
        if(LAYOUT.querySelector('[data-coverage="' + number + '"]').classList.contains('black')) return 'black';
        return 'green';
    }

    // Add or remove classes to an element or an HTMLCollection.
    function changeClass(elements, classNames, add){
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
        changeClass(entry, getColor(winning_number), true);
        let list = document.getElementById('history-ul');
        list.insertBefore(entry, list.childNodes[0]);
    }

    // Get the target cell and position relative to it of a jeton from a coverage.
    function getJetonPosition(coverage){
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
        if(!('coverage' in cell.dataset && cell.dataset.coverage)) throw 'illegal target: ' + cell.tagName;
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
    async function bet(coverage, larimers){
        if(rouletteClient.spin === null){
            return showMessage('No spins currently in progress');
        }
        if(36 % coverage.length !== 0){
            return showMessage('coverage size must divide 36');
        }
        return new Promise(async function(resolve, reject){
            try{
                return resolve((await roulette.bet(
                    rouletteClient.spin.hash, coverage, parseInt(larimers, 10), +new Date()
                )).processed.action_traces[0].act.data.hash);
            }catch(error){
                return reject(error);
            }
        });
    }

    // Place a bet on the layout.
    async function placeBet(mouseEvent, chip){
        let coverage = getCoverage(mouseEvent);
        let hash = await bet(coverage, rouletteClient.bet_size);
        CLICK_SOUND.play();
        let jetonPosition = getJetonPosition(coverage);
        chip.style.top = chip.style.left = '';
        changeClass(chip, jetonPosition.positions.concat(['small', 'eventless']), true);
        jetonPosition.target.appendChild(chip);
        console.info(hash);
        addLogLine(
            roulette.account_name + ' placed ' + rouletteClient.bet_size +
            ' larimers on ' + coverage
        );
        rouletteClient.coverage = coverage;
    }

    // Show a potential bet.
    async function hoverBet(mouseEvent){
        if(roulette.account_name === null){
            return showMessage('Must be logged in to bet');
        }
        if(rouletteClient.bet_size === null){
            return showMessage('No bet size selected');
        }

        let originChip = CHIP_SELECTOR.querySelector('.chip:not(.iso)');
        let chip = originChip.cloneNode(true);
        changeClass(chip, 'eventless', true);
        document.addEventListener('mouseup', function(){
            chip.parentElement.removeChild(chip);
        }, {once: true});
        chip.addEventListener('transitionend', function(){
            chip.style.transition = 'all 0s linear';
            document.addEventListener('mouseup', function(mouseEvent){placeBet(mouseEvent, chip);}, {once: true});
        }, {once: true});

        window.requestAnimationFrame(function(){
            LAYOUT.appendChild(chip);
                chip.style.position = 'absolute';
                chip.style.left = '250px';
                chip.style.top = '450px';
            chip.style.transition = 'all 0.5s ease-in';
            window.requestAnimationFrame(function(){
                chip.style.left = (mouseEvent.clientX - LAYOUT.rect.left) + 'px';
                chip.style.top = (mouseEvent.clientY - LAYOUT.rect.top) + 'px';
            });
        });
    }

    // Highlight potential bet and move betting jeton if it exists.
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
        LAYOUT.addEventListener('mouseleave', function(mouseEvent){
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

    // Select a token to set the bet size.
    function selectToken(element, value){
        rouletteClient.bet_size = value * 10000;
        CHIP_SELECTOR.scrollTo({
            left: element.offsetLeft - element.parentElement.parentElement.clientWidth/ 2 + 14, top: 0,
            behavior: 'smooth'
        });
        changeClass(CHIP_SELECTOR.querySelectorAll('.chip'), 'iso', true);
        changeClass(element, 'iso', false);
        showMessage('Each token now worth ' + value + ' EOS');
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
        addLogLine('waiting for result');
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
        BALL_CONTAINER.style.opacity = '1';
        return new Promise(function(resolve){
            // callback for completion of ball drop transition
            function ballOnWinningNumber(){
                addResultToHistory(winning_number);
                if(rouletteClient.coverage.indexOf(winning_number) >=  0){
                    showMessage(roulette.account_name + ' won ' + (
                        5000 * (36 / rouletteClient.coverage.length)
                    ) + ' larimers');
                    CHEER_SOUND.play();
                }
                setTimeout(resolve, 5000);
            }
            BALL_CONTAINER.addEventListener('transitionend', ballOnWinningNumber, {once: true});
            BALL_CONTAINER.style.transition = 'all ' + secondsPerTurn * turns + 's ease-in';
            var targetDeg = 1.5 * turns * -360 + winSlotDeg;
            BALL_CONTAINER.style.transform = 'rotate(' + targetDeg + 'deg)';
            BALL.style.transition = 'all ' + secondsPerTurn * turns + 's ease-out';
            BALL.style.transform = 'rotate(' + -1*targetDeg + 'deg)';
        });
    }

    // Our lifeCycle.
    async function lifeCycle(){
        login();
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
            clearInterval(rouletteClient.updater);
            document.getElementById('user').innerText = '';
            document.getElementById('connectBtn').style.display = 'block';
            GOODBYE_SOUND.play();
        });
    }

    window.onload = function(){
        MAIN = document.getElementById('main-space');
        LOG = document.getElementById('log');
        LAYOUT = document.getElementById('layout');
        WHEEL = document.getElementById('wheel');
        BALL_CONTAINER = document.getElementById('ballContainer');
        BALL = document.getElementById('ball');
        CHIP_SELECTOR = document.getElementById('chip-selector');
        LAYOUT.rect = LAYOUT.getBoundingClientRect();
        initLayout(LAYOUT);
        lifeCycle();

        CLICK_SOUND = new Howl({src: ['sounds/click.wav']});
        CHEER_SOUND= new Howl({src: ['sounds/cheers.ogg']});
        WELCOME_SOUND= new Howl({src: ['sounds/welcome.wav']});
        GOODBYE_SOUND= new Howl({src: ['sounds/goodbye.wav']});

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
