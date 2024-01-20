// p2pgame.js
// @author Hunter Delattre

// ----- DOM ELEMENTS -----

const hostGameButton = document.getElementById('hostGameButton');
const joinGameButton = document.getElementById('joinGameButton');
const singlePlayerButton = document.getElementById('singlePlayerButton');
const aiSlider = document.getElementById('numAIPlayersSlider');
const aiSliderLabel = document.getElementById('numAIPlayersValue');
const basesSlider = document.getElementById('numBasesSlider');
const basesSliderLabel = document.getElementById('numBasesValue');
const gameSpeedSlider = document.getElementById('gameSpeedSlider');
const gameSpeedLabel = document.getElementById('gameSpeedValue');
const roadsCheckbox = document.getElementById('roadsCheckbox');
const playAgainButton = document.getElementById('playAgainButton');
let endCreditsAudio = null;

aiSlider.oninput = () => {
    aiSliderLabel.textContent = aiSlider.value;
};
aiSlider.oninput();
basesSlider.oninput = () => {
    basesSliderLabel.textContent = basesSlider.value;
};
basesSlider.oninput();
gameSpeedSlider.oninput = () => {
    gameSpeedLabel.textContent = gameSpeedSlider.value;
};
gameSpeedSlider.oninput();

hostGameButton.addEventListener('click', () => {
    hostGame();
});

joinGameButton.addEventListener('click', () => {
    joinGame(document.getElementById('joinCodeInput').value);
});

singlePlayerButton.addEventListener('click', () => {
    switchStage('hostStage', 'gameStage');

    startSinglePlayerGame();
});

playAgainButton.addEventListener('click', () => {
    switchStage('gameOverStage', 'hostStage');
    if (endCreditsAudio != null) {
        endCreditsAudio.pause();
        endCreditsAudio = null;
    }
});

// Switch between stages of the game (menu/game)
function switchStage(hideStageId, showStageId) {
    if (hideStageId) {
        document.getElementById(hideStageId).style.display = 'none';
    }
    if (showStageId) {
        document.getElementById(showStageId).style.display = 'block';
    }
}

// ----- GAME -----

let localPlayerId = null;

function isHost() {
    return localPlayerId == 0;
}

function getGameOptions() {
    return {
        num_ai_players: aiSlider.value,
        num_bases: basesSlider.value,
        roads_enabled: roadsCheckbox.checked,
        game_speed: gameSpeedSlider.value,
    };
}

function getNumConnectedPlayers() {
    return connectedPlayers.length + 1;
}

function startSinglePlayerGame() {
    localPlayerId = 0;
    startGame(getGameOptions());
}

// ----- CONNECTIONS -----

let peer = null;
let hostConnection = null;
let connections = [];
let connectedPlayers = [];

function registerConnectedPlayer(connection) {
    const playerId = connectedPlayers.length + 1;
    connectedPlayers.push({
        connection: connection,
        id: playerId,
        name: 'Player ' + playerId
    });
    return playerId;
}

function hostGame() {
    localPlayerId = 0;
    peer = new Peer(); // Create a new peer with a random ID

    peer.on('open', (id) => {
        displayCopyLink(id);
        switchStage('pendingStage', 'linkStage');
    });

    peer.on('connection', (connection) => {
        connections.push(connection);
        setupConnection(connection, true);
    });

    switchStage('hostStage', 'pendingStage');
}

function joinGame(peerId) {
    peer = new Peer();

    peer.on('open', () => {
        hostConnection = peer.connect(peerId);
        setupConnection(hostConnection, false);
    });

    switchStage('hostStage', 'pendingStage');
}

function gameOver(winnerId, winnerName, winnerColor) {
    const gameOverText = document.getElementById('gameOverText');
    const capitalizedColor = winnerColor.charAt(0).toUpperCase() + winnerColor.slice(1);
    gameOverText.textContent = capitalizedColor + ' Wins!';
    gameOverText.style.color = winnerColor;
    switchStage('gameStage', 'gameOverStage');

    const audioFileIndex = Math.floor(Math.random() * 2);
    const audioFileSuffix = audioFileIndex == 0 ? '' : ' 2';
    const audioFileName = 'assets/Lost Heroes of the Circle War' + audioFileSuffix + '.mp3';
    endCreditsAudio = new Audio(audioFileName);
    endCreditsAudio.addEventListener('canplaythrough', () => {
        endCreditsAudio.volume = 0.04;
        endCreditsAudio.loop = true;
        endCreditsAudio.play();
    });
    endCreditsAudio.load();
}

// Display copy link button and setup click event
function displayCopyLink(id) {
    const copyCodeButton = document.getElementById('copyCodeButton');
    const copyURLButton = document.getElementById('copyUrlButton');
    const textTimeout = 1500;
    function resetCopyLinkText() {
        copyCodeButton.textContent = 'Copy Code';
    }
    function resetCopyURLText() {
        copyURLButton.textContent = 'Copy URL';
    }
    resetCopyLinkText();
    resetCopyURLText();
    copyCodeButton.onclick = () => {
        navigator.clipboard.writeText(id)
        .then(() => {
            copyCodeButton.textContent = 'Copied!';
            setTimeout(resetCopyLinkText, textTimeout);
        })
        .catch(() => {
            copyCodeButton.textContent = 'Error!';
            setTimeout(resetCopyLinkText, textTimeout);
        });
    };
    copyURLButton.onclick = () => {
        const url = window.location.href + '?peerId=' + id;
        navigator.clipboard.writeText(url)
        .then(() => {
            copyURLButton.textContent = 'Copied!';
            setTimeout(resetCopyURLText, textTimeout);
        })
        .catch(() => {
            copyURLButton.textContent = 'Error!';
            setTimeout(resetCopyURLText, textTimeout);
        });
    }
}

// Set up the connection events
function setupConnection(connection, is_host) {

    let connectionTimeout = null;
    if (!is_host) {
        connectionTimeout = setTimeout(() => {
            switchStage('pendingStage', 'hostStage');
        }, 5000);
    }

    connection.on('open', () => {
        console.log('Connected to: ' + connection.peer);

        if (!is_host) {
            clearTimeout(connectionTimeout);
            switchStage('pendingStage', 'gameStage');
        }

        if (is_host) {
            const playerId = registerConnectedPlayer(connection);
            let controlId = null;
            if (!isGameStarted()) {
                switchStage('linkStage', 'gameStage');
                startGame(getGameOptions());
                controlId = playerId;
            }
            else {
                controlId = addPlayer('Player ' + playerId);
            }
            sendMessage_startGame(playerId, controlId);
        }

        connection.on('data', (data) => {
            if (isHost()) {
                connections.forEach((clientConnection) => {
                    if (clientConnection != connection) {
                        clientConnection.send(data);
                    }
                });
            }
            handleMessage(data);
        });
    });

    connection.on('error', () => {
        console.log('Connection error: ');
        if (!isHost()) {
            stopGame();
            switchStage('gameStage', 'hostStage');
        }
    });
}

function sendMessage(message) {
    if (hostConnection) {
        hostConnection.send(message);
    }
    else {
        connections.forEach((connection) => {
            connection.send(message);
        });
    }
}

// Check URL for peer ID and automatically join the game
const urlParams = new URLSearchParams(window.location.search);
const peerId = urlParams.get('peerId');
if (peerId) {
    joinGame(peerId);
}