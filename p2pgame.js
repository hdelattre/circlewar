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

aiSlider.oninput = () => {
    aiSliderLabel.textContent = aiSlider.value;
};
basesSlider.oninput = () => {
    basesSliderLabel.textContent = basesSlider.value;
};

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
        num_bases: basesSlider.value
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
let conn = null;

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
        displayCopyLink(id, false);
        switchStage('pendingStage', 'linkStage');
    });

    peer.on('connection', (connection) => {
        setupConnection(connection, true);
    });

    switchStage('hostStage', 'pendingStage');
}

function joinGame(peerId) {
    peer = new Peer();

    peer.on('open', () => {
        conn = peer.connect(peerId);
        setupConnection(conn, false);
    });

    switchStage('hostStage', 'gameStage');
}

// Display copy link button and setup click event
function displayCopyLink(id, copy_full_url) {
    const copyLinkButton = document.getElementById('copyLinkButton');
    copyLinkButton.style.display = 'block';
    copyLinkButton.textContent = copy_full_url ? 'Copy URL' : 'Copy Code';
    copyLinkButton.onclick = () => {
        const link = copy_full_url ? window.location.href + '?peerId=' + id : id;
        navigator.clipboard.writeText(link)
        .then(() => {
            alert('Link copied to clipboard: ' + link);
        })
        .catch(() => {
            alert("something went wrong");
        });
    };
}

// Set up the connection events
function setupConnection(connection, is_host) {
    conn = connection;
    conn.on('open', () => {
        console.log('Connected to: ' + conn.peer);

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

        conn.on('data', (data) => {
            handleMessage(data);
        });
    });

    conn.on('error', () => {
        console.log('Connection error: ');
    });
}

function sendMessage(message) {
    if (conn) {
        conn.send(message);
    }
}

// Check URL for peer ID and automatically join the game
const urlParams = new URLSearchParams(window.location.search);
const peerId = urlParams.get('peerId');
if (peerId) {
    joinGame(peerId);
}