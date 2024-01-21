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
    { id: 3, color: 'gold', name: 'Player 4' },
    { id: 4, color: 'purple', name: 'Player 5' },
    { id: 5, color: 'orange', name: 'Player 6' },
    { id: 6, color: 'pink', name: 'Player 7' },
    { id: 7, color: 'brown', name: 'Player 8' },
];
const baseRadius = 20;

// ------ GAME STATE ------
let game_state = {
    time: 0,
    speed: 1,
    roads_only: true,
    players: [],
    bases: [],
    roads: [],
    units: [],
}

let ai_controllers = [];

// ------ GAME FUNCTIONS ------

function initGame(game_options) {

    // Reset game state
    game_state = {
        time: 0,
        speed: game_options.game_speed,
        roads_only: game_options.roads_enabled,
        players: [],
        bases: [],
        roads: [],
        units: [],
    };
    ai_controllers = [];

    // Init bases
    const num_bases = game_options.num_bases;
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

    // Init roads
    if (game_state.roads_only) {
        game_state.bases.forEach((base) => {
            const num_roads = Math.floor(Math.random() * 3) + 1;
            for (let i = 0; i < num_roads; i++) {
                const closestBase = game_state.bases.reduce((prev, curr) => {
                    if (base.baseid == curr.baseid) return prev;
                    const existing_road = game_state.roads[base.baseid].find((road) => { return road == curr.baseid });
                    if (existing_road) return prev;
                    if (getDistance(base.location, prev.location) < getDistance(base.location, curr.location)) {
                        return prev;
                    }
                    return curr;
                });
                addRoad(base, closestBase);
            }
        });
    }

    // Init players
    addPlayer('Host');

    connectedPlayers.forEach((player) => {
        addPlayer(player.name);
    });

    const num_ai = game_options.num_ai_players;
    const ai_names = [ 'HERB', 'ROSEMARY', 'THYME', 'SAGE', 'OREGANO', 'BASIL', 'MINT', 'PARSLEY', 'DILL', 'CHIVE' ];
    for (let i = 0; i < num_ai; i++) {
        addAIPlayer(ai_names[i]);
    }
}

function handlePlayerWin(winnerid) {
    stopGame();
    const winning_player = game_state.players[winnerid];
    console.log('Player ' + winnerid + ' wins!');
    gameOver(winnerid, winning_player.name, winning_player.color);
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
    const strategy = aiStrategy_normal;
    ai_controllers.push({
        controlid: playerIndex,
        strategy: strategy,
    });
}

function addBase(base) {
    game_state.bases.push(base);
    game_state.roads.push([]);
}

function addRoad(startBase, endBase) {
    game_state.roads[startBase.baseid].push(endBase.baseid);
    game_state.roads[endBase.baseid].push(startBase.baseid);
}

function assignStartBase(base, playerid) {
    base.ownerid = playerid;
    base.units = 20;
    base.trainingRate = 1;
}

function canSendUnits(startBaseId, endBaseId) {
    return !game_state.roads_only || game_state.roads[startBaseId].indexOf(endBaseId) >= 0;
}

function input_sendUnits(controlId, startBaseId, endBaseId, numUnits) {
    const startBase = game_state.bases[startBaseId];
    const endBase = game_state.bases[endBaseId];
    if (startBase.ownerid != controlId) return;
    // if (startBase.units < numUnits) return;
    if (!canSendUnits(startBaseId, endBaseId)) return;
    sendUnits(startBase, endBase, numUnits);
    sendMessage_SendUnits(startBaseId, endBaseId, numUnits);
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

    let spawnedUnits = [];

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

            const unit = {
                ownerid: startBase.ownerid,
                location: { x: unitX, y: unitY },
                unittype: startBase.unittype,
                targetid: endBase.baseid
            };
            spawnedUnits.push(unit);
            game_state.units.push(unit);
        }
    }

    return spawnedUnits;
}

