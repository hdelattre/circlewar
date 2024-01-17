// p2pgame.js
// @author Hunter Delattre

// ----- DOM ELEMENTS -----

const hostGameButton = document.getElementById('hostGameButton');
const joinGameButton = document.getElementById('joinGameButton');

// Add event listener for 'Host Game' button
hostGameButton.addEventListener('click', () => {
    hostGame();
});

// Add event listener for 'Join Game' button
joinGameButton.addEventListener('click', () => {
    joinGame(document.getElementById('joinCodeInput').value);
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

// ----- CONNECTIONS -----

let peer = null;
let conn = null;

function hostGame() {
    peer = new Peer(); // Create a new peer with a random ID

    peer.on('open', (id) => {
        displayCopyLink(id, false);
        switchStage('pendingStage', 'linkStage');
    });

    peer.on('connection', (connection) => {
        setupConnection(connection, true);
        switchStage('linkStage', 'gameStage');
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

        conn.on('data', (data) => {
            handleMessage(data);
        });

        startGame(is_host);
    });

    conn.on('error', () => {
        console.log('Connection error: ');
    });
}

function sendMessage(message) {
    conn.send(message);
}

// Check URL for peer ID and automatically join the game
const urlParams = new URLSearchParams(window.location.search);
const peerId = urlParams.get('peerId');
if (peerId) {
    joinGame(peerId);
}