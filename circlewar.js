// circlewar.js
// @author Hunter Delattre

// ------ DOM ELEMENTS ------
const gameWindow = document.getElementById('gameWindow');
const canvas = document.getElementById('gameCanvas');
const context = canvas.getContext('2d');
const gameControls = document.getElementById('gameControls');
const mapEditorControls = document.getElementById('mapEditorControls');
const leaveGameButton = document.getElementById('leaveGameButton');
const restartGameButton = document.getElementById('restartGameButton');
const saveMapButton = document.getElementById('saveMapButton');
const saveAsMapButton = document.getElementById('saveAsMapButton');
const copyMapButton = document.getElementById('copyMapButton');

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

const AUTOSAVE_NAME = '_autosave';
const SAVE_CONFIG_SUFFIX = '_config';
const SAVE_STATE_SUFFIX = '_state';
const SAVE_MAP_PREFIX = 'map_';
let restartSeed = null;
let shortestPathImpl = null;

// All players init
function initFromConfig(config) {

    game_config = config;

    game_config.owned_adjacent = false;
    if (game_config.roads_only) {
        shortestPathImpl = game_config.bases.length < 120 ? shortestPath_Dijkstra : shortestPath_AStarBases;
    }

    // Init map size
    setGameCanvasSize(config.map_size.x, config.map_size.y);
}

// Host only
function initGame(game_options) {

    const isRandomMap = game_options.map_name == null;

    let config = null;
    let loadedState = null;

    if (!isRandomMap) {
        config = loadMap(game_options.map_name);
        config.ai_players = game_options.num_ai_players;
        loadedState = loadGameState(SAVE_MAP_PREFIX + config.map_name);
    }
    if (config == null) {
        const seed = game_options.seed < 0 ? Math.floor(Math.random() * 1000000) : game_options.seed;
        config = {
            map_name: null,
            seed: seed,
            map_size: game_options.map_size,
            bases: [],
            roads: [],
            roads_only: game_options.roads_enabled,
            ai_players: game_options.num_ai_players,
            game_speed: game_options.game_speed,
        }
    }

    initFromConfig(config);

    resetRandomSeed(game_config.seed);

    if (isRandomMap) {
        generateMap(game_options.num_bases, game_config.roads_only);
    }

    restartSeed = seededRandom ? seededRandom.seed : null;

    if (loadedState) {
        game_state = loadedState;
        basesDrawDirty = true;
        initPlayers();
    }
    else {
        resetGameState();
    }
}

function resetRandomSeed(seed) {
    if (seed < 0) {
        random = Math.random;
        seededRandom = null;
    }
    else {
        seededRandom = new SeededRandom(seed);
        random = seededRandom.next.bind(seededRandom);
    }
}

function resetGameState() {
    game_state = {
        time: 0,
        speed: game_config.game_speed,
        players: [],
        bases: [],
        units: [],
    };
    ai_controllers = [];

    for (let i = game_state.bases.length, n = game_config.bases.length; i < n; i++) {
        game_state.bases.push({
            id: game_config.bases[i].id,
            ownerid: -1,
            units: 10,
            autotarget: null,
        });
    }
    basesDrawDirty = true;

    initPlayers();
}

