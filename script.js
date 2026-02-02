
const AudioCtx = new (window.AudioContext || window.webkitAudioContext)();
const playSfx = (type) => {
    if (AudioCtx.state === 'suspended') AudioCtx.resume();
    if (type === 'farkle') {
        const osc = AudioCtx.createOscillator(); const gain = AudioCtx.createGain();
        osc.connect(gain); gain.connect(AudioCtx.destination);
        osc.type = 'sawtooth'; osc.frequency.setValueAtTime(150, AudioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, AudioCtx.currentTime + 0.4);
        gain.gain.exponentialRampToValueAtTime(0.01, AudioCtx.currentTime + 0.4);
        osc.start(); osc.stop(AudioCtx.currentTime + 0.4);
        const container = document.querySelector('.container');
        container.classList.add('shake');
        setTimeout(() => container.classList.remove('shake'), 200);
    } else {
        [523, 659, 783].forEach((f, i) => {
            const o = AudioCtx.createOscillator(); const g = AudioCtx.createGain();
            o.connect(g); g.connect(AudioCtx.destination); o.frequency.value = f;
            g.gain.setValueAtTime(0, AudioCtx.currentTime + (i * 0.1));
            g.gain.linearRampToValueAtTime(0.1, AudioCtx.currentTime + (i * 0.1) + 0.05);
            g.gain.exponentialRampToValueAtTime(0.01, AudioCtx.currentTime + 0.6);
            o.start(AudioCtx.currentTime + (i * 0.1)); o.stop(AudioCtx.currentTime + 0.6);
        });
    }
};

let players = [];
let currentPlayerIndex = 0;
let finalRound = false;
let gameHistory = [];
let stats = { highestTurn: { score: 0, playerName: '' }, farkleCounts: {} };
const turnInput = document.getElementById('turn-score-input');

function init() {
    document.getElementById('add-player-btn').onclick = addPlayerInput;
    document.getElementById('start-game-btn').onclick = startGame;
    document.getElementById('submit-score-btn').onclick = submitScore;
    document.getElementById('farkle-btn').onclick = handleFarkle;
    document.getElementById('undo-btn').onclick = undo;
    document.getElementById('rematch-btn').onclick = handleRematch;
    document.getElementById('new-game-btn').onclick = () => location.reload();
    document.getElementById('clear-input').onclick = () => { turnInput.value = ''; turnInput.focus(); };

    document.querySelectorAll('.btn-quick').forEach(btn => {
        btn.onclick = () => {
            turnInput.value = (parseInt(turnInput.value) || 0) + parseInt(btn.dataset.value);
            turnInput.focus();
        };
    });

    addPlayerInput();
}

function addPlayerInput() {
    const container = document.getElementById('player-inputs');
    const div = document.createElement('div');
    div.style.display = 'flex'; div.style.gap = '10px'; div.style.marginBottom = '10px';
    div.innerHTML = `<input type="text" placeholder="Player ${container.children.length + 1}">
                     <button class="btn btn-secondary" onclick="this.parentElement.remove(); validateStart();">×</button>`;
    div.querySelector('input').oninput = validateStart;
    container.appendChild(div);
    validateStart();
}

function validateStart() {
    const inputs = document.querySelectorAll('#player-inputs input');
    document.getElementById('start-game-btn').disabled = Array.from(inputs).filter(i => i.value.trim() !== "").length < 2;
}

function startGame() {
    players = Array.from(document.querySelectorAll('#player-inputs input'))
        .filter(i => i.value.trim() !== "").map(i => ({ name: i.value, score: 0, onBoard: false, turnScores: [] }));
    document.getElementById('setup-screen').classList.remove('active');
    document.getElementById('game-screen').classList.add('active');
    updateUI();
}

function submitScore() {
    const val = parseInt(turnInput.value);
    if (isNaN(val) || val <= 0) return;
    const p = players[currentPlayerIndex];
    if (!p.onBoard && val < 500) { alert("Need 500+ to get on the board!"); return; }

    saveState();
    p.score += val;
    p.onBoard = true;
    p.turnScores.push(val);

    if (val > stats.highestTurn.score) {
        stats.highestTurn = { score: val, playerName: p.name };
        showRecordToast(p.name, val);
    }

    if (p.score >= 10000 && !finalRound) {
        finalRound = true;
        alert(`${p.name} passed 10,000! Final round begins.`);
    }

    turnInput.value = '';
    nextTurn();
}

