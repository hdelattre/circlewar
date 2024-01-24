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
const mapSizeXText = document.getElementById('mapSizeXText');
const mapSizeYText = document.getElementById('mapSizeYText');
const roadsCheckbox = document.getElementById('roadsCheckbox');
const cameraCheckbox = document.getElementById('cameraCheckbox');
const musicCheckbox = document.getElementById('musicCheckbox');
const gameSeedText = document.getElementById('gameSeedText');
const playAgainButton = document.getElementById('playAgainButton');
const debugText = document.getElementById('debugText');
let endCreditsAudio = null;

// ----- COOKIES -----

function setCookie(name, value, days) {
    const expires = new Date();
    expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
}

function getCookie(name) {
    const cookieName = `${name}=`;
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
        let cookie = cookies[i];
        while (cookie.charAt(0) === ' ') {
            cookie = cookie.substring(1);
        }
        if (cookie.indexOf(cookieName) === 0) {
            return cookie.substring(cookieName.length, cookie.length);
        }
    }
    return null;
}

const COOKIE_AI = 'ai';
const COOKIE_BASES = 'bases';
const COOKIE_GAME_SPEED = 'gameSpeed';
const COOKIE_ROADS = 'roadsCheckbox';
const COOKIE_MUSIC = 'musicCheckbox';
const COOKIE_CAMERA = 'cameraCheckbox';
const COOKIE_MAPSIZEX = 'mapSizeX';
const COOKIE_MAPSIZEY = 'mapSizeY';

function loadSettingsFromCookies() {
    const aiSliderValue = getCookie(COOKIE_AI);
    const basesSliderValue = getCookie(COOKIE_BASES);
    const gameSpeedSliderValue = getCookie(COOKIE_GAME_SPEED);
    const roadsCheckboxValue = getCookie(COOKIE_ROADS);
    const musicCheckboxValue = getCookie(COOKIE_MUSIC);
    const cameraCheckboxValue = getCookie(COOKIE_CAMERA);
    const mapSizeXValue = getCookie(COOKIE_MAPSIZEX);
    const mapSizeYValue = getCookie(COOKIE_MAPSIZEY);

    if (aiSliderValue) {
        aiSlider.value = aiSliderValue;
        aiSliderLabel.textContent = aiSliderValue;
    }

    // Unlimit bases while we load the value and map size, then recalcualte the max
    basesSlider.max = Number.MAX_SAFE_INTEGER;
    if (basesSliderValue) {
        basesSlider.value = basesSliderValue;
        basesSliderLabel.textContent = basesSliderValue;
    }
    if (mapSizeXValue) {
        mapSizeXText.value = mapSizeXValue;
    }
    if (mapSizeYValue) {
        mapSizeYText.value = mapSizeYValue;
    }
    refreshMaxBases();

    if (gameSpeedSliderValue) {
        gameSpeedSlider.value = gameSpeedSliderValue;
        gameSpeedLabel.textContent = gameSpeedSliderValue;
    }

    if (roadsCheckboxValue) {
        roadsCheckbox.checked = roadsCheckboxValue == 'true';
    }

    if (musicCheckboxValue) {
        musicCheckbox.checked = musicCheckboxValue == 'true';
    }

    if (cameraCheckboxValue) {
        cameraCheckbox.checked = cameraCheckboxValue == 'true';
    }
}

// Never expire cookies
const cookieExpirationDays = 30;

// Load settings values from cookies when the page loads
window.addEventListener('load', () => {
    loadSettingsFromCookies();
});

// ----- MENU -----

const updateSetting_AI = () => { aiSliderLabel.textContent = aiSlider.value; setCookie(COOKIE_AI, aiSlider.value, cookieExpirationDays); };
const updateSetting_bases = () => { basesSliderLabel.textContent = basesSlider.value; setCookie(COOKIE_BASES, basesSlider.value, cookieExpirationDays); };
const updateSetting_gameSpeed = () => { gameSpeedLabel.textContent = gameSpeedSlider.value; setCookie(COOKIE_GAME_SPEED, gameSpeedSlider.value, cookieExpirationDays); };
const updateSetting_roads = () => { setCookie(COOKIE_ROADS, roadsCheckbox.checked, cookieExpirationDays); };
const updateSetting_music = () => { setCookie(COOKIE_MUSIC, musicCheckbox.checked, cookieExpirationDays); };
const updateSetting_camera = () => { setCookie(COOKIE_CAMERA, cameraCheckbox.checked, cookieExpirationDays); };

aiSlider.oninput = updateSetting_AI;
basesSlider.oninput = updateSetting_bases;
gameSpeedSlider.oninput = updateSetting_gameSpeed;
roadsCheckbox.oninput = updateSetting_roads;
musicCheckbox.oninput = updateSetting_music;
cameraCheckbox.oninput = updateSetting_camera;

function refreshMaxBases() {
    const maxBases = getMaxBases({ x: mapSizeXText.value, y: mapSizeYText.value });
    if (basesSlider.value > maxBases) {
        basesSlider.value = maxBases;
        basesSliderLabel.textContent = basesSlider.value;
        setCookie(COOKIE_BASES, basesSlider.value, cookieExpirationDays);
    }
    basesSlider.max = maxBases;
}

