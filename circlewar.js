// circlewar.js
// @author Hunter Delattre

// ------ DOM ELEMENTS ------
const canvas = document.getElementById('gameCanvas');
const context = canvas.getContext('2d');

// ------ GAME TYPES ------
const UNIT_SOLDIER = 'soldier';
const unittypes = {
    [UNIT_SOLDIER]: {
        speed: 100
    }
};
const playerSlots = [
    { id: 0, color: 'blue', name: 'Player 1' },
    { id: 1, color: 'red', name: 'Player 2' },
    { id: 2, color: 'green', name: 'Player 3' },
    { id: 3, color: 'yellow', name: 'Player 4' },
    { id: 4, color: 'purple', name: 'Player 5' },
    { id: 5, color: 'orange', name: 'Player 6' },
    { id: 6, color: 'pink', name: 'Player 7' },
    { id: 7, color: 'brown', name: 'Player 8' },
];
const baseRadius = 20;

// ------ GAME STATE ------
let game_state = {
    time: 0,
    players: [],
    ai_players: [],
    bases: [],
    units: [],
}

let lastDeltaTime = 0;


// ------ INPUT HANDLING ------

let controlledPlayerId = null;

canvas.addEventListener('mousedown', handleMouseDown);
canvas.addEventListener('mousemove', handleMouseMove);
canvas.addEventListener('mouseup', handleMouseUp);

let isDragging = false;
let dragStartBase = null;
let dragLocation = null;
let dragEndBase = null;
let hoveredBase = null;
let hoveredTime = 0;
const selectHoverTime = 0.4;
let selectedBases = [];

function canDragBase(base) {
    return base.ownerid === controlledPlayerId;
}

function handleMouseDown(event) {
    const mouseX = event.clientX - canvas.offsetLeft;
    const mouseY = event.clientY - canvas.offsetTop;
    dragLocation = { x: mouseX, y: mouseY };

    const selectedBase = game_state.bases.find((base) => {
        if (!canDragBase(base)) return false;
        return getDistance(dragLocation, base.location) <= baseRadius;
    });

    if (selectedBase) {
        resetDragging();
        dragStartBase = selectedBase;
        isDragging = true;
        selectedBases.push(dragStartBase.baseid);
    }
}

function handleMouseMove(event) {
    if (isDragging) {
        if (!canDragBase(dragStartBase)) {
            isDragging = false;
            return;
        }

        const mouseX = event.clientX - canvas.offsetLeft;
        const mouseY = event.clientY - canvas.offsetTop;
        dragLocation = { x: mouseX, y: mouseY };

        if (!hoveredBase) {
            hoveredBase = hoveredBase || game_state.bases.find((base) => {
                if (base.ownerid != dragStartBase.ownerid) return false;
                return getDistance(dragLocation, base.location) <= baseRadius;
            });
            hoveredTime = 0;
        }
        else if (getDistance(hoveredBase.location, dragLocation) > baseRadius) {
            hoveredBase = null;
        }
    }
}

function handleMouseUp(event) {
    if (isDragging) {
        if (!canDragBase(dragStartBase)) {
            isDragging = false;
            return;
        }
        const mouseX = event.clientX - canvas.offsetLeft;
        const mouseY = event.clientY - canvas.offsetTop;
        dragLocation = { x: mouseX, y: mouseY };

        dragEndBase = game_state.bases.find((base) => {
            return getDistance(dragLocation, base.location) <= baseRadius;
        });
        
        if (dragStartBase && dragEndBase) {
            selectedBases.forEach((baseid) => {
                if (game_state.bases[baseid].ownerid != dragStartBase.ownerid) return;
                if (baseid == dragEndBase.baseid) return;
                const base = game_state.bases[baseid];
                const unitCount = Math.floor(base.units);
                sendUnits(base, dragEndBase, unitCount);
                sendMessage_SendUnits(baseid, dragEndBase.baseid, unitCount);
            });
        }

        isDragging = false;
    }
}

function resetDragging() {
    dragStartBase = null;
    dragEndBase = null;
    dragLocation = null;
    hoveredBase = null;
    hoveredTime = 0;
    selectedBases = [];
}

// ------ GAME FUNCTIONS ------

function initGame(game_options) {
    const num_bases = game_options.num_bases;
    const num_ai = game_options.num_ai_players;
    for (let i = 0; i < num_bases; i++) {
        const newBase = {
            baseid: game_state.bases.length,
            ownerid: -1,
            units: 10,
            trainingRate: .2 + Math.random(),
            unittype: UNIT_SOLDIER,
            location: getRandomLocation(baseRadius + 10, game_state.bases)
        };
        addBase(newBase);
    }

    addPlayer('Host');

    connectedPlayers.forEach((player) => {
        addPlayer(player.name);
    });

    const ai_names = [ 'HERB', 'ROSEMARY', 'THYME', 'SAGE', 'OREGANO', 'BASIL', 'MINT', 'PARSLEY', 'DILL', 'CHIVE' ];
    for (let i = 0; i < num_ai; i++) {
        addAIPlayer(ai_names[i]);
    }
}