function handleFarkle() {
    saveState();
    const p = players[currentPlayerIndex];
    p.turnScores.push(0);
    stats.farkleCounts[p.name] = (stats.farkleCounts[p.name] || 0) + 1;
    playSfx('farkle');
    nextTurn();
}

function nextTurn() {
    currentPlayerIndex++;
    if (currentPlayerIndex >= players.length) {
        currentPlayerIndex = 0;
        if (finalRound) { endGame(); return; }
    }
    updateUI();
}

function updateUI() {
    const p = players[currentPlayerIndex];
    const nameDisplay = document.getElementById('current-player-name');
    nameDisplay.innerText = p.name;

    const highscore = Math.max(...players.map(p => p.score));

    if (finalRound) {
        const warning = document.createElement('div');
        warning.className = 'chase-message';
        warning.innerText = "⚠️ FINAL TURN!";
        nameDisplay.appendChild(warning);
    } else if (highscore > p.score) {
        const pointsNeeded = (highscore - p.score) + 50;
        const chaseMsg = document.createElement('div');
        chaseMsg.className = 'chase-message';
        chaseMsg.innerText = `Need ${pointsNeeded.toLocaleString()} to lead`;
        nameDisplay.appendChild(chaseMsg);
    }

    const scoreboard = document.getElementById('scoreboard');
    let html = `<table class="score-table"><thead><tr><th>Turn</th>`;
    players.forEach((player, idx) => {
        const isCurrent = idx === currentPlayerIndex ? 'current-player-header' : '';
        const isLeader = (player.score === highscore && highscore > 0) ? 'leader-column' : '';
        html += `<th class="${isCurrent} ${isLeader}"><span class="player-header-name">${player.name}</span></th>`;
    });
    html += `</tr></thead><tbody>`;

    const maxTurns = Math.max(...players.map(p => p.turnScores.length), 1);
    for (let i = 0; i < maxTurns; i++) {
        html += `<tr><td class="row-label">${i + 1}</td>`;
        players.forEach(player => {
            html += `<td>${player.turnScores[i] !== undefined ? player.turnScores[i] : '-'}</td>`;
        });
        html += `</tr>`;
    }

    html += `<tr class="farkle-row"><td class="row-label">Farkles</td>`;
    players.forEach(player => {
        const count = stats.farkleCounts[player.name] || 0;
        html += `<td style="${count > 0 ? 'color: var(--danger); font-weight: bold;' : 'opacity: 0.5;'}">🚫 ${count}</td>`;
    });
    html += `</tr>`;

    html += `<tr class="total-row"><td class="row-label">Total</td>`;
    players.forEach(player => {
        const isLeader = (player.score === highscore && highscore > 0) ? 'leader-column' : '';
        html += `<td class="${isLeader}"><strong>${player.score}</strong></td>`;
    });
    html += `</tr></tbody></table>`;
    scoreboard.innerHTML = html;
    document.getElementById('undo-btn').disabled = gameHistory.length === 0;
}

function saveState() { gameHistory.push(JSON.stringify({ players: JSON.parse(JSON.stringify(players)), currentPlayerIndex, finalRound })); }
function undo() { if (gameHistory.length > 0) { const last = JSON.parse(gameHistory.pop()); players = last.players; currentPlayerIndex = last.currentPlayerIndex; finalRound = last.finalRound; updateUI(); } }
function showRecordToast(name, score) { const t = document.createElement('div'); t.className = 'toast'; t.innerText = `🔥 RECORD: ${name} scored ${score}!`; document.body.appendChild(t); setTimeout(() => t.remove(), 3000); }
function endGame() { const winner = [...players].sort((a,b) => b.score - a.score)[0]; document.getElementById('win-modal').classList.remove('hidden'); document.getElementById('winner-text').innerHTML = `<h3>${winner.name} Wins!</h3><p>Score: ${winner.score}</p>`; }
function handleRematch() { players.forEach(p => { p.score = 0; p.turnScores = []; p.onBoard = false; }); currentPlayerIndex = 0; finalRound = false; document.getElementById('win-modal').classList.add('hidden'); updateUI(); }

