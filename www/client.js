// eos-roulette game.
// jshint esversion: 8
(function(){
    'use strict';

    // External libs, initialized on load.
    let ui;
    let scatter;

    // Global state variables.
    let state = {
        bets: {},
        lastBets: {},
        spin: null,
        winningNumber: null,
    };

    // Initialize socket.
    const SOCKET = io.connect(location.protocol + '//' + document.domain + ':' + location.port);
    SOCKET.on('disconnect', function(){
        console.error('socket disconnected');
    });

    // Await reply on socket.
    function emit(call, data, call_back){
        return new Promise(function(resolve){
            SOCKET.once(call_back || call, function(data){
                resolve(data);
            });
            SOCKET.emit(call, data);
        });
    }

    // Send a bet to the roulette.
    function bet(coverage, larimers){
        if(state.spin === null){
            return ui.showMessage('No spins currently in progress');
        }
        if(36 % coverage.length !== 0){
            return ui.showMessage('coverage size must divide 36');
        }
        return new Promise(async function(resolve, reject){
            try{
                return resolve((await scatter.bet(
                    state.spin.hash, coverage, parseInt(larimers, 10), +new Date()
                )).processed.action_traces[0].act.data);
            }catch(error){
                return reject(error);
            }
        });
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

    // Place a bet on the layout.
    async function placeBet(coverage, larimers){
        try{
            const betData = await bet(coverage, larimers);
            console.info('new bet', betData);
            return betData;
        // Placement failed.
        }catch(error){
            console.error('placement failed', error);
            ui.removeTempChips();
        }
    }

    // Show a potential bet.
    function hoverBet(mouseEvent){
        if(scatter.account_name === null){
            return ui.showMessage('Must be logged in to bet');
        }

        if(state.spin === null){
            return ui.showMessage('No spins currently in progress');
        }

        if(ui.getSelectedChip() === null){
            return ui.showMessage('Please choose bet size');  // TODO open hint on selector
        }

        let chip = ui.createChip(scatter.account_name);
        ui.changeClass(chip, 'small', false);

        // Remove the chip if the user did not follow through.
        function removeChip(){
            chip.removeEventListener('transitionend', useChip);
            ui.removeTempChips(chip);
        }
        document.addEventListener('mouseup', removeChip, {once: true});

        // Use the chip to make a bet if the user follows through.
        function useChip(){  //TODO should this be in ui.js?
            document.removeEventListener('mouseup', removeChip);
            chip.used = true;
            document.addEventListener('mouseup', async function(mouseEvent){
                let coverage = getCoverage(mouseEvent);
                chip.dataset.user = scatter.account_name;
                ui.changeClass(chip, 'temporary', true);
                ui.placeChip(chip, coverage);
                chip.dataset.hash = await placeBet(coverage, chip.dataset.value);
            }, {once: true});
        }
        chip.addEventListener('transitionend', useChip, {once: true});

        ui.addTempChip(chip, mouseEvent.clientX, mouseEvent.clientY);
    }

    // Initialize an html element as a layout.
    // It is assumed that the element contains mouse sensitive elements with data-coverage attributes.
    function initLayout(layout){
        layout.addEventListener('mouseleave', function(){
            ui.changeClass(layout.querySelectorAll('[data-coverage]'), ['highlight', 'low-highlight'], false);
        });
        document.addEventListener('mousemove', function(mouseEvent){
            const bettingChip = layout.querySelector('#layout > .chip');
            if(bettingChip && (!bettingChip.placed)){
                bettingChip.style.opacity = layout.contains(mouseEvent.target) ? 1 : 0;
            }
        });
        layout.querySelectorAll('[data-coverage]').forEach(function(tdElement){
            tdElement.addEventListener('mousemove', mouseEvent => ui.highlightBet(mouseEvent, getCoverage(mouseEvent)));
            tdElement.addEventListener('mousedown', hoverBet);
            let val = tdElement.dataset.coverage;
            if(val.indexOf(',') < 0){
                let innerDiv = document.createElement('div');
                ui.changeClass(innerDiv, 'inner-td', true);
                tdElement.appendChild(innerDiv);
                let number = document.createElement('div');
                ui.changeClass(number, 'td-number', true);
                number.innerText = val;
                innerDiv.appendChild(number);
            }
        });
    }

    // Update bets.
    function updateBets(bets){
        bets.forEach(function(bet){
            if(!(bet.user in state.bets)){
                state.bets[bet.user] = {};
            }
            if(!(bet.id in state.bets[bet.user])){
                state.bets[bet.user][bet.id] = bet;
                ui.drawBet(bet);
            }
        });
    }

    // Get a spin, preserving the resolve function across retries.
    // The oldResolve argument is used to maintain resolve function
    // persistance, and thus to keep a promise, across timeouts.
    async function getSpin(oldResolve){
        ui.showMessage('Trying to get a spin...');
        const now = Math.round(new Date() / 1000);
        const spin = await emit('get_spin', now + (scatter.account_name ? 30 : 10));
        return new Promise(async function(resolve){
            if(oldResolve){
                resolve = oldResolve;
            }
            if(spin){
                ui.showMessage('Connected to spin ' + spin.hash.substr(0, 4));
                resolve(spin);
                await emit('monitor_spin', {spin_hash: spin.hash, user: scatter.account_name}, 'bettor_joined');
            }else{
                ui.showMessage('No spins found, will retry shortly');
                setTimeout(function(){getSpin(resolve);}, 3000);
            }
        });
    }

    // Update the felt.
    // The oldResolve argument is used to maintain resolve function
    // persistance, and thus to keep a promise, across timeouts.
    function updateFelt(spin, oldResolve){
        return new Promise(async function(resolve){
            if(oldResolve){
                resolve = oldResolve;
            }
            updateBets(await emit('get_bets', spin.hash));
            ui.updatePlayersBox(state.bets);
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

    // Get the result of a spin.
    async function getResult(spin){
        ui.addLogLine('waiting for result');
        return await emit('monitor_spin', {spin_hash: spin.hash, user: scatter.account_name}, 'winning_number');
    }

    // Resolve the spin.
    function resolveSpin(winning_number){
        ui.displayResult(winning_number);
        for(const [user, bets] of Object.entries(state.bets)){
            for(const bet of Object.values(bets)){
                if(bet.coverage.indexOf(winning_number) > -1){
                    ui.showMessage(user + ' won ' + (
                        bet.larimers * (36 / bet.coverage.length)
                    ) + ' larimers');
                    if(user === scatter.account_name){
                        ui.SOUNDS.CHEER.play();
                    }
                }
            }
        }
        //clear moving chip - just in case
        ui.removeTempChips();
        try{
            state.lastBets = state.bets[scatter.account_name];
        }catch(error){}
        state.bets = {};
        state.spin = null;
    }

    // Our lifeCycle.
    async function lifeCycle(){
        // noinspection InfiniteLoopJS
        let winningNumber;
        while (true) {
            ui.hideRoulette();
            await ui.cleanChips(winningNumber);
            state.spin = await getSpin();
            state.spin.maxbettime -= 3;
            await updateFelt(state.spin);
            ui.SOUNDS.NO_MORE_BETS.play();
            ui.showRoulette();
            winningNumber = await getResult(state.spin);
            await ui.dropBall(winningNumber);
            resolveSpin(winningNumber);
        }
    }

    window.onload = async function(){

        // Initialize libs.
        ui = window.roulette.ui;
        scatter = window.roulette.scatter;

        // Initialize UI.
        initLayout(ui.init());

        // Start rolling.
        lifeCycle();
    };

    // Expose some functionality.
    window.roulette.client = {
        SOCKET: SOCKET,
        getBalance: () => emit('get_balance', scatter.account_name, 'get_balance'),
        rebet: async function(){
            for(const oldBet of Object.values(state.lastBets)){
                await placeBet(oldBet.coverage, oldBet.larimers);
            }
            state.lastBets = {};
        }
    };
}());