function generateMap(num_bases, roads_only) {
    // Init bases
    for (let i = 0; i < num_bases; i++) {
        const newBase = {
            id: game_config.bases.length,
            trainingRate: .2 + random(),
            unittype: UNIT_SOLDIER,
            location: getRandomLocation(baseRadius + baseMinDist, game_config.bases)
        };
        addBase(newBase);
    }

    // Init roads
    if (roads_only) {
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
}

function initPlayers() {
    if (editingMap) return;

    addPlayer('Host');

    connectedPlayers.forEach((player) => {
        addPlayer(player.name);
    });

    const num_ai = game_config.ai_players;
    const ai_names = [ 'HERB', 'ROSEMARY', 'THYME', 'SAGE', 'OREGANO', 'BASIL', 'MINT', 'PARSLEY', 'DILL', 'CHIVE' ];
    for (let i = 0; i < num_ai; i++) {
        addAIPlayer(ai_names[i]);
    }
}

function saveGameState(saveName) {
    localStorage.setItem(saveName + SAVE_STATE_SUFFIX, JSON.stringify(game_state));
}

function loadGameState(saveName) {
    const savedStateStr = localStorage.getItem(saveName + SAVE_STATE_SUFFIX);
    if (savedStateStr == null) return;
    return JSON.parse(savedStateStr);
}

function saveGame(saveName, gameConfig, gameState) {
    localStorage.setItem(saveName + SAVE_CONFIG_SUFFIX, JSON.stringify(gameConfig));
    localStorage.setItem(saveName + SAVE_STATE_SUFFIX, JSON.stringify(gameState));
}

function loadGame(saveName) {
    const savedConfig = loadMap(saveName);
    if (!savedConfig) return false;
    const configMatches = (savedConfig.map_name && game_config.map_name == savedConfig.map_name) ||
        (game_config.seed == savedConfig.seed &&
        game_config.map_size.x == savedConfig.map_size.x &&
        game_config.map_size.y == savedConfig.map_size.y &&
        game_config.roads_only == savedConfig.roads_only &&
        game_config.bases.length == savedConfig.bases.length &&
        game_config.ai_players == savedConfig.ai_players);

    if (configMatches) {
        const loadedState = loadGameState(saveName);
        if (loadedState) {
            game_state = loadedState;
            return true;
        }
    }
    return false;
}

function clearSaveGame(saveName) {
    localStorage.removeItem(saveName + SAVE_CONFIG_SUFFIX);
    localStorage.removeItem(saveName + SAVE_STATE_SUFFIX);
}

function handlePlayerWin(winnerid) {
    stopGame();
    const winning_player = game_state.players[winnerid];
    console.log('Player ' + winnerid + ' wins!');
    gameOver(winnerid, winning_player.name, winning_player.color);

    clearSaveGame(AUTOSAVE_NAME);

    addGifStateFrame(1000);
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
    const unowned_bases = game_config.bases.filter((base) => {
        return getBaseOwner(base.id) < 0;
    });
    const owned_base = game_config.bases.find((base) => { return getBaseOwner(base.id) == playerIndex });
    if (owned_base == null) {
        assignStartBase(getRandomElement(unowned_bases), player.id);
    }

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
    game_config.bases.push(base);
    game_config.roads.push([]);
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

function getShortestPath(startBaseId, endBaseId) {
    if (!game_config.roads_only || game_config.roads[startBaseId].indexOf(endBaseId) >= 0) { return [endBaseId]; }
    const ownedAdjacent = game_config.ownedAdjacent && game_config.roads_only;
    return shortestPathImpl(startBaseId, endBaseId, ownedAdjacent);
}

function shortestPath_Dijkstra(startBaseId, endBaseId, ownedAdjacent) {
    const startBaseOwner = getBaseOwner(startBaseId);
    const visited = [];
    const queue = [];
    const prev = [];
    queue.push(startBaseId);
    visited[startBaseId] = true;
    while (queue.length > 0) {
        const currentBaseId = queue.shift();
        const neighbors = game_config.roads[currentBaseId];
        for (let i = 0; i < neighbors.length; i++) {
            const neighborBaseId = neighbors[i];
            if (ownedAdjacent && getBaseOwner(neighborBaseId) != startBaseOwner) continue;
            if (!visited[neighborBaseId]) {
                visited[neighborBaseId] = true;
                prev[neighborBaseId] = currentBaseId;
                if (neighborBaseId === endBaseId) {
                    // Found the shortest path, reconstruct and return it
                    const path = [];
                    let baseId = endBaseId;
                    while (baseId !== startBaseId) {
                        path.unshift(baseId);
                        baseId = prev[baseId];
                    }
                    return path;
                }
                queue.push(neighborBaseId);
            }
        }
    }

    // No path found
    return null;

}

let shortestPath_AStarBases = function (startBaseId, endBaseId, ownedAdjacent) {
    return shortestPath_AStar(startBaseId, endBaseId, ownedAdjacent, getBaseDistance);
}

function shortestPath_AStar(startBaseId, endBaseId, ownedAdjacent, heuristic = getBaseDistance) {
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
            if (ownedAdjacent && getBaseOwner(neighborBaseId) != startBaseOwner) continue;
            const tentativeGScore = gScore[currentBaseId] + 1;
            if (!visited[neighborBaseId] || tentativeGScore < gScore[neighborBaseId]) {
                visited[neighborBaseId] = true;
                prev[neighborBaseId] = currentBaseId;
                gScore[neighborBaseId] = tentativeGScore;
                fScore[neighborBaseId] = gScore[neighborBaseId] + heuristic(neighborBaseId, endBaseId);
                if (!queue.includes(neighborBaseId)) {
                    queue.push(neighborBaseId);
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
                        basesDrawDirty = true;
                        dirtyBaseCaptures.push({ baseid: targetBase.id, ownerid: baseState.ownerid });
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
    return playerId >= 0 ? playerSlots[playerId].color : 'gray';
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

function setGameCanvasSize(width, height) {
    canvas.width = width;
    canvas.height = height;
    backgroundCanvas.width = canvas.width;
    backgroundCanvas.height = canvas.height;
    basesCanvas.width = canvas.width;
    basesCanvas.height = canvas.height;

    refreshCanvasStyleSize();
}

function refreshCanvasStyleSize() {
    const windowHeightFactor = 0.9;
    const aspectRatio = canvas.width / canvas.height;
    const windowRatio = window.innerWidth / (window.innerHeight * windowHeightFactor);
    // If window ratio is greater, height is the limiting factor
    if (windowRatio > aspectRatio) {
        canvas.style.width = 'auto';
        canvas.style.height = windowHeightFactor * 100 + '%';
    } else {
        // Width is the limiting factor
        canvas.style.width = '100%';
        canvas.style.height = 'auto';
    }
}

function handleWindowResize() {
    refreshCanvasStyleSize();
    checkForGestureNav();
}

// Listen for resize events which might indicate a change in navigation mode
window.addEventListener('resize', handleWindowResize);

const preventSwipeGesture = function(event) {
    const touchX = event.touches[0].touchX;
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

gameWindow.addEventListener('touchstart', handleTouchStart, { passive: false });
gameWindow.addEventListener('touchmove', handleTouchMove, { passive: false });
gameWindow.addEventListener('touchend', handleTouchUp, { passive: false });
gameWindow.addEventListener('touchcancel', handleTouchUp, { passive: false });

gameWindow.addEventListener('mousedown', handleMouseDown);
gameWindow.addEventListener('mousemove', handleMouseMove);
gameWindow.addEventListener('mouseup', handleMouseUp);

window.addEventListener('keydown', handleArrowKeysPressed);
window.addEventListener('keyup', handleArrowKeysReleased);

leaveGameButton.addEventListener('click', leaveGame);
restartGameButton.addEventListener('click', restartGame);
saveMapButton.addEventListener('click', saveEditedMap);
saveAsMapButton.addEventListener('click', saveAsEditedMap);
copyMapButton.addEventListener('click', copyMapToClipboard);

let editingMap = false;
let editBaseOwner = -1;

let isDragging = false;
let dragStartBase = null;
let dragLocation = null;
let dragEndBase = null;
let hoveredBase = null;
let hoveredTime = 0;
let lastTouchDistance = 0;
let inputAxis = { x: 0, y: 0 };
const selectMargin = 35;
const selectHoverTime = 0.3;
let selectedBases = [];
const doubleClickMs = 300;
let lastClickTime = 0;
let doubleClick = false;

let isMultitouching = false;

function canDragBase(base) {
    return editingMap || getBaseOwner(base.id) === controlledPlayerId;
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
    const selectRadius = baseRadius + selectMargin;
    return selectRadius;
}

function getCanvasScaleFactor() {
    return canvas.clientWidth / canvas.width;
}

function getZoomFactor() {
    return window.outerWidth / window.innerWidth;
}

function selectBase(location, canSelect = (base) => true) {
    let minDistance = Infinity;
    const selectZoomFactor = editingMap ? 1 : getZoomFactor() * getCanvasScaleFactor();
    return game_config.bases.reduce((prev, curr) => {
        if (!canSelect(curr)) return prev;
        const distance = getDistance(location, curr.location);
        const selectRadius = getBaseSelectRadius(curr) / selectZoomFactor;
        if (distance > selectRadius) return prev;
        if (distance < minDistance) {
            minDistance = distance;
            return curr;
        }
        return prev;
    }, null);
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
    else if (event.touches.length == 2) {
        isMultitouching = true;
        isDragging = false;
        setTouchInputsLockedToGame(false);
        const touch1Location = { x: event.touches[0].clientX, y: event.touches[0].clientY };
        const touch2Location = { x: event.touches[1].clientX, y: event.touches[1].clientY };
        lastTouchDistance = getDistance(touch1Location, touch2Location);
    }
}

function handleTouchMove(event) {
    if (!isGameStarted()) return;
    if (event.touches.length == 1) {
        handleMouseMove(event);
    }
    else if (event.touches.length == 2) {
        const touch1Location = { x: event.touches[0].clientX, y: event.touches[0].clientY };
        const touch2Location = { x: event.touches[1].clientX, y: event.touches[1].clientY };
        const newTouchDistance = getDistance(touch1Location, touch2Location);
        if (getZoomFactor() <= 1 && newTouchDistance < lastTouchDistance) {
            event.preventDefault();
        }
        lastTouchDistance = newTouchDistance;
    }
    else {
        event.preventDefault();
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

function handleArrowKeysPressed(event) {
    if (!isGameStarted() || !editingMap) return;
    const key = event.key;
    if (key == 'ArrowLeft' || key == 'a') inputAxis.x = -1;
    if (key == 'ArrowRight' || key == 'd') inputAxis.x = 1;
    if (key == 'ArrowUp' || key == 'w') inputAxis.y = 1;
    if (key == 'ArrowDown' || key == 's') inputAxis.y = -1;
}

function handleArrowKeysReleased(event) {
    if (!isGameStarted() || !editingMap) return;
    const key = event.key;
    if (key == 'ArrowLeft' || key == 'a') inputAxis.x = 0;
    if (key == 'ArrowRight' || key == 'd') inputAxis.x = 0;
    if (key == 'ArrowUp' || key == 'w') inputAxis.y = 0;
    if (key == 'ArrowDown' || key == 's') inputAxis.y = 0;
}

function resetDragging() {
    dragStartBase = null;
    dragEndBase = null;
    dragLocation = null;
    hoveredBase = null;
    hoveredTime = 0;
    selectedBases = [];
}

function isLocationInsideCanvas(location, margin = 0) {
    return location.x > margin && location.x < (canvas.width - margin) && location.y > margin && location.y < (canvas.height - margin);
}

function input_clickLocation(location) {
    doubleClick = (lastFrameTime - lastClickTime) < doubleClickMs;
    lastClickTime = lastFrameTime;
    const selectedBase = selectBase(location, canDragBase);

    if (selectedBase) {
        resetDragging();
        dragStartBase = selectedBase;
        isDragging = true;
        selectedBases.push(dragStartBase.id);
    }
    else if (editingMap) {
        if (!isLocationInsideCanvas(location, baseMinDist + 5)) return;
        const newBase = {
            id: game_config.bases.length,
            trainingRate: .5,
            unittype: UNIT_SOLDIER,
            location: location
        };
        addBase(newBase);
        game_state.bases.push({
            id: newBase.id,
            ownerid: -1,
            units: 10,
            autotarget: null,
        });
        basesDrawDirty = true;
        hoveredBase = newBase;
        hoveredTime = 0;
    }
}

function input_hoverLocation(location) {
    if (isDragging && !canDragBase(dragStartBase)) {
        isDragging = false;
    }

    const newHoveredBase = selectBase(location);
    if (!hoveredBase || !newHoveredBase || newHoveredBase.id != hoveredBase.id) {
        hoveredBase = newHoveredBase && canDragBase(newHoveredBase) ? newHoveredBase : null;
        hoveredTime = 0;
    }
}

function input_releaseLocation(location) {
    if (!isDragging) return;
    if (!canDragBase(dragStartBase)) {
        isDragging = false;
        return;
    }

    dragEndBase = selectBase(location);
    if (dragStartBase && dragEndBase) {
        if (editingMap) {
            if (dragStartBase == dragEndBase && (lastFrameTime - lastClickTime) >= 1) {
                const ownerid = getBaseOwner(dragStartBase.id);
                if (ownerid >= 0) {
                    editBaseOwner += 1;
                    if (editBaseOwner >= playerSlots.length) editBaseOwner = -1;
                }
                else if (editBaseOwner < 0) {
                    editBaseOwner = 0;
                }
                game_state.bases[dragStartBase.id].ownerid = editBaseOwner;
            }
            else {
                selectedBases.forEach((id) => {
                    if (game_config.roads[id].indexOf(dragEndBase.id) < 0) {
                        game_config.roads[id].push(dragEndBase.id);
                        game_config.roads[dragEndBase.id].push(id);
                    }
                });
            }
            basesDrawDirty = true;
        }
        else {
            selectedBases.forEach((id) => {
                if (getBaseOwner(id) != getBaseOwner(dragStartBase.id)) return;
                if (id == dragEndBase.id) return;
                const baseState = game_state.bases[id];
                const unitCount = Math.floor(baseState.units);
                input_sendUnits(controlledPlayerId, id, dragEndBase.id, unitCount, doubleClick);
            });
        }
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
    basesDrawDirty = true;
    // Set time back to simulate forward from the new state
    if (isGameStarted() && serverDeltaTime < 5) {
        lastFrameTime -= serverDeltaTime;
    }
}

const MESSAGE_GAMESTATE = 0;
const MESSAGE_STARTGAME = 1;
const MESSAGE_PLAYERWIN = 2;
const MESSAGE_UNITSMOVED = 3;

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
            if (base.id == curr.id || !canSendUnits(base.id, curr.id)) return prev;
            const numAdjacent = game_config.roads[base.id].filter((roadid) => { return getBaseOwner(roadid) != getBaseOwner(curr.id); }).length;
            if (numAdjacent < lastNumAdjacent) return prev;
            lastNumAdjacent = numAdjacent;
            return prev && getBaseUnits(prev.id) < getBaseUnits(curr.id) ? prev : curr;
        }, null);
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
            if (!canTargetNeutralBase(curr)) return prev;
            return prev && prev.trainingRate > curr.trainingRate ? prev : curr;
        }, null);
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
            if (!canTargetNeutralBase(curr)) return prev;
            return prev && prev.trainingRate > curr.trainingRate ? prev : curr;
        }, null);

        function canTargetEnemyBase(targetBase) {
            if (!canSendUnits(base.id, targetBase.id)) return false;
            if (ai_state.playerUnits.find((unit) => unit.targetid == targetBase.id)) return false;
            return true;
        }
        const enemyBase = ai_state.enemyBases.length <= 0 ? null : ai_state.enemyBases.reduce((prev, curr) => {
            if (!canTargetEnemyBase(curr)) return prev;
            const currUnits = getBaseUnits(curr.id);
            if (prev == null) return curr;
            if (currUnits < baseState.units + 2 && getBaseUnits(prev.id) > currUnits + 2) return curr;
            return prev.trainingRate > curr.trainingRate ? prev : curr;
        }, null);
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
            if (!canTargetEnemyBase(curr)) return prev;
            const currUnits = getBaseUnits(curr.id);
            if (prev == null) return curr;
            if (currUnits < 10 && currUnits < getBaseUnits(prev.id)) return curr;
            return prev.trainingRate > curr.trainingRate ? prev : curr;
        }, null);
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

    updateInput(deltaTime);

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

function updateInput(deltaTime) {
    if (hoveredBase) {
        hoveredTime += deltaTime;
        if (isDragging && hoveredTime >= selectHoverTime && selectedBases.indexOf(hoveredBase.id) < 0) {
            if (editingMap) {
                selectedBases.forEach((id) => {
                    if (game_config.roads[id].indexOf(hoveredBase.id) < 0) {
                        game_config.roads[id].push(hoveredBase.id);
                        game_config.roads[hoveredBase.id].push(id);
                    }
                });
                basesDrawDirty = true;
            }
            selectedBases.push(hoveredBase.id);
            hoveredBase = null;
        }
        else if (editingMap) {
            if (inputAxis.y != 0) {
                const updatedTrainingRate = hoveredBase.trainingRate + inputAxis.y * deltaTime * 0.25;
                hoveredBase.trainingRate = Math.max(0, updatedTrainingRate);
                basesDrawDirty = true;
            }
        }
    }
}

// ------ RENDERING ------
const backgroundCanvas = document.createElement('canvas');
const backgroundContext = backgroundCanvas.getContext('2d');
const basesCanvas = document.createElement('canvas');
const basesContext = basesCanvas.getContext('2d');
let basesDrawDirty = false;
let dirtyBaseCaptures = [];
let gifFrames = [];
let drawsToNextSnapshot = 0;
let downloadGifListener = null;

// Draw the background on the offscreen canvas
function drawBackground() {
    if (editingMap) {
        backgroundContext.fillStyle = 'black';
        backgroundContext.fillRect(0, 0, backgroundCanvas.width, backgroundCanvas.height);
    }
    else {
        backgroundContext.clearRect(0, 0, backgroundCanvas.width, backgroundCanvas.height);
    }
}

function drawBases_Game(bases, basesState, drawContext, scale = 1) {
    bases.forEach((base) => {
        const x = base.location.x * scale;
        const y = base.location.y * scale;
        const ownerid = basesState[base.id].ownerid;
        const radius = baseRadius * scale;

        // Draw the base circle
        drawContext.beginPath();
        drawContext.arc(x, y, radius, 0, 2 * Math.PI);
        drawContext.fillStyle = getPlayerColor(ownerid);
        drawContext.fill();
    });
}

function drawBases_Map(bases, basesState, drawContext, scale = 1) {
    bases.forEach((base) => {
        const x = base.location.x * scale;
        const y = base.location.y * scale;
        const baseState = basesState[base.id];
        const ownerid = baseState.ownerid;
        // scale size with unit count
        const unitscale = Math.min(4, 0.5 + (baseState.units / 50));
        const radius = baseRadius * scale * unitscale;

        // Draw the base circle
        drawContext.beginPath();
        drawContext.arc(x, y, radius, 0, 2 * Math.PI);
        drawContext.fillStyle = getPlayerColor(ownerid);
        drawContext.fill();
    });
}

function drawMap(basesState, drawCanvas, drawContext, scale = 1, drawBasesImpl = drawBases_Game) {
    drawContext.clearRect(0, 0, drawCanvas.width, drawCanvas.height);

    game_config.roads.forEach((roads, id) => {
        const base = game_config.bases[id];
        const lineWidth = 5 * scale;
        roads.forEach((roadid) => {
            const roadBase = game_config.bases[roadid];
            const roadOwner = basesState[roadid].ownerid;
            const baseOwner = basesState[base.id].ownerid;
            const roadColor = baseOwner == roadOwner ? getPlayerColor(roadOwner) : 'gray';
            drawContext.beginPath();
            drawContext.strokeStyle = makeColorTranslucent(roadColor, 0.5);
            drawContext.lineWidth = lineWidth;
            drawContext.lineCap = 'round';
            drawContext.moveTo(base.location.x * scale, base.location.y * scale);
            drawContext.lineTo(roadBase.location.x * scale, roadBase.location.y * scale);
            drawContext.stroke();
        });
    });

    drawBasesImpl(game_config.bases, basesState, drawContext, scale);
}

function drawBaseState(base) {
    const { x, y } = base.location; // Get the x and y coordinates from the base's location
    const baseState = game_state.bases[base.id];
    const ownerid = baseState.ownerid;
    const radius = baseRadius;

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
}

function drawBaseState_Editor(base) {
    const { x, y } = base.location; // Get the x and y coordinates from the base's location
    const baseState = game_state.bases[base.id];
    const ownerid = baseState.ownerid;
    const radius = baseRadius;

    context.font = '15px Arial';
    context.fillStyle = 'white';
    context.textAlign = 'center';
    context.fillText('+' + base.trainingRate.toFixed(1), x - 3, y + 5);
}

function drawUnit(unit) {
    const { x, y } = unit.location;
    const owner = game_state.players[unit.ownerid];
    const radius = 10;

    // Draw the unit circle
    context.beginPath();
    context.arc(x, y, radius, 0, 2 * Math.PI);
    context.fillStyle = owner.color;
    context.fill();
}

function draw(drawBaseStateImpl = drawBaseState, drawUnitImpl = drawUnit) {
    // Clear the canvas
    context.clearRect(0, 0, canvas.width, canvas.height);

    if (basesDrawDirty) {
        drawMap(game_state.bases, basesCanvas, basesContext);
        basesDrawDirty = false;

        drawsToNextSnapshot -= 1;
        if (drawsToNextSnapshot <= 0) {
            drawsToNextSnapshot = 2;
            if (dirtyBaseCaptures.length > 0) {
                addGifDeltaFrame(dirtyBaseCaptures.slice());
                dirtyBaseCaptures = [];
            }
        }
    }

    // Draw the cached background onto the main canvas
    context.drawImage(backgroundCanvas, 0, 0);
    context.drawImage(basesCanvas, 0, 0);

    // Render game objects
    game_config.bases.forEach((base) => {
        drawBaseStateImpl(base);
    });

    game_state.units.forEach((unit) => {
        drawUnitImpl(unit);
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

const GIF_STATE = 0;
const GIF_DELTA = 1;

function addGifStateFrame(delay = 50) {
    const frameState = game_state.bases.map((base) => {
        return { ownerid: base.ownerid, units: base.units };
    });
    gifFrames.push({ type: GIF_STATE, frameState: frameState, delay: delay });
}

function addGifDeltaFrame(baseCaptures, delay = 50) {
    const baseUnits = game_state.bases.map((base) => {
        return base.units;
    });
    gifFrames.push({ type: GIF_DELTA, baseCaptures: baseCaptures, baseUnits: baseUnits, delay: delay });
}

function renderGameGif() {
    const gifScale = 0.5;
    const gifWidth = Math.floor(basesCanvas.width * gifScale);
    const gifHeight = Math.floor(basesCanvas.height * gifScale);
    const gameGif = new GIF({width: gifWidth, height: gifHeight, workers: 2, quality: 5, workerScript: 'thirdparty/gifjs/gif.worker.js'});
    gameGif.on('finished', (blob) => {
        gameGifButton.removeEventListener("click", downloadGifListener);
        downloadGifListener = () => {
            const gifLink = document.createElement("a");
            gifLink.href = gifUrl;
            gifLink.download = "circlewar-game.gif"; // Specify the file name for downloading
            gifLink.click();
        };
        const gifUrl = URL.createObjectURL(blob);
        gameGifButton.textContent = "Download Game Gif";
        gameGifButton.addEventListener("click", downloadGifListener);

        gameGifImage.src = gifUrl;
        gameGifImage.style.display = "inline";
        gameGifButton.style.display = "none";
    });

    let lastFrameState = null;
    gifFrames.forEach((gifFrame) => {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = gifWidth;
        tempCanvas.height = gifHeight;
        if (gifFrame.type == GIF_STATE) {
            lastFrameState = gifFrame.frameState;
        }
        else if (gifFrame.type == GIF_DELTA) {
            gifFrame.baseCaptures.forEach((baseCapture) => {
                const baseState = lastFrameState[baseCapture.baseid];
                baseState.ownerid = baseCapture.ownerid;
            });
            gifFrame.baseUnits.forEach((baseUnit, index) => {
                lastFrameState[index].units = baseUnit;
            });
        }

        drawMap(lastFrameState, tempCanvas, tempCanvas.getContext('2d'), gifScale, drawBases_Map);
        gameGif.addFrame(tempCanvas, {delay: gifFrame.delay});
    });
    gameGif.render();
}

// ------ GAME LOOP ------

const frame_time = 1 / 60;
let lastFrameTime = null;

const stateUpdateInterval = 5;
let nextStateUpdate = stateUpdateInterval;

function update(timestamp) {
    if (lastFrameTime == null) return;
    const deltaTime = (timestamp - lastFrameTime) / 1000;

    if (deltaTime > 1) {
        // Skip simulating the frame if the delta time is too large
        lastFrameTime = timestamp;
    }
    else if (deltaTime >= frame_time) {
        lastFrameTime = timestamp;
        updateState(deltaTime * game_state.speed);
        drawBaseStateFunc = editingMap ? drawBaseState_Editor : drawBaseState;
        draw(drawBaseStateFunc);
        if (autoSaveCheckbox.checked && !editingMap) {
            saveGameState(AUTOSAVE_NAME);
        }
    }

    if (isHost()) {
        nextStateUpdate -= deltaTime;
        if (nextStateUpdate <= 0) {
            nextStateUpdate = stateUpdateInterval;
            sendMessage_gameState();
        }
    }

    requestAnimationFrame(update);
}

function isGameStarted() {
    return lastFrameTime != null;
}

function startGame(game_options) {
    if (isGameStarted()) return;

    editingMap = false;

    gameControls.style.display = "inline";
    mapEditorControls.style.display = "none";

    checkForGestureNav();
    setTouchInputsLockedToGame(true);

    if (isHost()) {
        restartGameButton.style.display = "inline";
        controlledPlayerId = 0;
        initGame(game_options);
        if (!autoSaveCheckbox.checked || !loadGame(AUTOSAVE_NAME)) {
            saveGame(AUTOSAVE_NAME, game_config, game_state);
        }
    }
    else { // init client
        restartGameButton.style.display = "none";
        if (cameraCheckbox.checked) {
            startCamera(controlledPlayerId);
        }
    }

    drawBackground();
    drawMap(game_state.bases, basesCanvas, basesContext);

    gifFrames = [];
    drawsToNextSnapshot = 0;
    gameGifButton.style.display = "inline";
    gameGifImage.style.display = "none";
    gameGifButton.textContent = "Generate Game Gif";
    gameGifButton.removeEventListener("click", downloadGifListener);
    downloadGifListener = () => {
        gameGifButton.textContent = "Generating Gif...";
        renderGameGif();
    };
    gameGifButton.addEventListener("click", downloadGifListener);
    addGifStateFrame(1000);

    // Start the game loop
    lastFrameTime = performance.now();
    requestAnimationFrame(update);
}

function restartGame() {
    if (isGameStarted()) {
        if (restartSeed != null) {
            resetRandomSeed(restartSeed);
        }
        resetGameState();
    }
}

function stopGame() {
    lastFrameTime = null;
    setTouchInputsLockedToGame(false);
}

function leaveGame() {
    if (isGameStarted()) {
        stopGame();
        returnToMenu();
    }
}

// ------ MAP EDITOR ------

function update_MapEditor(timestamp) {
    if (lastFrameTime == null) return;
    const deltaTime = (timestamp - lastFrameTime) / 1000;

    if (deltaTime >= frame_time) {
        lastFrameTime = timestamp;
        updateInput(deltaTime);
        draw();
    }

    requestAnimationFrame(update_MapEditor);
}

function startMapEditor(game_options) {
    if (isGameStarted()) return;

    editingMap = true;
    editBaseOwner = -1;

    checkForGestureNav();
    setTouchInputsLockedToGame(true);

    gameControls.style.display = "none";
    mapEditorControls.style.display = "inline";
    saveAsMapButton.style.display = game_options.map_name == null ? "none" : "inline";

    const editorGameOptions = {
        map_name: game_options.map_name,
        seed: game_options.seed,
        num_ai_players: game_options.num_ai_players,
        num_bases: 0,
        roads_enabled: true,
        map_size: game_options.map_size,
        game_speed: 1,
    };
    initGame(editorGameOptions);

    drawBackground();
    drawMap(game_state.bases, basesCanvas, basesContext);

    lastFrameTime = performance.now();
    requestAnimationFrame(update_MapEditor);
}

function isValidMapName(mapName) {
    return mapName && mapName.length > 0 && mapName.length <= 50;
}

function saveEditedMap() {
    if (!editingMap || !isGameStarted()) return;

    if (saveMap(game_config, game_state)) {
        setSelectedLevelName(game_config.map_name);

        leaveGame();
    }
}

function saveAsEditedMap() {
    if (!editingMap || !isGameStarted()) return;

    const mapName = prompt("Enter a name for the map:").trim();
    if (!isValidMapName(mapName)) {
        return;
    }
    game_config.map_name = mapName;

    saveEditedMap();
}

function saveMap(mapConfig, mapState) {
    let mapName = mapConfig.map_name;
    if (!isValidMapName(mapName)) {
        mapName = prompt("Enter a name for the map:").trim();
    }
    if (!isValidMapName(mapName)) {
        return false;
    }
    mapConfig.map_name = mapName;

    const mapSaveName = SAVE_MAP_PREFIX + mapName;
    const mapConfigName = mapSaveName + SAVE_CONFIG_SUFFIX;
    const mapExists = localStorage.getItem(mapConfigName) != null;
    if (mapExists) {
        if (!confirm("Overwrite existing map '" + mapName + "'?")) {
            return false;
        }
    }

    localStorage.setItem(mapConfigName, JSON.stringify(mapConfig));
    localStorage.setItem(mapSaveName + SAVE_STATE_SUFFIX, JSON.stringify(mapState));

    if (!mapExists) {
        const mapListStr = localStorage.getItem('mapList');
        const mapList = mapListStr ? JSON.parse(mapListStr) : [];
        mapList.push(mapName);
        localStorage.setItem('mapList', JSON.stringify(mapList));
        addCustomMapToList(mapName);
    }

    return true;
}

function loadMap(mapName) {
    const mapSaveName = SAVE_MAP_PREFIX + mapName;
    const mapConfigStr = localStorage.getItem(mapSaveName + SAVE_CONFIG_SUFFIX);
    if (!mapConfigStr) return null;
    const mapConfig = JSON.parse(mapConfigStr);
    return mapConfig;
}

function copyMapToClipboard() {
    if (!isGameStarted()) return;

    function setCopyText(text) {
        copyMapButton.textContent = text;
        setTimeout(() => {
            copyMapButton.textContent = "Copy Map";
        }, 1000);
    }

    const mapData = { config: game_config, state: game_state };
    const mapConfig = JSON.stringify(mapData);
    navigator.clipboard.writeText(mapConfig).then(() => {
        setCopyText("Copied!");
    }, (err) => {
        setCopyText("Error!");
    });
}

// ------ LEVELS -------

const challenge_levels = [
    { name: 'Bunny Hill', seed: 234, ai_players: 1, bases: 16, map_size: { x: 400, y: 400 } },
    { name: 'GoodTime', seed: 89809, ai_players: 1, bases: 23, map_size: { x: 500, y: 400 } },
    { name: 'Punchout', seed: 797963, ai_players: 3, bases: 30, map_size: { x: 400, y: 800 } },
    { name: 'Lovely Circle', seed: 697852, ai_players: 7, bases: 18, map_size: { x: 900, y: 900 } },
    { name: 'Paper Crane', seed: 223968, ai_players: 7, bases: 18, map_size: { x: 900, y: 900 } },
    { name: 'Crescent', seed: 820505, ai_players: 4, bases: 20, map_size : { x: 1800, y: 900 } },
    { name: 'The Wheel', seed: 797963, ai_players: 3, bases: 30, map_size: { x: 1600, y: 800 } },
    { name: 'Stamford Bridge', seed: 815694, ai_players: 4, bases: 45, map_size: { x: 1900, y: 900 } },
    { name: 'Old Boy', seed: 520491, ai_players: 4, bases: 60, map_size: { x: 1800, y: 400 } },
    { name: 'Older Boy', seed: 520491, ai_players: 4, bases: 60, map_size: { x: 1800, y: 80 } },
    { name: 'The Gauntlet', seed: 740316, ai_players: 4, bases: 66, map_size: { x: 1800, y: 900 } },
    { name: 'Tryouts', seed: 688281, ai_players: 7, bases: 66, map_size: { x: 1700, y: 900 } },
    { name: 'Broken Circle', seed: 283828, ai_players: 7, bases: 52, map_size: { x: 900, y: 900 } },
    { name: 'Impossible', seed: 295074, ai_players: 7, bases: 103, map_size: { x: 900, y: 900 } },
]
