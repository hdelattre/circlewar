// circlewar.js
// @author Hunter Delattre

// ------ DOM ELEMENTS ------
const canvas = document.getElementById('gameCanvas');
const context = canvas.getContext('2d');

// ------ GAME TYPES ------
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
const minMapSize = {x: 400, y: 400};
const maxMapSize = {x: 2048, y: 2048};
const baseRadius = 20;
const baseMinDist = 10;
const UNIT_SOLDIER = 'soldier';
const unittypes = {
    [UNIT_SOLDIER]: {
        speed: 100
    }
};

function getMaxBases(mapSize) {
    const minBaseSpacing = baseRadius * 2 + baseMinDist;
    return Math.floor(mapSize.x * mapSize.y / (minBaseSpacing * minBaseSpacing * Math.PI));
}

// ------ GAME STATE ------
let game_config = {
    seed: 0,
    bases: [],
    roads: [],
    roads_only: true,
}
let game_state = {
    time: 0,
    speed: 1,
    players: [],
    bases: [],
    units: [],
}

let ai_controllers = [];

// ------ GAME FUNCTIONS ------

// All players init
function initFromConfig(config) {

    game_config = config;

    // Init seed
    if (config.seed < 0) {
        random = Math.random;
    }
    else {
        seededRandom = new SeededRandom(config.seed);
        random = seededRandom.next.bind(seededRandom);
    }

    // Init map size
    canvas.width = config.map_size.x;
    canvas.height = config.map_size.y;
}