mapSizeXText.addEventListener('change', () => {
    const value = mapSizeXText.value;
    if (value < minMapSize.x) {
        mapSizeXText.value = minMapSize.x;
    }
    else if (value > maxMapSize.x) {
        mapSizeXText.value = maxMapSize.x;
    }
    setCookie(COOKIE_MAPSIZEX, mapSizeXText.value, cookieExpirationDays);
    refreshMaxBases();
});
mapSizeYText.addEventListener('change', () => {
    const value = mapSizeYText.value;
    if (value < minMapSize.y) {
        mapSizeYText.value = minMapSize.y;
    }
    else if (value > maxMapSize.y) {
        mapSizeYText.value = maxMapSize.y;
    }
    setCookie(COOKIE_MAPSIZEY, mapSizeYText.value, cookieExpirationDays);
    refreshMaxBases();
});

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

// ----- VIEW -----

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
let hosted_game_options = null;

function isHost() {
    return localPlayerId == 0;
}

function getGameOptions() {
    return {
        seed: gameSeedText.value,
        map_size: { x: mapSizeXText.value, y: mapSizeYText.value },
        num_ai_players: aiSlider.value,
        num_bases: basesSlider.value,
        roads_enabled: roadsCheckbox.checked,
        game_speed: gameSpeedSlider.value,
    };
}

function getNumConnectedPlayers() {
    return connectedPlayers.length + 1;
}

function getPeerPlayerIndex(peerId) {
    return connectedPlayers.findIndex((player) => {
        return player.connection.peer.id == peerId;
    });
};

function startSinglePlayerGame() {
    localPlayerId = 0;
    hosted_game_options = getGameOptions();
    startGame(hosted_game_options);
}

// ----- CONNECTIONS -----

let peer = null;
let hostConnection = null;
let connections = [];
let connectedPlayers = [];
let playerStreams = {};
let activeCalls = [];

const getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

function registerConnectedPlayer(connection) {
    const playerId = connectedPlayers.length + 1;
    connectedPlayers.push({
        connection: connection,
        id: playerId,
        name: 'Player ' + playerId,
        controlId: null,
    });
    return connectedPlayers.length - 1;
}

function registerPlayerStream(playerId, stream, is_local) {
    const streamElement = document.createElement('video');
    streamElement.setAttribute('playsinline', '');
    streamElement.autoplay = true;
    streamElement.muted = is_local;
    streamElement.srcObject = stream;
    playerStreams[playerId] = { stream: stream, element: streamElement };
    document.getElementById('streamsContainer').appendChild(streamElement);
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

    peer.on('call', function(call) {
        if (cameraCheckbox.checked) {
            getUserMedia({video: true, audio: true},
                function(stream) {
                    registerPlayerStream(localPlayerId, stream, true);
                    answerCall(call, stream);
                },
                function(err) {
                    console.log('Failed to get local stream', err);
                }
            );
        }
        else {
            answerCall(call, null);
        }
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

function closeConnections() {
    if (hostConnection) {
        hostConnection.close();
        hostConnection = null;
    }
    connections.forEach((connection) => {
        connection.close();
    });
    connections = [];

    activeCalls.forEach((call) => {
        call.close();
    });
    activeCalls = [];

    for (let playerId in playerStreams) {
        playerStreams[playerId].stream.getTracks().forEach((track) => {
            track.stop();
        });
    }
    playerStreams = {};
}

function callPeer(peerId, stream) {
    const call = peer.call(peerId, stream);
    call.on('stream', function(remoteStream) {
        registerPlayerStream(0, remoteStream, false);
    });
    activeCalls.push(call);
}

function answerCall(call, stream) {
    call.answer(stream);
    call.on('stream', function(remoteStream) {
        const playerIndex = getPeerPlayerIndex(call.peer.id);
        const controlId = connectedPlayers[playerIndex].controlId;
        registerPlayerStream(controlId, remoteStream, false);
    });
    activeCalls.push(call);
}

function startCamera(controlledPlayerId) {
    getUserMedia({video: true, audio: true},
        function(stream) {
            registerPlayerStream(controlledPlayerId, stream, true);
            callPeer(hostConnection.peer, stream);
        },
        function(err) {
            console.log('Failed to get local stream', err);
        }
    );
}

function gameOver(winnerId, winnerName, winnerColor) {

    closeConnections();

    const gameOverText = document.getElementById('gameOverText');
    const capitalizedColor = winnerColor.charAt(0).toUpperCase() + winnerColor.slice(1);
    gameOverText.textContent = capitalizedColor + ' Wins!';
    gameOverText.style.color = winnerColor;
    switchStage('gameStage', 'gameOverStage');

    if (musicCheckbox.checked) {
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
            const playerIndex = registerConnectedPlayer(connection);
            const playerId = connectedPlayers[playerIndex].id;
            let controlId = null;
            if (!isGameStarted()) {
                switchStage('linkStage', 'gameStage');
                hosted_game_options = getGameOptions();
                startGame(hosted_game_options);
                controlId = playerId;
            }
            else {
                controlId = addPlayer('Player ' + playerId);
            }
            connectedPlayers[playerIndex].controlId = controlId;
            sendMessage_startGame(playerId, controlId, hosted_game_options);
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