init();
const AudioCtx = new (window.AudioContext || window.webkitAudioContext)();
const playSfx = (type) => {
    if (AudioCtx.state === 'suspended') AudioCtx.resume();
    if (type === 'farkle') {
        const osc = AudioCtx.createOscillator(); const gain = AudioCtx.createGain();
        osc.connect(gain); gain.connect(AudioCtx.destination);
        osc.type = 'sawtooth'; osc.frequency.setValueAtTime(150, AudioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, AudioCtx.currentTime + 0.4);
        gain.gain.exponentialRampToValueAtTime(0.01, AudioCtx.currentTime + 0.4);
        osc.start(); osc.stop(AudioCtx.currentTime + 0.4);
        const container = document.querySelector('.container');
        container.classList.add('shake');
        setTimeout(() => container.classList.remove('shake'), 200);
    } else {
        [523, 659, 783].forEach((f, i) => {
            const o = AudioCtx.createOscillator(); const g = AudioCtx.createGain();
            o.connect(g); g.connect(AudioCtx.destination); o.frequency.value = f;
            g.gain.setValueAtTime(0, AudioCtx.currentTime + (i * 0.1));
            g.gain.linearRampToValueAtTime(0.1, AudioCtx.currentTime + (i * 0.1) + 0.05);
            g.gain.exponentialRampToValueAtTime(0.01, AudioCtx.currentTime + 0.6);
            o.start(AudioCtx.currentTime + (i * 0.1)); o.stop(AudioCtx.currentTime + 0.6);
        });
    }
};

let players = [];
let currentPlayerIndex = 0;
let finalRound = false;
let gameHistory = [];
let stats = { highestTurn: { score: 0, playerName: '' }, farkleCounts: {} };
let finalRoundTriggeredBy = null;
const turnInput = document.getElementById('turn-score-input');

function init() {
    document.getElementById('add-player-btn').onclick = addPlayerInput;
    document.getElementById('start-game-btn').onclick = startGame;
    document.getElementById('submit-score-btn').onclick = submitScore;
    document.getElementById('farkle-btn').onclick = handleFarkle;
    document.getElementById('undo-btn').onclick = undo;
    document.getElementById('rematch-btn').onclick = handleRematch;
    document.getElementById('new-game-btn').onclick = () => location.reload();
    document.getElementById('clear-input').onclick = () => { turnInput.value = ''; turnInput.focus(); };

    document.querySelectorAll('.btn-quick').forEach(btn => {
        btn.onclick = () => {
            turnInput.value = (parseInt(turnInput.value) || 0) + parseInt(btn.dataset.value);
            turnInput.focus();
        };
    });

    addPlayerInput();
}

function addPlayerInput() {
    const container = document.getElementById('player-inputs');
    const div = document.createElement('div');
    div.style.display = 'flex'; div.style.gap = '10px'; div.style.marginBottom = '10px';
    div.innerHTML = `<input type="text" placeholder="Player ${container.children.length + 1}">
                     <button class="btn btn-secondary" onclick="this.parentElement.remove(); validateStart();">×</button>`;
    div.querySelector('input').oninput = validateStart;
    container.appendChild(div);
    validateStart();
}

function validateStart() {
    const inputs = document.querySelectorAll('#player-inputs input');
    document.getElementById('start-game-btn').disabled = Array.from(inputs).filter(i => i.value.trim() !== "").length < 2;
}

function startGame() {
    players = Array.from(document.querySelectorAll('#player-inputs input'))
        .filter(i => i.value.trim() !== "").map(i => ({ name: i.value, score: 0, onBoard: false, turnScores: [] }));
    document.getElementById('setup-screen').classList.remove('active');
    document.getElementById('game-screen').classList.add('active');
    updateUI();
}

function submitScore() {
    const val = parseInt(turnInput.value);
    if (isNaN(val) || val <= 0) return;
    const p = players[currentPlayerIndex];
    if (!p.onBoard && val < 500) { alert("Need 500+ to get on the board!"); return; }

    saveState();
    p.score += val;
    p.onBoard = true;
    p.turnScores.push(val);

    if (val > stats.highestTurn.score) {
        stats.highestTurn = { score: val, playerName: p.name };
        showRecordToast(p.name, val);
    }

    // UPDATED: Track WHO triggered the final round
    if (p.score >= 10000 && !finalRound) {
        finalRound = true;
        finalRoundTriggeredBy = currentPlayerIndex; 
        alert(`🎯 ${p.name} set the bar at ${p.score}! Everyone else gets one last turn.`);
    }

    turnInput.value = '';
    nextTurn();
}
function handleFarkle() {
    saveState();
    const p = players[currentPlayerIndex];
    p.turnScores.push(0);
    stats.farkleCounts[p.name] = (stats.farkleCounts[p.name] || 0) + 1;
    playSfx('farkle');
    nextTurn();
}