// Host only
function initGame(game_options) {

    const seed = game_options.seed < 0 ? Math.floor(Math.random() * 1000000) : game_options.seed;

    const config = {
        seed: seed,
        map_size: game_options.map_size,
        bases: [],
        roads: [],
        roads_only: game_options.roads_enabled,
    }

    initFromConfig(config);

    // Reset game state
    game_state = {
        time: 0,
        speed: game_options.game_speed,
        players: [],
        bases: [],
        units: [],
    };
    ai_controllers = [];

    // Init bases
    const num_bases = game_options.num_bases;
    for (let i = 0; i < num_bases; i++) {
        const newBase = {
            id: game_config.bases.length,
            trainingRate: .2 + random(),
            unittype: UNIT_SOLDIER,
            location: getRandomLocation(baseRadius + baseMinDist, game_config.bases)
        };
        addBase(newBase, -1, 10);
    }

    // Init roads
    if (game_config.roads_only) {
        game_config.bases.forEach((base) => {
            const num_roads = Math.floor(random() * 3) + 1;
            for (let i = 0; i < num_roads; i++) {
                const closestBase = game_config.bases.reduce((prev, curr) => {
                    if (base.id == curr.id) return prev;
                    const existing_road = game_config.roads[base.id].find((road) => { return road == curr.id });
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
    unowned_bases = game_config.bases.filter((base) => {
        return getBaseOwner(base.id) < 0;
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

function addBase(base, ownerid, units) {
    game_config.bases.push(base);
    game_config.roads.push([]);
    game_state.bases.push({
        id: base.id,
        ownerid: ownerid,
        units: units,
        autotarget: null,
    });
}

function addRoad(startBase, endBase) {
    game_config.roads[startBase.id].push(endBase.id);
    game_config.roads[endBase.id].push(startBase.id);
}

function assignStartBase(base, playerid) {
    const base_state = game_state.bases[base.id];
    base_state.ownerid = playerid;
    base_state.units = 20;
    base.trainingRate = 1;
}

function getBaseOwner(id) {
    return game_state.bases[id].ownerid;
}

function getBaseUnits(id) {
    return game_state.bases[id].units;
}

function getBaseDistance(startId, endId) {
    return getDistance(game_config.bases[startId].location, game_config.bases[endId].location);
}

function getShortestPath(startBaseId, endBaseId, heuristic = getBaseDistance) {
    if (!game_config.roads_only || game_config.roads[startBaseId].indexOf(endBaseId) >= 0) { return [endBaseId]; }

    const startBaseOwner = getBaseOwner(startBaseId);
    const visited = [];
    const queue = [];
    const prev = [];
    const gScore = [];
    const fScore = [];
    queue.push(startBaseId);
    visited[startBaseId] = true;
    gScore[startBaseId] = 0;
    fScore[startBaseId] = heuristic(startBaseId, endBaseId);

    while (queue.length > 0) {
        let currentBaseId = queue[0];
        let currentIndex = 0;
        for (let i = 1; i < queue.length; i++) {
            if (fScore[queue[i]] < fScore[currentBaseId]) {
                currentBaseId = queue[i];
                currentIndex = i;
            }
        }

        queue.splice(currentIndex, 1);

        if (currentBaseId === endBaseId) {
            // Found the shortest path, reconstruct and return it
            const path = [];
            let baseId = endBaseId;
            while (baseId !== startBaseId) {
                path.unshift(baseId);
                baseId = prev[baseId];
            }
            return path;
        }

        const neighbors = game_config.roads[currentBaseId];
        for (let i = 0; i < neighbors.length; i++) {
            const neighborBaseId = neighbors[i];
            const tentativeGScore = gScore[currentBaseId] + 1;
            if (!visited[neighborBaseId] || tentativeGScore < gScore[neighborBaseId]) {
                visited[neighborBaseId] = true;
                prev[neighborBaseId] = currentBaseId;
                gScore[neighborBaseId] = tentativeGScore;
                fScore[neighborBaseId] = gScore[neighborBaseId] + heuristic(neighborBaseId, endBaseId);
                if (getBaseOwner(neighborBaseId) == startBaseOwner || neighborBaseId === endBaseId) {
                    if (!queue.includes(neighborBaseId)) {
                        queue.push(neighborBaseId);
                    }
                }
            }
        }
    }

    // No path found
    return null;
}

function canSendUnits(startBaseId, endBaseId) {
    return !game_config.roads_only || getShortestPath(startBaseId, endBaseId) != null;
}

function sendUnits(startBase, endBase, numUnits, destinationid = null) {

    const startBaseState = game_state.bases[startBase.id];
    startBaseState.units -= numUnits;

    if (destinationid != null && endBase.id == destinationid) {
        destinationid = null;
    }

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
                ownerid: getBaseOwner(startBase.id),
                location: { x: unitX, y: unitY },
                unittype: startBase.unittype,
                targetid: endBase.id,
                destinationid: destinationid,
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
        const targetBase = game_config.bases[unit.targetid];
        const baseState = game_state.bases[unit.targetid];
        const distance = getDistance(targetBase.location, unit.location);
        const unitinfo = unittypes[unit.unittype];
        const progress = unitinfo.speed * deltaTime;
        if (distance <= progress) {
            unit.location = targetBase.location;
            if (allow_capture) {
                const ownerid = getBaseOwner(targetBase.id);
                let baseOwned = ownerid == unit.ownerid;
                if (baseOwned) {
                    baseState.units += 1;
                } else {
                    baseState.units -= 1;
                    if (baseState.units < 0) {
                        baseState.units = -baseState.units;
                        baseState.ownerid = unit.ownerid;
                        baseState.autotarget = null;
                        baseOwned = true;
                    }
                }

                if (game_config.roads_only && unit.destinationid != null) {
                    if (!baseOwned) {
                        unit.destinationid = null;
                        return;
                    }
                    const destinationPath = getShortestPath(targetBase.id, unit.destinationid);
                    if (destinationPath != null) {
                        const sentUnits = sendUnits(targetBase, game_config.bases[destinationPath[0]], 1, unit.destinationid);
                        updateUnits(sentUnits, (progress - distance) / unitinfo.speed, false);
                        newUnits.push(...sentUnits);
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

function checkForGestureNav() {
    const isAndroid = /Android/i.test(navigator.userAgent);
    if (!isAndroid) return;

    // Calculate the aspect ratio
    const aspectRatio = window.innerWidth / window.innerHeight;
    const screenAspectRatio = screen.width / screen.height;

    const threshold = 0.1;
    const usingGestureNav = Math.abs(aspectRatio - screenAspectRatio) > threshold;

    if (usingGestureNav) {
        canvas.style.width = '80%';
    }
    else {
        canvas.style.width = '100%';
    }
}

// Listen for resize events which might indicate a change in navigation mode
window.addEventListener('resize', checkForGestureNav);

const preventSwipeGesture = function(event) {
    const touchX = event.touches[0].location;
    if (touchX < 50 || touchX > window.innerWidth - 50) {
        event.preventDefault();
    }
}
const preventTouchMove = function(event) { event.preventDefault(); };
// Disable touch input on the document to prevent scrolling/navigation
function setTouchInputsLockedToGame(inputs_locked) {
    const options = { passive: false };
    if (inputs_locked) {
        document.addEventListener('touchstart', preventSwipeGesture, options);
        document.addEventListener('touchmove', preventTouchMove, options);
        //document.documentElement.style.touchAction = 'none';
    }
    else {
        document.removeEventListener('touchstart', preventSwipeGesture, options);
        document.removeEventListener('touchmove', preventTouchMove, options);
        //document.documentElement.style.touchAction = 'auto';
    }
}

canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
canvas.addEventListener('touchend', handleTouchUp, { passive: false });
canvas.addEventListener('touchcancel', handleTouchUp, { passive: false });

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
const selectHoverTime = 0.3;
let selectedBases = [];
const doubleClickMs = 300;
let lastClickTime = 0;
let doubleClick = false;

let isMultitouching = false;

function canDragBase(base) {
    return getBaseOwner(base.id) === controlledPlayerId;
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

function handleTouchStart(event) {
    if (!isGameStarted()) return;
    if (event.touches.length == 1) {
        handleMouseDown(event);
    }
    else {
        isMultitouching = true;
        isDragging = false;
        setTouchInputsLockedToGame(false);
    }
}

function handleTouchMove(event) {
    if (!isGameStarted()) return;
    if (event.touches.length == 1) {
        handleMouseMove(event);
    }
}

function handleTouchUp(event) {
    if (isMultitouching && event.touches.length <= 1) {
        isMultitouching = false;
        setTouchInputsLockedToGame(true);
    }
    else {
        event.preventDefault();
        // Can't update drag location here because touchend doesn't have a location
        // just use the last position from touchmove
        input_releaseLocation(dragLocation);
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

function input_clickLocation(location) {
    doubleClick = (lastFrameTime - lastClickTime) < doubleClickMs;
    lastClickTime = lastFrameTime;
    const selectedBase = game_config.bases.find((base) => {
        if (!canDragBase(base)) return false;
        return getDistance(location, base.location) <= getBaseSelectRadius(base);
    });

    if (selectedBase) {
        resetDragging();
        dragStartBase = selectedBase;
        isDragging = true;
        selectedBases.push(dragStartBase.id);
    }
}

function input_hoverLocation(location) {
    if (!isDragging) return;
    if (!canDragBase(dragStartBase)) {
        isDragging = false;
        return;
    }

    if (!hoveredBase) {
        hoveredBase = hoveredBase || game_config.bases.find((base) => {
            if (getBaseOwner(base.id) != getBaseOwner(dragStartBase.id)) return false;
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

    dragEndBase = game_config.bases.find((base) => {
        return getDistance(location, base.location) <= getBaseSelectRadius(base);
    });

    if (dragStartBase && dragEndBase) {
        selectedBases.forEach((id) => {
            if (getBaseOwner(id) != getBaseOwner(dragStartBase.id)) return;
            if (id == dragEndBase.id) return;
            const baseState = game_state.bases[id];
            const unitCount = Math.floor(baseState.units);
            input_sendUnits(controlledPlayerId, id, dragEndBase.id, unitCount, doubleClick);
        });
    }

    isDragging = false;
}

function input_sendUnits(controlId, startBaseId, endBaseId, numUnits, forever) {
    const startBase = game_config.bases[startBaseId];
    const endBase = game_config.bases[endBaseId];
    const startBaseOwner = getBaseOwner(startBaseId);
    if (startBaseOwner != controlId) return;
    // if (startBase.units < numUnits) return;
    if (!canSendUnits(startBaseId, endBaseId)) return;
    const shortestPath = getShortestPath(startBaseId, endBaseId);
    if (shortestPath == null) return;
    game_state.bases[startBaseId].autotarget = forever ? endBaseId : null;
    const nextBase = game_config.roads_only ? game_config.bases[shortestPath[0]] : endBase;
    sendUnits(startBase, nextBase, numUnits, endBaseId);
    sendMessage_SendUnits(controlId, startBaseId, nextBase.id, numUnits, endBase.id, forever);
}

// ------ UTILITY FUNCTIONS ------

function getDistance(locA, locB) {
    const deltaX = locA.x - locB.x;
    const deltaY = locA.y - locB.y;
    return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
}

// only use this random function, as it may be replaced with a seeded random
let random = Math.random;
let seededRandom = null;

function SeededRandom(seed) {
    this.seed = seed;
    this.next = function() {
        // Constants for the LCG algorithm
        var a = 1664525;
        var c = 1013904223;
        var m = Math.pow(2, 32);

        // Update the seed
        this.seed = (a * this.seed + c) % m;
        return this.seed / m;
    };
}

function getRandomLocation(margin = 0, existing_locations = []) {
    let location = {
        x: random() * (canvas.width - margin * 2) + margin,
        y: random() * (canvas.height - margin * 2) + margin
    };

    if (existing_locations.length > 0) {
        while (true) {
            overlapping_location = existing_locations.find((existing_location) => {
                return getDistance(location, existing_location.location) < (baseRadius * 2 + margin);
            });
            if (overlapping_location) {
                location.x = random() * (canvas.width - margin * 2) + margin;
                location.y = random() * (canvas.height - margin * 2) + margin;
            }
            else {
                break;
            }
        }
    }

    return location;
}

function getRandomElement(arr) {
    return arr[Math.floor(random() * arr.length)];
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
    if (isGameStarted() && serverDeltaTime < 5) {
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
        if (data.controlid != getBaseOwner(data.id)) return;
        const sentUnits = sendUnits(game_config.bases[data.id], game_config.bases[data.targetid], data.units, data.destinationid);
        updateUnits(sentUnits, game_state.time - data.time, false);
        game_state.bases[data.id].autotarget = data.forever ? data.targetid : null;
    }
    else if (messageType == MESSAGE_GAMESTATE) {
        updateGameState(data.game_state);
    }
    else if (messageType == MESSAGE_STARTGAME) {
        if (!isGameStarted()) {
            initFromConfig(data.game_config);
            updateGameState(data.game_state);
            localPlayerId = data.playerid;
            controlledPlayerId = data.controlid;
            console.log('Joined game as player ' + localPlayerId + ' with control over player ' + controlledPlayerId);
            startGame(data.game_options);
        }
        else {
            updateGameState(data.game_state);
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

function sendMessage_SendUnits(controlid, startBaseId, endBaseId, numUnits, destinationid = null, forever = false) {
    sendMessage({
        type: MESSAGE_UNITSMOVED,
        data: {
            time: game_state.time,
            id: startBaseId,
            targetid: endBaseId,
            controlid: controlid,
            units: numUnits,
            destinationid: destinationid,
            forever: forever
        }
    });
}

function sendMessage_startGame(playerid, controlid, game_options) {
    sendMessage({
        type: MESSAGE_STARTGAME,
        data: {
            playerid: playerid,
            controlid: controlid,
            game_state: game_state,
            game_options: game_options,
            game_config: game_config,
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
        neutralBases: game_config.roads_only ? [] : neutralBases,
        playerUnits: [],
        enemyUnits: [],
    };

    ownedBases.forEach((base) => {
        if (getBaseOwner(base.id) == playerid) {
            ai_state.playerBases.push(base);

        } else if (!game_config.roads_only) {
            ai_state.enemyBases.push(base);
        }
    });

    if (game_config.roads_only) {
        ai_state.playerBases.forEach((base) => {
            const roadBases = game_config.roads[base.id].map((roadid) => {
                return game_config.bases[roadid];
            });
            roadBases.forEach((roadBase) => {
                const ownerid = getBaseOwner(roadBase.id);
                if (ownerid == playerid) return;
                if (ownerid < 0) {
                    if (ai_state.neutralBases.find((neutralBase) => neutralBase.id == roadBase.id)) return;
                    ai_state.neutralBases.push(roadBase);
                }
                else {
                    if (ai_state.enemyBases.find((enemyBase) => enemyBase.id == roadBase.id)) return;
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
        const baseState = game_state.bases[base.id];
        if (baseState.units < 10) continue;
        const adjacentBases = game_config.roads[base.id].map((roadid) => { return game_config.bases[roadid]; });
        const adjacentUnowned = adjacentBases.find((adjacentBase) => { return getBaseOwner(adjacentBase.id) < 0 || getBaseOwner(adjacentBase.id) != getBaseOwner(base.id); });
        if (adjacentUnowned != null) continue;
        let lastNumAdjacent = 0;
        const friendlyBase = ai_state.playerBases.length <= 1 ? null : ai_state.playerBases.reduce((prev, curr) => {
            if (base.id == curr.id) return prev;
            if (!canSendUnits(base.id, curr.id)) return prev;
            const numAdjacent = game_config.roads[base.id].filter((roadid) => { return getBaseOwner(roadid) != getBaseOwner(curr.id); }).length;
            if (numAdjacent < lastNumAdjacent) return prev;
            lastNumAdjacent = numAdjacent;
            return getBaseUnits(prev.id) < getBaseUnits(curr.id) ? prev : curr;
        });
        if (friendlyBase == null) continue;
        const friendlyBaseState = game_state.bases[friendlyBase.id];
        const enemyTargeting = ai_state.enemyUnits.filter((unit) => unit.targetid == base.id);
        const friendlyTargeting = ai_state.enemyUnits.filter((unit) => unit.targetid == base.id);
        const adjustedUnits = friendlyBaseState.units - enemyTargeting.length + friendlyTargeting.length;
        if (adjustedUnits <= 5 && baseState.units >= (friendlyBaseState.units + 5)) {
            const sendUnitCount = Math.floor(baseState.units);
            input_sendUnits(ai_controller.controlid, base.id, friendlyBase.id, sendUnitCount);
            return;
        }
    }
}

// expands to the closest neutral base
function updateAI_greedyExpand(ai_controller, ai_state) {
    for (i = 0, n = ai_state.playerBases.length; i < n; i++) {
        const base = ai_state.playerBases[i];
        const baseState = game_state.bases[base.id];
        if (baseState.units < 10) continue;
        function canTargetNeutralBase(targetBase) {
            if (!canSendUnits(base.id, targetBase.id)) return false;
            if (ai_state.playerUnits.find((unit) => unit.targetid == targetBase.id)) return false;
            if (ai_state.enemyUnits.find((unit) => unit.targetid == targetBase.id)) return false;
            return true;
        }
        const neutralBase = ai_state.neutralBases.length <= 0 ? null : ai_state.neutralBases.reduce((prev, curr) => {
            if (prev == null) return canTargetNeutralBase(curr) ? curr : null;
            if (!canTargetNeutralBase(curr)) return canTargetNeutralBase(prev) ? prev : null;
            return prev.trainingRate > curr.trainingRate ? prev : curr;
        });
        if (neutralBase && baseState.units >= (getBaseUnits(neutralBase.id) + 3)) {
            const sendUnitCount = Math.floor(baseState.units);
            input_sendUnits(ai_controller.controlid, base.id, neutralBase.id, sendUnitCount);
            return;
        }
    }
}

// attacks vulnerable enemy bases if possible, else expands
function updateAI_attackExpand(ai_controller, ai_state) {
    for (i = 0, n = ai_state.playerBases.length; i < n; i++) {
        const base = ai_state.playerBases[i];
        const baseState = game_state.bases[base.id];
        if (baseState.units < 10) continue;
        function canTargetNeutralBase(targetBase) {
            if (!canSendUnits(base.id, targetBase.id)) return false;
            if (ai_state.playerUnits.find((unit) => unit.targetid == targetBase.id)) return false;
            if (ai_state.enemyUnits.find((unit) => unit.targetid == targetBase.id)) return false;
            return true;
        }
        const neutralBase = ai_state.neutralBases.length <= 0 ? null : ai_state.neutralBases.reduce((prev, curr) => {
            if (prev == null) return canTargetNeutralBase(curr) ? curr : null;
            if (!canTargetNeutralBase(curr)) return canTargetNeutralBase(prev) ? prev : null;
            return prev.trainingRate > curr.trainingRate ? prev : curr;
        });

        function canTargetEnemyBase(targetBase) {
            if (!canSendUnits(base.id, targetBase.id)) return false;
            if (ai_state.playerUnits.find((unit) => unit.targetid == targetBase.id)) return false;
            return true;
        }
        const enemyBase = ai_state.enemyBases.length <= 0 ? null : ai_state.enemyBases.reduce((prev, curr) => {
            if (prev == null) return canTargetEnemyBase(curr) ? curr : null;
            if (!canTargetEnemyBase(curr)) return canTargetEnemyBase(prev) ? prev : null;
            const currUnits = getBaseUnits(curr.id);
            if (currUnits < baseState.units + 2 && getBaseUnits(prev.id) > currUnits + 2) return curr;
            return prev.trainingRate > curr.trainingRate ? prev : curr;
        });
        if (enemyBase && baseState.units >= (game_state.bases[enemyBase.id].units + 15)) {
            const sendUnitCount = Math.floor(baseState.units);
            input_sendUnits(ai_controller.controlid, base.id, enemyBase.id, sendUnitCount);
            return;
        }
        else if (neutralBase && baseState.units >= (game_state.bases[neutralBase.id].units + 3)) {
            const sendUnitCount = Math.floor(baseState.units);
            input_sendUnits(ai_controller.controlid, base.id, neutralBase.id, sendUnitCount);
            return;
        }
    }
}

// attacks the closest enemy base with less than 10 units
function updateAI_zergRush(ai_controller, ai_state) {
    for (i = 0, n = ai_state.playerBases.length; i < n; i++) {
        const base = ai_state.playerBases[i];
        const baseState = game_state.bases[base.id];
        if (baseState.units < 6) continue;
        function canTargetEnemyBase(targetBase) {
            if (!canSendUnits(base.id, targetBase.id)) return false;
            if (ai_state.playerUnits.find((unit) => unit.targetid == targetBase.id)) return false;
            return true;
        };
        const enemyBase = ai_state.enemyBases.length <= 0 ? null : ai_state.enemyBases.reduce((prev, curr) => {
            if (prev == null) return canTargetEnemyBase(curr) ? curr : null;
            if (!canTargetEnemyBase(curr)) return canTargetEnemyBase(prev) ? prev : null;
            const currUnits = getBaseUnits(curr.id);
            if (currUnits < 10 && currUnits < getBaseUnits(prev.id)) return curr;
            return prev.trainingRate > curr.trainingRate ? prev : curr;
        });
        if (enemyBase) {
            const sendUnitCount = Math.floor(baseState.units);
            input_sendUnits(ai_controller.controlid, base.id, enemyBase.id, sendUnitCount);
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

    if (game_config.roads_only) {
        updateAI_reinforceBases(ai_controller, ai_state, deltaTime);
    }
}

// ------ GAME TICK ------

function updateState(deltaTime) {

    game_state.time += deltaTime;

    if (selectedBases.length > 0) {
        let newSelectedBases = [];
        selectedBases.forEach((id) => {
            if (getBaseOwner(id) == controlledPlayerId) {
                newSelectedBases.push(id);
            }
        });
        selectedBases = newSelectedBases;
    }

    if (hoveredBase) {
        hoveredTime += deltaTime;
        if (hoveredTime >= selectHoverTime && selectedBases.indexOf(hoveredBase.id) < 0) {
            selectedBases.push(hoveredBase.id);
            hoveredBase = null;
        }
    }

    game_state.bases.forEach((baseState) => {
        if (baseState.ownerid < 0 && baseState.units >= 10) return;
        baseState.units += game_config.bases[baseState.id].trainingRate * deltaTime;
        // Autosend units
        if (baseState.autotarget == null || baseState.units < 1) return;
        const base = game_config.bases[baseState.id];
        const unitCount = Math.floor(baseState.units);
        const shortestPath = getShortestPath(base.id, baseState.autotarget);
        if (shortestPath == null) {
            baseState.autotarget = null;
            return;
        }
        const nextBase = game_config.bases[shortestPath[0]];
        sendUnits(base, nextBase, unitCount, baseState.autotarget);
    });

    const newUnits = updateUnits(game_state.units, deltaTime);
    game_state.units = newUnits;

    if (isHost()) {
        // AI update
        let ownedBases = [];
        let neutralBases = [];
        game_config.bases.forEach((base) => {
            if (getBaseOwner(base.id) < 0) {
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
        for (let i = 0, n = game_config.bases.length; i < n; i++) {
            const base = game_config.bases[i];
            const ownerid = getBaseOwner(base.id);
            if (ownerid < 0) continue;
            if (winner == null) {
                winner = ownerid;
            }
            else if (winner != ownerid) {
                winner = null;
                break;
            }
        }
        if (winner != null) {
            for (let i = 0, n = game_state.units.length; i < n; i++) {
                const unit = game_state.units[i];
                if (unit.ownerid != winner) {
                    winner = null;
                    break;
                }
            }
        }
        if (winner != null) {
            sendMessage_playerWin(winner);
            handlePlayerWin(winner);
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

    game_config.roads.forEach((roads, id) => {
        const base = game_config.bases[id];
        roads.forEach((roadid) => {
            const roadBase = game_config.bases[roadid];
            const roadOwner = getBaseOwner(roadBase.id);
            const roadColor = getBaseOwner(base.id) == roadOwner ? getPlayerColor(roadOwner) : 'gray';
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
    game_config.bases.forEach((base) => {
        const { x, y } = base.location; // Get the x and y coordinates from the base's location
        const baseState = game_state.bases[base.id];
        const ownerid = baseState.ownerid;
        const radius = baseRadius;

        // Draw the base circle
        context.beginPath();
        context.arc(x, y, radius, 0, 2 * Math.PI);
        context.fillStyle = getPlayerColor(ownerid);
        context.fill();

        // Draw the player's stream image
        const playerStream = playerStreams[ownerid];
        if (playerStream) {
            const videoRadius = radius - 2; // Leave a small color border around the video
            const videoTrack = playerStream.stream.getVideoTracks()[0];
            const videoSettings = videoTrack.getSettings();
            const videoWidth = videoSettings.width;
            const videoHeight = videoSettings.height;
            const videoZoom = 4; // Adjust the zoom level here
            const videoScale = Math.min(videoRadius * 2 / videoWidth, videoRadius * 2 / videoHeight) * videoZoom;
            const videoScaledWidth = videoWidth * videoScale;
            const videoScaledHeight = videoHeight * videoScale;
            const videoScaledX = x - videoScaledWidth / 2;
            const videoScaledY = y - videoScaledHeight / 2;

            context.save();
            context.beginPath();
            context.arc(x, y, videoRadius, 0, 2 * Math.PI);
            context.clip();
            context.drawImage(playerStream.element, videoScaledX, videoScaledY, videoScaledWidth, videoScaledHeight);
            context.restore();

            // Draw the training rate above circle to not overlap video
            context.font = '15px Arial';
            context.fillStyle = 'black';
            context.textAlign = 'center';
            context.fillText('+' + base.trainingRate.toFixed(1), x - 3, y - 24);
        }
        else {
            // Draw the training rate inside circle
            context.font = '15px Arial';
            context.fillStyle = 'white';
            context.textAlign = 'center';
            context.fillText('+' + base.trainingRate.toFixed(1), x - 3, y + 5);
        }

        // Draw the number of units
        context.font = '20px Arial';
        context.fillStyle = 'black';
        context.textAlign = 'center';
        context.fillText(parseInt(baseState.units), x, y + radius + 20);
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
        selectedBases.forEach((id) => {
            const base = game_config.bases[id];
            const baseColor = getPlayerColor(getBaseOwner(dragStartBase.id));
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

    if (deltaTime > 1) {
        // Skip the frame if the delta time is too large
        lastFrameTime = currentTime;
    }
    else if (deltaTime >= frame_time) {
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

    checkForGestureNav();
    setTouchInputsLockedToGame(true);

    if (isHost()) {
        controlledPlayerId = 0;
        initGame(game_options);
    }
    else // init client
    {
        if (cameraCheckbox.checked) {
            startCamera(controlledPlayerId);
        }
    }

    drawBackground();

    // Start the game loop
    lastFrameTime = performance.now();
    update();
}

function stopGame() {
    lastFrameTime = null;
    setTouchInputsLockedToGame(false);
}