function updateUnits(units, deltaTime, allow_capture = true) {
    const newUnits = [];
    units.forEach((unit) => {
        const targetBase = game_state.bases[unit.targetid];
        const distance = getDistance(targetBase.location, unit.location);
        const unitinfo = unittypes[unit.unittype];
        const progress = unitinfo.speed * deltaTime;
        if (distance <= progress) {
            unit.location = targetBase.location;
            if (allow_capture) {
                if (targetBase.ownerid == unit.ownerid) {
                    targetBase.units += 1;
                } else {
                    targetBase.units -= 1;
                    if (targetBase.units < 0) {
                        targetBase.units = -targetBase.units;
                        targetBase.ownerid = unit.ownerid;
                    }
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
    return newUnits;
}

function getPlayerColor(playerId) {
    return playerId >= 0 ? game_state.players[playerId].color : 'gray';
}

// ------ INPUT HANDLING ------

let controlledPlayerId = null;

// Touch event handling
canvas.addEventListener('touchstart', handleMouseDown, { passive: false });
canvas.addEventListener('touchmove', handleMouseMove, { passive: false });
canvas.addEventListener('touchend', handleTouchUp, { passive: false });

canvas.addEventListener('mousedown', handleMouseDown);
canvas.addEventListener('mousemove', handleMouseMove);
canvas.addEventListener('mouseup', handleMouseUp);

let isDragging = false;
let dragStartBase = null;
let dragLocation = null;
let dragEndBase = null;
let hoveredBase = null;
let hoveredTime = 0;
const selectMargin = 20;
const selectHoverTime = 0.4;
let selectedBases = [];

function canDragBase(base) {
    return base.ownerid === controlledPlayerId;
}
function getMouseLocation(event) {
    const inputX = event.clientX || event.touches[0].clientX;
    const inputY = event.clientY || event.touches[0].clientY;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mouseX = (inputX - rect.left) * scaleX;
    const mouseY = (inputY - rect.top) * scaleY;
    return { x: mouseX, y: mouseY };
}

function getBaseSelectRadius(base) {
    return baseRadius + selectMargin;
}

function handleMouseDown(event) {
    event.preventDefault();
    dragLocation = getMouseLocation(event);
    input_clickLocation(dragLocation);
}

function handleMouseMove(event) {
    event.preventDefault();
    dragLocation = getMouseLocation(event);
    input_hoverLocation(dragLocation);
}

function handleMouseUp(event) {
    event.preventDefault();
    dragLocation = getMouseLocation(event);
    input_releaseLocation(dragLocation);
}

function handleTouchUp(event) {
    event.preventDefault();
    // Can't update drag location here because touchend doesn't have a location
    // just use the last position from touchmove
    input_releaseLocation(dragLocation);
}

function resetDragging() {
    dragStartBase = null;
    dragEndBase = null;
    dragLocation = null;
    hoveredBase = null;
    hoveredTime = 0;
    selectedBases = [];
}

function input_clickLocation(location) {
    const selectedBase = game_state.bases.find((base) => {
        if (!canDragBase(base)) return false;
        return getDistance(location, base.location) <= getBaseSelectRadius(base);
    });

    if (selectedBase) {
        resetDragging();
        dragStartBase = selectedBase;
        isDragging = true;
        selectedBases.push(dragStartBase.baseid);
    }
}

function input_hoverLocation(location) {
    if (!isDragging) return;
    if (!canDragBase(dragStartBase)) {
        isDragging = false;
        return;
    }

    if (!hoveredBase) {
        hoveredBase = hoveredBase || game_state.bases.find((base) => {
            if (base.ownerid != dragStartBase.ownerid) return false;
            return getDistance(location, base.location) <= getBaseSelectRadius(base);
        });
        hoveredTime = 0;
    }
    else if (getDistance(hoveredBase.location, location) > getBaseSelectRadius(hoveredBase)) {
        hoveredBase = null;
    }
}

function input_releaseLocation(location) {
    if (!isDragging) return;
    if (!canDragBase(dragStartBase)) {
        isDragging = false;
        return;
    }

    dragEndBase = game_state.bases.find((base) => {
        return getDistance(location, base.location) <= getBaseSelectRadius(base);
    });

    if (dragStartBase && dragEndBase) {
        selectedBases.forEach((baseid) => {
            if (game_state.bases[baseid].ownerid != dragStartBase.ownerid) return;
            if (baseid == dragEndBase.baseid) return;
            const base = game_state.bases[baseid];
            const unitCount = Math.floor(base.units);
            input_sendUnits(controlledPlayerId, baseid, dragEndBase.baseid, unitCount);
        });
    }

    isDragging = false;
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
        gray: '128, 128, 128',
        red: '255, 0, 0',
        green: '0, 128, 0',
        blue: '0, 0, 255',
        gold: '255, 215, 0',
        purple: '128, 0, 128',
        orange: '255, 165, 0',
        pink: '255, 192, 203',
        brown: '165, 42, 42',
    };
  
    return `rgba(${colors[color]}, ${opacity})`;
}

// ------ NETWORKING ------

function updateGameState(new_game_state) {
    const serverDeltaTime = new_game_state.time - game_state.time;
    game_state = new_game_state;
    // Set time back to simulate forward from the new state
    if (isGameStarted())
    {
        lastFrameTime -= serverDeltaTime;
    }
}

const MESSAGE_GAMESTATE = 'gameState';
const MESSAGE_STARTGAME = 'startGame';
const MESSAGE_PLAYERWIN = 'playerWin';
const MESSAGE_UNITSMOVED = 'unitsMoved';

function handleMessage(message) {
    console.log(message);
    const messageType = message.type;
    const data = message.data;
    if (messageType == MESSAGE_UNITSMOVED) {
        const sentUnits = sendUnits(game_state.bases[data.baseid], game_state.bases[data.targetid], data.units)
        updateUnits(sentUnits, game_state.time - data.time, false)
    }
    else if (messageType == MESSAGE_GAMESTATE) {
        updateGameState(data.game_state);
    }
    else if (messageType == MESSAGE_STARTGAME) {
        updateGameState(data.game_state);
        if (!isGameStarted()) {
            localPlayerId = data.playerid;
            controlledPlayerId = data.controlid;
            console.log('Joined game as player ' + localPlayerId + ' with control over player ' + controlledPlayerId);
            startGame(getGameOptions());
        }
    }
    else if (messageType == MESSAGE_PLAYERWIN) {
        handlePlayerWin(data.winnerid);
    }
}

function sendMessage_gameState() {
    sendMessage({
        type: MESSAGE_GAMESTATE,
        data: {
            game_state: game_state,
        }
    });
}

function sendMessage_SendUnits(startBaseId, endBaseId, numUnits) {
    sendMessage({
        type: MESSAGE_UNITSMOVED,
        data: {
            time: game_state.time,
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

function sendMessage_playerWin(winnerid) {
    sendMessage({
        type: MESSAGE_PLAYERWIN,
        data: {
            winnerid: winnerid,
        }
    });
}

// ------ AI CONTROLLER ------

function gatherAIState(ai_controller, ownedBases, neutralBases) {
    const playerid = ai_controller.controlid;
    let ai_state = {
        playerBases: [],
        enemyBases: [],
        neutralBases: game_state.roads_only ? [] : neutralBases,
        playerUnits: [],
        enemyUnits: [],
    };

    ownedBases.forEach((base) => {
        if (base.ownerid == playerid) {
            ai_state.playerBases.push(base);

        } else if (!game_state.roads_only) {
            ai_state.enemyBases.push(base);
        }
    });

    if (game_state.roads_only) {
        ai_state.playerBases.forEach((base) => {
            const roadBases = game_state.roads[base.baseid].map((roadid) => {
                return game_state.bases[roadid];
            });
            roadBases.forEach((roadBase) => {
                if (roadBase.ownerid == playerid) return;
                if (roadBase.ownerid < 0) {
                    if (ai_state.neutralBases.find((neutralBase) => neutralBase.baseid == roadBase.baseid)) return;
                    ai_state.neutralBases.push(roadBase);
                }
                else {
                    if (ai_state.enemyBases.find((enemyBase) => enemyBase.baseid == roadBase.baseid)) return;
                    ai_state.enemyBases.push(roadBase);
                }
            });
        });
    }

    game_state.units.forEach((unit) => {
        if (unit.ownerid == playerid) {
            ai_state.playerUnits.push(unit);
        } else {
            ai_state.enemyUnits.push(unit);
        }
    });

    return ai_state;
}

function updateAI_reinforceBases(ai_controller, ai_state) {
    for (i = 0, n = ai_state.playerBases.length; i < n; i++) {
        const base = ai_state.playerBases[i];
        if (base.units < 10) continue;
        const adjacentBases = game_state.roads[base.baseid].map((roadid) => { return game_state.bases[roadid]; });
        const adjacentUnowned = adjacentBases.find((adjacentBase) => { return adjacentBase.ownerid < 0 || adjacentBase.ownerid != base.ownerid; });
        if (adjacentUnowned != null) continue;
        let lastNumAdjacent = 0;
        const friendlyBase = ai_state.playerBases.length <= 1 ? null : ai_state.playerBases.reduce((prev, curr) => {
            if (base.baseid == curr.baseid) return prev;
            if (!canSendUnits(base.baseid, curr.baseid)) return prev;
            const numAdjacent = game_state.roads[base.baseid].filter((roadid) => { return game_state.bases[roadid].ownerid != curr.ownerid; }).length;
            if (numAdjacent < lastNumAdjacent) return prev;
            lastNumAdjacent = numAdjacent;
            return prev.units < curr.units ? prev : curr;
        });
        if (friendlyBase == null) continue;
        const enemyTargeting = ai_state.enemyUnits.filter((unit) => unit.targetid == base.baseid);
        const friendlyTargeting = ai_state.enemyUnits.filter((unit) => unit.targetid == base.baseid);
        const adjustedUnits = friendlyBase.units - enemyTargeting.length + friendlyTargeting.length;
        if (adjustedUnits <= 5 && base.units >= (friendlyBase.units + 5)) {
            const sendUnitCount = Math.floor(base.units);
            input_sendUnits(ai_controller.controlid, base.baseid, friendlyBase.baseid, sendUnitCount);
            return;
        }
    }
}

// expands to the closest neutral base
function updateAI_greedyExpand(ai_controller, ai_state) {
    for (i = 0, n = ai_state.playerBases.length; i < n; i++) {
        const base = ai_state.playerBases[i];
        if (base.units < 10) continue;
        function canTargetNeutralBase(targetBase) {
            if (!canSendUnits(base.baseid, targetBase.baseid)) return false;
            if (ai_state.playerUnits.find((unit) => unit.targetid == targetBase.baseid)) return false;
            if (ai_state.enemyUnits.find((unit) => unit.targetid == targetBase.baseid)) return false;
            return true;
        }
        const neutralBase = ai_state.neutralBases.length <= 0 ? null : ai_state.neutralBases.reduce((prev, curr) => {
            if (prev == null) return canTargetNeutralBase(curr) ? curr : null;
            if (!canTargetNeutralBase(curr)) return canTargetNeutralBase(prev) ? prev : null;
            return prev.trainingRate > curr.trainingRate ? prev : curr;
        });
        if (neutralBase && base.units >= (neutralBase.units + 3)) {
            const sendUnitCount = Math.floor(base.units);
            input_sendUnits(ai_controller.controlid, base.baseid, neutralBase.baseid, sendUnitCount);
            return;
        }
    }
}

// attacks vulnerable enemy bases if possible, else expands
function updateAI_attackExpand(ai_controller, ai_state) {
    for (i = 0, n = ai_state.playerBases.length; i < n; i++) {
        const base = ai_state.playerBases[i];
        if (base.units < 10) continue;
        function canTargetNeutralBase(targetBase) {
            if (!canSendUnits(base.baseid, targetBase.baseid)) return false;
            if (ai_state.playerUnits.find((unit) => unit.targetid == targetBase.baseid)) return false;
            if (ai_state.enemyUnits.find((unit) => unit.targetid == targetBase.baseid)) return false;
            return true;
        }
        const neutralBase = ai_state.neutralBases.length <= 0 ? null : ai_state.neutralBases.reduce((prev, curr) => {
            if (prev == null) return canTargetNeutralBase(curr) ? curr : null;
            if (!canTargetNeutralBase(curr)) return canTargetNeutralBase(prev) ? prev : null;
            return prev.trainingRate > curr.trainingRate ? prev : curr;
        });

        function canTargetEnemyBase(targetBase) {
            if (!canSendUnits(base.baseid, targetBase.baseid)) return false;
            if (ai_state.playerUnits.find((unit) => unit.targetid == targetBase.baseid)) return false;
            return true;
        }
        const enemyBase = ai_state.enemyBases.length <= 0 ? null : ai_state.enemyBases.reduce((prev, curr) => {
            if (prev == null) return canTargetEnemyBase(curr) ? curr : null;
            if (!canTargetEnemyBase(curr)) return canTargetEnemyBase(prev) ? prev : null;
            if (curr.units < base.units + 2 && prev.units > curr.units + 2) return curr;
            return prev.trainingRate > curr.trainingRate ? prev : curr;
        });
        if (enemyBase && base.units >= (enemyBase.units + 15)) {
            const sendUnitCount = Math.floor(base.units);
            input_sendUnits(ai_controller.controlid, base.baseid, enemyBase.baseid, sendUnitCount);
            return;
        }
        else if (neutralBase && base.units >= (neutralBase.units + 3)) {
            const sendUnitCount = Math.floor(base.units);
            input_sendUnits(ai_controller.controlid, base.baseid, neutralBase.baseid, sendUnitCount);
            return;
        }
    }
}

// attacks the closest enemy base with less than 10 units
function updateAI_zergRush(ai_controller, ai_state) {
    for (i = 0, n = ai_state.playerBases.length; i < n; i++) {
        const base = ai_state.playerBases[i];
        if (base.units < 6) continue;
        function canTargetEnemyBase(targetBase) {
            if (!canSendUnits(base.baseid, targetBase.baseid)) return false;
            if (ai_state.playerUnits.find((unit) => unit.targetid == targetBase.baseid)) return false;
            return true;
        };
        const enemyBase = ai_state.enemyBases.length <= 0 ? null : ai_state.enemyBases.reduce((prev, curr) => {
            if (prev == null) return canTargetEnemyBase(curr) ? curr : null;
            if (!canTargetEnemyBase(curr)) return canTargetEnemyBase(prev) ? prev : null;
            if (curr.units < 10 && curr.units < prev.units) return curr;
            return prev.trainingRate > curr.trainingRate ? prev : curr;
        });
        if (enemyBase) {
            const sendUnitCount = Math.floor(base.units);
            input_sendUnits(ai_controller.controlid, base.baseid, enemyBase.baseid, sendUnitCount);
            return;
        }
    }
}

const aiUpdateFunctions = [ updateAI_attackExpand, updateAI_greedyExpand, updateAI_zergRush ];

function aiStrategy_normal(ai_controller, ai_state, deltaTime) {
    if (game_state.time < 3 || ai_state.playerBases.length <= 0) return;

    const aiUpdateInterval = 0.5;
    ai_controller.updateTime = ai_controller.updateTime || aiUpdateInterval;
    ai_controller.updateTime -= deltaTime;
    if (ai_controller.updateTime > 0) return;
    ai_controller.updateTime = aiUpdateInterval;

    let aiUpdateFunction = null;
    if (game_state.time < 15 || (ai_state.playerBases.length <= 3 && ai_state.neutralBases.length > 0)) {
        aiUpdateFunction = updateAI_greedyExpand;
    }
    else {
        aiUpdateFunction = getRandomElement(aiUpdateFunctions);
    }

    aiUpdateFunction(ai_controller, ai_state);

    if (game_state.roads_only) {
        updateAI_reinforceBases(ai_controller, ai_state, deltaTime);
    }
}

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

    const newUnits = updateUnits(game_state.units, deltaTime);
    game_state.units = newUnits;

    if (isHost()) {
        // AI update
        let ownedBases = [];
        let neutralBases = [];
        game_state.bases.forEach((base) => {
            if (base.ownerid < 0) {
                neutralBases.push(base);
            } else {
                ownedBases.push(base);
            }
        });
        ai_controllers.forEach((ai_controller) => {
            const ai_state = gatherAIState(ai_controller, ownedBases, neutralBases);
            ai_controller.strategy(ai_controller, ai_state, deltaTime);
        });

        // Check for game over
        let winner = null;
        for (let i = 0, n = game_state.bases.length; i < n; i++) {
            const base = game_state.bases[i];
            if (base.ownerid < 0) continue;
            if (winner == null) {
                winner = base.ownerid;
            }
            else if (winner != base.ownerid) {
                winner = null;
                break;
            }
        }
        if (winner != null) {
            handlePlayerWin(winner);
            sendMessage_playerWin(winner);
        }
    }
}

// ------ RENDERING ------
// Create an offscreen canvas to cache the background
const offscreenCanvas = document.createElement('canvas');
const offscreenCtx = offscreenCanvas.getContext('2d');

// Draw the background on the offscreen canvas
function drawBackground() {
    //todo
}

function draw() {
    // Clear the canvas
    context.clearRect(0, 0, canvas.width, canvas.height);

    // Draw the cached background onto the main canvas
    context.drawImage(offscreenCanvas, 0, 0);

    game_state.roads.forEach((roads, baseid) => {
        const base = game_state.bases[baseid];
        roads.forEach((roadid) => {
            const roadBase = game_state.bases[roadid];
            const roadColor = base.ownerid == roadBase.ownerid ? getPlayerColor(roadBase.ownerid) : 'gray';
            context.beginPath();
            context.strokeStyle = makeColorTranslucent(roadColor, 0.5);
            context.lineWidth = 5;
            context.lineCap = 'round';
            context.moveTo(base.location.x, base.location.y);
            context.lineTo(roadBase.location.x, roadBase.location.y);
            context.stroke();
        });
    });

    // Render game objects
    game_state.bases.forEach((base) => {
        const { x, y } = base.location; // Get the x and y coordinates from the base's location
        const radius = baseRadius;

        // Draw the base circle
        context.beginPath();
        context.arc(x, y, radius, 0, 2 * Math.PI);
        context.fillStyle = getPlayerColor(base.ownerid);
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
            const baseColor = getPlayerColor(dragStartBase.ownerid);
            // Draw line from start base to mouse location
            context.beginPath();
            context.strokeStyle = makeColorTranslucent(baseColor, 0.5)
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

const stateUpdateInterval = 5;
let nextStateUpdate = stateUpdateInterval;

function update() {
    if (lastFrameTime == null) return;
    const currentTime = performance.now();
    const deltaTime = (currentTime - lastFrameTime) / 1000 * game_state.speed;

    if (deltaTime >= frame_time) {
        lastFrameTime = currentTime;
        updateState(deltaTime);
        draw();
    }

    if (isHost()) {
        nextStateUpdate -= deltaTime;
        if (nextStateUpdate <= 0) {
            nextStateUpdate = stateUpdateInterval;
            sendMessage_gameState();
        }
    }

    // Call the update function again
    requestAnimationFrame(update);
}

function isGameStarted() {
    return lastFrameTime != null;
}

function startGame(game_options) {
    if (isGameStarted()) return;

    if (isHost()) {
        controlledPlayerId = 0;
        initGame(game_options);
    }

    drawBackground();

    // Start the game loop
    lastFrameTime = performance.now();
    update();
}

function stopGame() {
    lastFrameTime = null;
}