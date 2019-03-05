// jshint esversion: 8
(function(){
    'use strict';

    // Add log line.
    function addLogLine(line){
        document.getElementById('log').innerHTML = line + '<p>' + document.getElementById('log').innerHTML;
    }

    // Get color of number.
    function getColor(number){
        if(document.querySelectorAll('[data-bet="' + number + '"]')[0].classList.contains('red')) return 'red';
        if(document.querySelectorAll('[data-bet="' + number + '"]')[0].classList.contains('black')) return 'black';
        return 'green';
    }

    // add a roulette winning number to the history.
    function addResultToHistory(winning_number){
        const entry = document.createElement('li');
        entry.appendChild(document.createTextNode(winning_number));
        entry.classList.add(getColor(winning_number));
        let list = document.getElementById("history-ul");
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

    // Animate a spinning roulette.
    function spinRoulette(winning_number){
        const LAYOUT_NUMBERS = [
            0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
            5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
        ];
        const winSlotDeg = 360 / 37 * LAYOUT_NUMBERS.indexOf(winning_number);
        const shift =  Math.floor(Math.random() * 360);
        const secondsPerTurn = 1.5;
        const wheel = document.getElementById('wheel');
        const ball = document.getElementById('ball');
        let turns = 2;

        wheel.style.transition = 'all ' + secondsPerTurn * turns + 's linear';
        wheel.style.transform = 'rotate(' + (turns * -360 + shift) + 'deg)';
        ball.style.transition = 'all ' + secondsPerTurn * turns + 's ease-out';
        ball.style.transform = 'rotate(' + (1.5 * turns * 360 + winSlotDeg) + 'deg)  translateY(0px)';

        const transition_end = function(){
            wheel.removeEventListener('transitionend', transition_end);
            wheel.style.transition = 'all ' + secondsPerTurn * (2 + turns) + 's ease-out';
            wheel.style.transform = 'rotate(' + ((2 + turns) * -360 + shift) + 'deg)';
            ball.style.transition = 'all 0.4s ease-in';
            ball.style.transform = 'rotate(' + (1.5 * turns * 360 + winSlotDeg) + 'deg) translateY(36px)';
        };
        wheel.addEventListener('transitionend', transition_end);
    }

    // Place a bet.
    async function processBet(coverage, larimers){
        if(rouletteClient.spin === null){
            return console.error('no spin to bet on');
        }
        if(36 % coverage.length !== 0){
            console.error('coverage size must divide 36');
            return false;
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
            if(rouletteClient.bet_size === null){
                return console.error('no bet size selected');
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

    // Update the bettors on a spin.
    async function updateBettors(hash){
        let bettors = await roulette.getBets(hash);
        let playersBox = document.getElementById('players-box');
        let playersBoxUl = playersBox.children[0];
        let newUL = playersBoxUl.cloneNode(false);
        bettors.forEach( function (fellow) {
            const playerEntry = document.createElement('li');
            playerEntry.innerHTML = '<i class="fa fa-dot-circle-o players-list-item"> </i>' +
                fellow.user +
                '<BR>bet:' + fellow.larimers/10000;
            newUL.appendChild(playerEntry);
        });
        playersBox.replaceChild(newUL, playersBoxUl);
    }

    // Update the spin data.
    async function updateSpin(){
        let now = Math.round(new Date() / 1000);
        if(rouletteClient.spin){
            if(now < rouletteClient.spin.maxbettime){
                document.getElementById('sec-left').innerText = rouletteClient.spin.maxbettime - now;
                updateBettors(rouletteClient.spin.hash);
            }else{
                document.getElementById('timer').style.display = 'none';
            }
        }else{
            rouletteClient.spin = await roulette.getSpin(now + 15);
            if(rouletteClient.spin){
                addLogLine('got spin ' + rouletteClient.spin.hash);
                document.getElementById('sec-left').style.display = 'block';
                roulette.poll(rouletteClient.spin, -1, function(result){
                    spinRoulette(result.winning_number);
                    addLogLine('Roulette stops on ' + result.winning_number + '!');
                    addResultToHistory(result.winning_number);
                    if(rouletteClient.coverage.indexOf(result.winning_number) > -1){
                        let message = roulette.account_name + ' won ' + (
                            5000 * (36 / rouletteClient.coverage.length)
                        ) + ' larimers';
                        document.getElementById('message').innerText = message;
                        addLogLine(message);
                    }
                    rouletteClient.spin = null;
                    rouletteClient.coverage = [];
                });
            }else{
                console.error('no available spins');
            }
        }
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

    // Expose some functionality.
    window.rouletteClient = {
        spin: null,
        bet_size: null,
        coverage: [],
        hintsShown: false,
        selectToken: selectToken,
        startIntro: function(){introJs().start();},
        toggleHints: function(){
            introJs()[rouletteClient.hintsShown ? 'hideHints' : 'showHints']();
            rouletteClient.hintsShown = !rouletteClient.hintsShown;
        },
        login: function(){
            if(roulette.account_name !== null){
                return console.error('already logged in');
            }
            roulette.login(function(account_name){
                if(account_name){
                    document.getElementById('user').innerText = account_name;
                    document.getElementById('connectBtn').style.display = 'none';
                    document.getElementById('chip-selector').getElementsByClassName('chip')[0].click();
                    rouletteClient.updater = setInterval(function(){updateBalance(); updateSpin();}, 1000);
                }
            });
        },
        logout: function(){
            if(roulette.account_name === null){
                return console.error('not logged in');
            }
            roulette.logout(function(){
                console.log('111', roulette.account_name);
                clearInterval(rouletteClient.updater);
                document.getElementById('user').innerText = '';
                document.getElementById('connectBtn').style.display = 'block';
            });
        }
    };

    // Initialize.
    window.onload = function(){
        rouletteClient.login();
        initLayout(document.getElementById('layout'));
    };

}());