function getNumActivePlayers() {
    return game_state.players.length;
}

function addPlayer(name) {
    const playerIndex = game_state.players.length;
    if (playerIndex >= playerSlots.length) return -1;
    let player = playerSlots[playerIndex];
    player.name = name;
    game_state.players.push(player);
    unowned_bases = game_state.bases.filter((base) => {
        return base.ownerid < 0;
    });
    assignStartBase(getRandomElement(unowned_bases), player.id);
    return playerIndex;
}

function addAIPlayer(name) {
    const playerIndex = addPlayer(name);
    game_state.ai_players.push(playerIndex);
}

function addBase(base) {
    game_state.bases.push(base);
}

function assignStartBase(base, playerid) {
    base.ownerid = playerid;
    base.units = 20;
    base.trainingRate = 1;
}

function sendUnits(startBase, endBase, numUnits) {

    startBase.units -= numUnits;

    const unitSpacing = 20; // Adjust this value to control the spacing between units

    // Calculate the number of rows and columns in the hexagon formation
    const numRows = Math.ceil(Math.sqrt(numUnits));
    const numCols = Math.ceil(numUnits / numRows);

    // Calculate the total width and height of the hexagon formation
    const formationWidth = (numCols - 1) * unitSpacing;
    const formationHeight = (numRows - 1) * unitSpacing * Math.sqrt(3) / 2;

    // Calculate the starting position of the hexagon formation
    const startX = startBase.location.x - formationWidth / 2;
    const startY = startBase.location.y - formationHeight / 2;

    // Iterate over each unit in the hexagon formation
    for (let row = 0; row < numRows; row++) {
        for (let col = 0; col < numCols; col++) {
            const unitIndex = row * numCols + col;
            if (unitIndex >= numUnits) {
                break; // Stop iterating if all units have been placed
            }

            // Calculate the position of the current unit in the hexagon formation
            const unitX = startX + col * unitSpacing;
            const unitY = startY + row * unitSpacing * Math.sqrt(3) / 2;

            game_state.units.push({
                ownerid: startBase.ownerid,
                location: { x: unitX, y: unitY },
                unittype: startBase.unittype,
                targetid: endBase.baseid
            });
        }
    }
}

// ------ UTILITY FUNCTIONS ------

function getDistance(locA, locB) {
    const deltaX = locA.x - locB.x;
    const deltaY = locA.y - locB.y;
    return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
}

function getRandomLocation(margin = 0, existing_locations = []) {
    let location = {
        x: Math.random() * (canvas.width - margin * 2) + margin,
        y: Math.random() * (canvas.height - margin * 2) + margin
    };

    if (existing_locations.length > 0) {
        while (true) {
            overlapping_location = existing_locations.find((existing_location) => {
                return getDistance(location, existing_location.location) < (baseRadius * 2 + margin);
            });
            if (overlapping_location) {
                location.x = Math.random() * (canvas.width - margin * 2) + margin;
                location.y = Math.random() * (canvas.height - margin * 2) + margin;
            }
            else {
                break;
            }
        }
    }

    return location;
}

function getRandomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function makeColorTranslucent(color, opacity) {
    const colors = {
        red: '255, 0, 0',
        green: '0, 128, 0',
        blue: '0, 0, 255',
        yellow: '255, 255, 0',
        purple: '128, 0, 128',
        orange: '255, 165, 0',
        pink: '255, 192, 203',
        brown: '165, 42, 42',
    };
  
    return `rgba(${colors[color]}, ${opacity})`;
}

// ------ NETWORKING ------

const MESSAGE_GAMESTATE = 'gameState';
const MESSAGE_STARTGAME = 'startGame';
const MESSAGE_UNITSMOVED = 'unitsMoved';

function handleMessage(message) {
    console.log(message);
    const messageType = message.type;
    const data = message.data;
    if (messageType == MESSAGE_UNITSMOVED) {
        sendUnits(game_state.bases[data.baseid], game_state.bases[data.targetid], data.units)
    }
    else if (messageType == MESSAGE_GAMESTATE) {
        game_state = data;
    }
    else if (messageType == MESSAGE_STARTGAME) {
        game_state = data.game_state;
        if (!isGameStarted()) {
            localPlayerId = data.playerid;
            controlledPlayerId = data.controlid;
            console.log('Joined game as player ' + localPlayerId + ' with control over player ' + controlledPlayerId);
            startGame(getGameOptions());
        }
    }
}