function nextTurn() {
    currentPlayerIndex++;
    
    // Loop back to the first player
    if (currentPlayerIndex >= players.length) {
        currentPlayerIndex = 0;
    }

    // UPDATED: Check if we have returned to the trigger player
    if (finalRound && currentPlayerIndex === finalRoundTriggeredBy) {
        endGame();
        return;
    }
    
    updateUI();
}

function updateUI() {
    const p = players[currentPlayerIndex];
    const nameDisplay = document.getElementById('current-player-name');
    nameDisplay.innerText = p.name;

    const highscore = Math.max(...players.map(p => p.score));

    if (finalRound) {
        const warning = document.createElement('div');
        warning.className = 'chase-message';
        warning.innerText = "⚠️ FINAL TURN!";
        nameDisplay.appendChild(warning);
    } else if (highscore > p.score) {
        const pointsNeeded = (highscore - p.score) + 50;
        const chaseMsg = document.createElement('div');
        chaseMsg.className = 'chase-message';
        chaseMsg.innerText = `Need ${pointsNeeded.toLocaleString()} to lead`;
        nameDisplay.appendChild(chaseMsg);
    }

    const scoreboard = document.getElementById('scoreboard');
    let html = `<table class="score-table"><thead><tr><th>Turn</th>`;
    players.forEach((player, idx) => {
        const isCurrent = idx === currentPlayerIndex ? 'current-player-header' : '';
        const isLeader = (player.score === highscore && highscore > 0) ? 'leader-column' : '';
        html += `<th class="${isCurrent} ${isLeader}"><span class="player-header-name">${player.name}</span></th>`;
    });
    html += `</tr></thead><tbody>`;

    const maxTurns = Math.max(...players.map(p => p.turnScores.length), 1);
    for (let i = 0; i < maxTurns; i++) {
        html += `<tr><td class="row-label">${i + 1}</td>`;
        players.forEach(player => {
            html += `<td>${player.turnScores[i] !== undefined ? player.turnScores[i] : '-'}</td>`;
        });
        html += `</tr>`;
    }

    html += `<tr class="farkle-row"><td class="row-label">Farkles</td>`;
    players.forEach(player => {
        const count = stats.farkleCounts[player.name] || 0;
        html += `<td style="${count > 0 ? 'color: var(--danger); font-weight: bold;' : 'opacity: 0.5;'}">🚫 ${count}</td>`;
    });
    html += `</tr>`;

    html += `<tr class="total-row"><td class="row-label">Total</td>`;
    players.forEach(player => {
        const isLeader = (player.score === highscore && highscore > 0) ? 'leader-column' : '';
        html += `<td class="${isLeader}"><strong>${player.score}</strong></td>`;
    });
    html += `</tr></tbody></table>`;
    scoreboard.innerHTML = html;
    document.getElementById('undo-btn').disabled = gameHistory.length === 0;
}

function saveState() { 
    gameHistory.push(JSON.stringify({ 
        players: JSON.parse(JSON.stringify(players)), 
        currentPlayerIndex, 
        finalRound,
        finalRoundTriggeredBy // Added this
    })); 
}
function undo() { 
    if (gameHistory.length > 0) { 
        const last = JSON.parse(gameHistory.pop()); 
        players = last.players; 
        currentPlayerIndex = last.currentPlayerIndex; 
        finalRound = last.finalRound; 
        finalRoundTriggeredBy = last.finalRoundTriggeredBy; // Added this
        updateUI(); 
    } 
}
function showRecordToast(name, score) { const t = document.createElement('div'); t.className = 'toast'; t.innerText = `🔥 RECORD: ${name} scored ${score}!`; document.body.appendChild(t); setTimeout(() => t.remove(), 3000); }
function endGame() { const winner = [...players].sort((a,b) => b.score - a.score)[0]; document.getElementById('win-modal').classList.remove('hidden'); document.getElementById('winner-text').innerHTML = `<h3>${winner.name} Wins!</h3><p>Score: ${winner.score}</p>`; }
// 3. Update handleRematch to reset everything for a new game
function handleRematch() { 
    players.forEach(p => { 
        p.score = 0; 
        p.turnScores = []; 
        p.onBoard = false; 
    }); 
    currentPlayerIndex = 0; 
    finalRound = false; 
    finalRoundTriggeredBy = null; // Added this
    gameHistory = []; // Clear history on rematch
    document.getElementById('win-modal').classList.add('hidden'); 
    updateUI(); 
}

init();
