// Configurações do jogo
const GAME_CONFIG = {
    MAP_WIDTH: 2000,
    MAP_HEIGHT: 2000,
    CANVAS_WIDTH: 800,
    CANVAS_HEIGHT: 600,
    PLAYER_SIZE: 40,
    CARROT_SIZE: 30
};

// Variáveis globais
let socket;
let gameState = {
    players: new Map(),
    carrots: new Map(),
    myPlayer: null,
    camera: { x: 0, y: 0 }
};
let canvas, ctx;
let targetPosition = null;

// Inicialização
function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    canvas.addEventListener('click', handleClick);
}

// Entrar no jogo
function joinGame() {
    const playerName = document.getElementById('playerName').value.trim();
    if (!playerName)
        return alert('Por favor, digite seu nome!');
    socket = io(); setupSocketEvents();
    socket.emit('player_join', { name: playerName });
    document.getElementById('joinForm').classList.add('hidden');
    document.getElementById('gameCanvas').classList.remove('hidden');
    document.getElementById('ui').classList.remove('hidden');
    document.getElementById('playerNameDisplay').textContent = playerName;
    gameLoop();
}

// Configurar eventos do socket
function setupSocketEvents() {
    socket.on('connect', () => {
        updateConnectionStatus(true);
    });

    socket.on('disconnect', () => {
        updateConnectionStatus(false);
    });

    socket.on('game_state', (state) => {
        // Estado inicial do jogo
        gameState.players.clear();
        gameState.carrots.clear();

        state.players.forEach(player => {
            gameState.players.set(player.id, player);
            if (player.id === socket.id) {
                gameState.myPlayer = player;
            }
        });

        state.carrots.forEach(carrot => {
            gameState.carrots.set(carrot.id, carrot);
        });

        updateLeaderboard(state.leaderboard);
        updatePlayerScore();
    });

    socket.on('player_joined', (player) => {
        gameState.players.set(player.id, player);
    });

    socket.on('player_left', (playerId) => {
        gameState.players.delete(playerId);
    });

    socket.on('player_moved', (data) => {
        const player = gameState.players.get(data.id);
        if (player) {
            player.position = data.position;
        }
    });

    socket.on('carrot_spawned', (carrot) => {
        gameState.carrots.set(carrot.id, carrot);
    });

    socket.on('carrot_collected', (data) => {
        gameState.carrots.delete(data.carrotId);

        const player = gameState.players.get(data.playerId);
        if (player) {
            player.score = data.playerScore;
        }

        if (data.playerId === socket.id) {
            updatePlayerScore();
        }
    });

    socket.on('carrot_expired', (carrotId) => {
        gameState.carrots.delete(carrotId);
    });

    socket.on('leaderboard_update', (leaderboard) => {
        updateLeaderboard(leaderboard);
    });
}

// Atualizar status de conexão
function updateConnectionStatus(connected) {
    const statusText = document.getElementById('statusText');
    if (connected) {
        statusText.textContent = 'Conectado';
        statusText.className = 'status-online';
    } else {
        statusText.textContent = 'Desconectado';
        statusText.className = 'status-offline';
    }
}

// Atualizar pontuação do jogador
function updatePlayerScore() {
    if (gameState.myPlayer) {
        document.getElementById('playerScore').textContent = gameState.myPlayer.score;
    }
}

// Atualizar leaderboard
function updateLeaderboard(leaderboard) {
    const list = document.getElementById('leaderboardList');
    list.innerHTML = '';

    if (leaderboard.length === 0) {
        list.innerHTML = '<div class="leaderboard-item"><span class="player-name">Aguardando...</span><span class="player-score">0</span></div>';
        return;
    }

    leaderboard.forEach((player, index) => {
        const item = document.createElement('div');
        item.className = 'leaderboard-item';
        item.innerHTML = `
                    <span class="player-name">${index + 1}. ${player.name}</span>
                    <span class="player-score">${player.score}</span>
                `;
        list.appendChild(item);
    });
}

// Manipular clique
function handleClick(e) {
    if (!gameState.myPlayer) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;
    targetPosition = { x: clickX + gameState.camera.x, y: clickY + gameState.camera.y };
}

// Verificar coleta de cenouras
function checkCarrotCollection() {
    if (!gameState.myPlayer) return;

    for (let [carrotId, carrot] of gameState.carrots) {
        const distance = Math.sqrt(
            Math.pow(gameState.myPlayer.position.x - carrot.position.x, 2) +
            Math.pow(gameState.myPlayer.position.y - carrot.position.y, 2)
        );

        if (distance <= GAME_CONFIG.CARROT_SIZE) {
            socket.emit('collect_carrot', carrotId);
            break;
        }
    }
}

// Atualizar posição do jogador
function updatePlayerPosition() {
    if (!gameState.myPlayer || !targetPosition) return;

    // Calcular direção para o alvo
    const dx = targetPosition.x - gameState.myPlayer.position.x;
    const dy = targetPosition.y - gameState.myPlayer.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 5) { // Apenas mover se estiver longe o suficiente
        const speed = 2; // Velocidade de movimento
        const moveX = (dx / distance) * speed;
        const moveY = (dy / distance) * speed;

        // Atualizar posição
        const newPos = {
            x: Math.max(0, Math.min(GAME_CONFIG.MAP_WIDTH, gameState.myPlayer.position.x + moveX)),
            y: Math.max(0, Math.min(GAME_CONFIG.MAP_HEIGHT, gameState.myPlayer.position.y + moveY))
        };

        gameState.myPlayer.position = newPos;

        // Enviar movimento para o servidor
        socket.emit('player_move', { position: newPos });

        // Atualizar câmera
        updateCamera();

        // Verificar coleta de cenouras
        checkCarrotCollection();
    } else {
        // Chegou ao destino
        targetPosition = null;
    }
}

// Atualizar câmera
function updateCamera() {
    if (!gameState.myPlayer) return;

    // Centralizar câmera no jogador
    gameState.camera.x = gameState.myPlayer.position.x - GAME_CONFIG.CANVAS_WIDTH / 2;
    gameState.camera.y = gameState.myPlayer.position.y - GAME_CONFIG.CANVAS_HEIGHT / 2;

    // Limitar câmera aos limites do mapa
    gameState.camera.x = Math.max(0, Math.min(GAME_CONFIG.MAP_WIDTH - GAME_CONFIG.CANVAS_WIDTH, gameState.camera.x));
    gameState.camera.y = Math.max(0, Math.min(GAME_CONFIG.MAP_HEIGHT - GAME_CONFIG.CANVAS_HEIGHT, gameState.camera.y));
}

// Renderizar jogo
function render() {
    // Limpar canvas
    ctx.fillStyle = '#90EE90';
    ctx.fillRect(0, 0, GAME_CONFIG.CANVAS_WIDTH, GAME_CONFIG.CANVAS_HEIGHT);

    // Desenhar grid do mapa
    drawGrid();

    // Desenhar cenouras
    for (let [carrotId, carrot] of gameState.carrots) {
        drawCarrot(carrot);
    }

    // Desenhar jogadores
    for (let [playerId, player] of gameState.players) {
        drawPlayer(player, playerId === socket.id);
    }

    // ADICIONAR ESTA LINHA:
    drawTarget();

    // Desenhar bordas do mapa
    drawMapBorders();
}

// Loop principal do jogo
function gameLoop() {
    updatePlayerPosition();
    render();
    requestAnimationFrame(gameLoop);
}

// Inicializar quando a página carregar
window.onload = init;