function sendMessage_gameState() {
    sendMessage({
        type: MESSAGE_GAMESTATE,
        data: game_state
    });
}

function sendMessage_SendUnits(startBaseId, endBaseId, numUnits) {
    sendMessage({
        type: MESSAGE_UNITSMOVED,
        data: {
            baseid: startBaseId,
            targetid: endBaseId,
            units: numUnits,
        }
    });
}

function sendMessage_startGame(playerid, controlid) {
    sendMessage({
        type: MESSAGE_STARTGAME,
        data: {
            playerid: playerid,
            controlid: controlid,
            game_state: game_state,
        }
    });
}

// ------ AI CONTROLLER ------

function updateAI_greedyExpand(ai_player, ai_state) {
    ai_state.playerBases.forEach((base) => {
        if (base.units < 10) return;
        const neutralBase = ai_state.neutralBases.length <= 0 ? null : ai_state.neutralBases.reduce((prev, curr) => {
            if (ai_state.playerUnits.find((unit) => unit.targetid == curr.baseid)) return prev;
            if (ai_state.enemyUnits.find((unit) => unit.targetid == curr.baseid)) return prev;
            return prev.trainingRate > curr.trainingRate ? prev : curr;
        });
        const enemyBase = ai_state.enemyBases.length <= 0 ? null : ai_state.enemyBases.reduce((prev, curr) => {
            if (ai_state.playerUnits.find((unit) => unit.targetid == curr.baseid)) return prev;
            if (curr.units < base.units + 2 && prev.units > curr.units + 2) return curr;
            return prev.trainingRate > curr.trainingRate ? prev : curr;
        });
        if (enemyBase && base.units >= (enemyBase.units + 15)) {
            const sendUnitCount = Math.floor(base.units);
            sendUnits(base, enemyBase, sendUnitCount);
            sendMessage_SendUnits(base.baseid, enemyBase.baseid, sendUnitCount);
        }
        else if (neutralBase && base.units >= (neutralBase.units + 3)) {
            const sendUnitCount = Math.floor(base.units);
            sendUnits(base, neutralBase, sendUnitCount);
            sendMessage_SendUnits(base.baseid, neutralBase.baseid, sendUnitCount);
        }
    });
}

function updateAI_zergRush(ai_player, ai_state) {
    ai_state.playerBases.forEach((base) => {
        // attacks the closest enemy base with less than 10 units
        if (base.units < 6) return;
        const enemyBase = ai_state.enemyBases.length <= 0 ? null : ai_state.enemyBases.reduce((prev, curr) => {
            if (ai_state.playerUnits.find((unit) => unit.targetid == curr.baseid)) return prev;
            if (curr.units < 10) return curr;
            return prev.trainingRate > curr.trainingRate ? prev : curr;
        });
        if (enemyBase) {
            const sendUnitCount = Math.floor(base.units);
            sendUnits(base, enemyBase, sendUnitCount);
            sendMessage_SendUnits(base.baseid, enemyBase.baseid, sendUnitCount);
        }
    });
}

const aiUpdateFunctions = [ updateAI_greedyExpand, updateAI_zergRush ];

// ------ GAME TICK ------

function updateState(deltaTime) {

    game_state.time += deltaTime;

    if (selectedBases.length > 0) {
        let newSelectedBases = [];
        selectedBases.forEach((baseid) => {
            if (game_state.bases[baseid].ownerid == controlledPlayerId) {
                newSelectedBases.push(baseid);
            }
        });
        selectedBases = newSelectedBases;
    }

    if (hoveredBase) {
        hoveredTime += deltaTime;
        if (hoveredTime >= selectHoverTime && selectedBases.indexOf(hoveredBase.baseid) < 0) {
            selectedBases.push(hoveredBase.baseid);
            hoveredBase = null;
        }
    }

    game_state.bases.forEach((base) => {
        if (base.ownerid < 0 && base.units >= 10) return;
        base.units += base.trainingRate * deltaTime;
    });

    const newUnits = [];
    game_state.units.forEach((unit) => {
        const targetBase = game_state.bases[unit.targetid];
        const distance = getDistance(targetBase.location, unit.location);
        const unitinfo = unittypes[unit.unittype];
        const progress = unitinfo.speed * deltaTime;
        if (distance <= progress) {
            unit.location = targetBase.location;
            if (targetBase.ownerid == unit.ownerid) {
                targetBase.units += 1;
            } else {
                targetBase.units -= 1;
                if (targetBase.units < 0) {
                    targetBase.units = -targetBase.units;
                    targetBase.ownerid = unit.ownerid;
                }
            }
        } else {
            const dx = targetBase.location.x - unit.location.x;
            const dy = targetBase.location.y - unit.location.y;
            const angle = Math.atan2(dy, dx);
            unit.location.x += Math.cos(angle) * progress;
            unit.location.y += Math.sin(angle) * progress;
            newUnits.push(unit);
        }
    });
    game_state.units = newUnits;

    let ownedBases = [];
    let neutralBases = [];
    game_state.bases.forEach((base) => {
        if (base.ownerid < 0) {
            neutralBases.push(base);
        } else {
            ownedBases.push(base);
        }
    });

    game_state.ai_players.forEach((playerid) => {
        const player = game_state.players[playerid];
        let ai_state = {
            playerBases: [],
            enemyBases: [],
            neutralBases: neutralBases,
            playerUnits: [],
            enemyUnits: [],
        }

        ownedBases.forEach((base) => {
            if (base.ownerid == playerid) {
                ai_state.playerBases.push(base);
            } else {
                ai_state.enemyBases.push(base);
            }
        });

        game_state.units.forEach((unit) => {
            if (unit.ownerid == playerid) {
                ai_state.playerUnits.push(unit);
            } else {
                ai_state.enemyUnits.push(unit);
            }
        });

        // Update AI on host
        if (isHost()) {
            if (game_state.time < 15 || (ai_state.playerBases.length <= 3 && ai_state.neutralBases.length > 0)) {
                aiUpdateFunction = updateAI_greedyExpand;
            }
            else {
                aiUpdateFunction = getRandomElement(aiUpdateFunctions);
            }

            aiUpdateFunction(player, ai_state);
        }
    });
}

