// circlewar.js
// @author Hunter Delattre

// ------ DOM ELEMENTS ------
const canvas = document.getElementById('gameCanvas');
const context = canvas.getContext('2d');

// ------ GAME TYPES ------
const unittypes = {
    'soldier': {
        speed: 100
    }
};
const players = [
    { id: 0, color: 'red', name: 'Player 1' },
    { id: 1, color: 'blue', name: 'Player 2' },
    { id: 2, color: 'green', name: 'Player 3' }
];
const baseRadius = 20;

// ------ GAME STATE ------
let game_state = {
    players: [],
    bases: [],
    units: [],
}

let local_player = 1;


// ------ INPUT HANDLING ------

canvas.addEventListener('mousedown', handleMouseDown);
canvas.addEventListener('mousemove', handleMouseMove);
canvas.addEventListener('mouseup', handleMouseUp);

let isDragging = false;
let dragStartBase = null;
let dragLocation = null;
let dragEndBase = null;

function canDragBase(base) {
    return base.ownerid == local_player;
}

function handleMouseDown(event) {
    const mouseX = event.clientX - canvas.offsetLeft;
    const mouseY = event.clientY - canvas.offsetTop;

    game_state.bases.forEach((base) => {
        if (!canDragBase(base)) return;
        const distance = Math.sqrt(
            Math.pow(mouseX - base.location.x, 2) +
            Math.pow(mouseY - base.location.y, 2)
        );
        if (distance <= baseRadius) {
            isDragging = true;
            dragStartBase = base;
        }
    });
}

function handleMouseMove(event) {
    if (isDragging) {
        if (!canDragBase(dragStartBase)) {
            stopDragging();
            return;
        }

        const mouseX = event.clientX - canvas.offsetLeft;
        const mouseY = event.clientY - canvas.offsetTop;

        dragLocation = { x: mouseX, y: mouseY };
    }
}

function handleMouseUp(event) {
    if (isDragging) {
        if (!canDragBase(dragStartBase)) {
            stopDragging();
            return;
        }
        const mouseX = event.clientX - canvas.offsetLeft;
        const mouseY = event.clientY - canvas.offsetTop;

        dragEndBase = game_state.bases.find((base) => {
            const distance = Math.sqrt(
                Math.pow(mouseX - base.location.x, 2) +
                Math.pow(mouseY - base.location.y, 2)
            );
            return distance <= baseRadius;
        });
        
        if (dragStartBase && dragEndBase) {
            const unitCount = Math.floor(dragStartBase.units);
            sendUnits(dragStartBase, dragEndBase, unitCount);
            sendMessage_SendUnits(dragStartBase, dragEndBase, unitCount);
        }

        stopDragging();
    }
}

function stopDragging() {
    isDragging = false;
    dragStartBase = null;
    dragEndBase = null;
    dragLocation = null;
}

// ------ GAME FUNCTIONS ------

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

function makeTranslucent(color, opacity) {
    const colors = {
      red: '255, 0, 0',
      green: '0, 128, 0',
      blue: '0, 0, 255',
    };
  
    return `rgba(${colors[color]}, ${opacity})`;
}

function getRandomLocation(margin = 0, existing_locations = []) {
    let location = {
        x: Math.random() * (canvas.width - margin * 2) + margin,
        y: Math.random() * (canvas.height - margin * 2) + margin
    };

    if (existing_locations.length > 0) {
        while (true) {
            overlapping_location = existing_locations.find((existing_location) => {
                const deltaX = location.x - existing_location.location.x;
                const deltaY = location.y - existing_location.location.y;
                const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                return distance < (baseRadius * 2 + margin);
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

// ------ NETWORKING ------

function handleMessage(message) {
    console.log(message);
    const messageType = message.type;
    const messageData = message.data;
    if (messageType == 'UnitsMoved') {
        sendUnits(game_state.bases[messageData.baseid], game_state.bases[messageData.targetid], messageData.units)
    }
    else if (messageType == 'GameState') {
        game_state = messageData;
    }
}

function sendMessage_gameState() {
    const message = {
        type: 'GameState',
        data: game_state
    };
    sendMessage(message);
}

function sendMessage_SendUnits(startBase, endBase, numUnits) {
    const message = {
        type: 'UnitsMoved',
        data: {
            baseid: startBase.baseid,
            targetid: endBase.baseid,
            units: numUnits,
        }
    }
    sendMessage(message);
}

// ------ GAME TICK ------

function updateState(deltaTime) {
    game_state.bases.forEach((base) => {
        if (base.ownerid < 0 && base.units >= 10) return;
        base.units += base.trainingRate * deltaTime;
    });

    const newUnits = [];
    game_state.units.forEach((unit) => {
        const targetBase = game_state.bases[unit.targetid];
        const distance = Math.sqrt(
            Math.pow(targetBase.location.x - unit.location.x, 2) +
            Math.pow(targetBase.location.y - unit.location.y, 2)
        );
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
        context.beginPath();
        context.strokeStyle = makeTranslucent(game_state.players[dragStartBase.ownerid].color, 0.5)
        context.lineWidth = 5;
        context.lineCap = 'round';
        context.moveTo(dragStartBase.location.x, dragStartBase.location.y);
        context.lineTo(dragLocation.x, dragLocation.y);
        context.stroke();

        // Draw arrowhead
        const arrowheadSize = 10;
        const angle = Math.atan2(dragLocation.y - dragStartBase.location.y, dragLocation.x - dragStartBase.location.x);
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
        updateState(deltaTime);
        draw();
    }
    
    // Call the update function again
    requestAnimationFrame(update);
}

function startGame(is_host = true) {

    local_player = is_host? 0 : 1;
    
    if (local_player == 0) {
        // Initialize game state
        game_state.players.push(players[local_player]);
        game_state.players.push(players[local_player + 1]);

        for (let i = 0; i < 50; i++) {
            game_state.bases.push({
                baseid: game_state.bases.length,
                ownerid: -1,
                units: 10,
                trainingRate: .2 + Math.random(),
                unittype: 'soldier',
                location: getRandomLocation(baseRadius + 10, game_state.bases)
            });
        }
        
        game_state.players.forEach((player) => {
            unowned_bases = game_state.bases.filter((base) => {
                return base.ownerid < 0;
            });
        
            function getRandomElement(arr) {
                return arr[Math.floor(Math.random() * arr.length)];
            }
        
            let random_base = getRandomElement(unowned_bases);
            random_base.ownerid = player.id;
            random_base.units = 20;
            random_base.trainingRate = 1;
        });

        sendMessage_gameState();
    }

    // Start the game loop
    lastFrameTime = performance.now();
    update();
}