// ------ RENDERING ------

function draw() {
    // Clear the canvas
    context.clearRect(0, 0, canvas.width, canvas.height);

    // Render game objects
    game_state.bases.forEach((base) => {
        const { x, y } = base.location; // Get the x and y coordinates from the base's location
        const owner = base.ownerid >= 0 ? game_state.players[base.ownerid] : null
        const radius = baseRadius;

        // Draw the base circle
        context.beginPath();
        context.arc(x, y, radius, 0, 2 * Math.PI);
        context.fillStyle = owner ? owner.color : 'gray';
        context.fill();

        // Draw the number of units
        context.font = '20px Arial';
        context.fillStyle = 'black';
        context.textAlign = 'center';
        context.fillText(parseInt(base.units), x, y + radius + 20);

        // Draw the training rate
        context.font = '15px Arial';
        context.fillStyle = 'white';
        context.textAlign = 'center';
        context.fillText('+' + base.trainingRate.toFixed(1), x - 3, y + 5);
    });

    game_state.units.forEach((unit) => {
        const { x, y } = unit.location;
        const owner = game_state.players[unit.ownerid];
        const radius = 10;

        // Draw the unit circle
        context.beginPath();
        context.arc(x, y, radius, 0, 2 * Math.PI);
        context.fillStyle = owner.color;
        context.fill();
    });

    if (isDragging && dragStartBase && dragLocation) {
        selectedBases.forEach((baseid) => {
            const base = game_state.bases[baseid];
            // Draw line from start base to mouse location
            context.beginPath();
            context.strokeStyle = makeColorTranslucent(game_state.players[dragStartBase.ownerid].color, 0.5)
            context.lineWidth = 5;
            context.lineCap = 'round';
            context.moveTo(base.location.x, base.location.y);
            context.lineTo(dragLocation.x, dragLocation.y);
            context.stroke();

            // Draw arrowhead
            const arrowheadSize = 10;
            const angle = Math.atan2(dragLocation.y - base.location.y, dragLocation.x - base.location.x);
            context.beginPath();
            context.moveTo(dragLocation.x, dragLocation.y);
            context.lineTo(
                dragLocation.x - arrowheadSize * Math.cos(angle - Math.PI / 6),
                dragLocation.y - arrowheadSize * Math.sin(angle - Math.PI / 6)
            );
            context.moveTo(dragLocation.x, dragLocation.y);
            context.lineTo(
                dragLocation.x - arrowheadSize * Math.cos(angle + Math.PI / 6),
                dragLocation.y - arrowheadSize * Math.sin(angle + Math.PI / 6)
            );
            context.stroke();
        });
    }
}

// ------ GAME LOOP ------

const frame_time = 1 / 60;
let lastFrameTime = null;

function update() {
    const currentTime = performance.now();
    const deltaTime = (currentTime - lastFrameTime) / 1000;

    if (deltaTime >= frame_time) {
        lastFrameTime = currentTime;
        lastDeltaTime = deltaTime;
        updateState(deltaTime);
        draw();
    }
    
    // Call the update function again
    requestAnimationFrame(update);
}

function startGame(game_options) {
    if (isHost()) {
        controlledPlayerId = 0;
        initGame(game_options);
    }

    // Start the game loop
    lastFrameTime = performance.now();
    update();
}

function isGameStarted() {
    return lastFrameTime != null;
}