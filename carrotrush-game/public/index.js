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

    // Preencher nome automaticamente se já jogou antes
    const savedName = localStorage.getItem('carrotRushPlayerName');
    if (savedName) {
        document.getElementById('playerName').value = savedName;
        document.getElementById('playerName').focus();
        document.getElementById('playerName').select();
    }
}

// Entrar no jogo
function joinGame() {
    const playerName = document.getElementById('playerName').value.trim();
    if (!playerName)
        return alert('Por favor, digite seu nome!');

    socket = io();
    setupSocketEvents();

    // Salvar nome do jogador
    localStorage.setItem('carrotRushPlayerName', playerName);

    // Sempre enviar apenas o nome - o servidor gerencia reconexão
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
        updatePlayerPositionDisplay();

        // Mostrar notificação de reconexão
        if (state.isReconnection) {
            showNotification('Reconectado! Você continua de onde parou.');
        }
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

            // Se for nosso próprio jogador, aplicar reconciliação
            if (data.id === socket.id && predictedPosition) {
                // Verificar discrepância entre servidor e cliente
                const discrepancy = Math.sqrt(
                    Math.pow(data.position.x - predictedPosition.x, 2) +
                    Math.pow(data.position.y - predictedPosition.y, 2)
                );

                // Se a discrepância for muito grande, corrigir
                if (discrepancy > 10) {
                    console.log('Correção de posição:', discrepancy);
                    predictedPosition = { ...data.position };
                    gameState.myPlayer.position = data.position;
                    updatePlayerPositionDisplay();
                }
            }
        }
    });

    socket.on('carrot_spawned', (carrot) => {
        gameState.carrots.set(carrot.id, carrot);
    });

    socket.on('carrot_collected', (data) => {
        gameState.carrots.delete(data.carrotId);

        const player = gameState.players.get(data.playerId);
        if (player) {
            player.score = data.newScore;
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

// Atualizar display da posição do jogador
function updatePlayerPositionDisplay() {
    if (gameState.myPlayer && gameState.myPlayer.position) {
        const x = Math.round(gameState.myPlayer.position.x);
        const y = Math.round(gameState.myPlayer.position.y);
        document.getElementById('playerPosition').textContent = `X: ${x}, Y: ${y}`;
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

// Verificar coleta de cenouras com predição no cliente
function checkCarrotCollection() {
    if (!gameState.myPlayer) return;

    for (let [carrotId, carrot] of gameState.carrots) {
        const distance = Math.sqrt(
            Math.pow(gameState.myPlayer.position.x - carrot.position.x, 2) +
            Math.pow(gameState.myPlayer.position.y - carrot.position.y, 2)
        );

        if (distance <= GAME_CONFIG.CARROT_SIZE) {
            // Feedback visual imediato (computação no cliente)
            carrot.collecting = true;
            carrot.opacity = 0.5;

            // Prever pontuação (será confirmada pelo servidor)
            const predictedScore = gameState.myPlayer.score + carrot.points;
            document.getElementById('playerScore').textContent = `${predictedScore}*`;

            // Enviar para o servidor para validação
            socket.emit('collect_carrot', carrotId);
            break;
        }
    }
}

// Mostrar notificação temporária
function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    notification.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(255, 255, 255, 0.95);
                border: 2px solid #8B4513;
                border-radius: 10px;
                padding: 15px 30px;
                font-size: 1.1rem;
                z-index: 1000;
                animation: fadeInOut 3s ease-in-out;
            `;

    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

// Variáveis para predição de movimento no cliente
let predictedPosition = null;
let lastServerUpdate = Date.now();
let reconciliationBuffer = [];

// Atualizar posição do jogador com predição no cliente
function updatePlayerPosition() {
    if (!gameState.myPlayer || !targetPosition) return;

    // Inicializar posição prevista se necessário
    if (!predictedPosition) {
        predictedPosition = { ...gameState.myPlayer.position };
    }

    // Calcular direção para o alvo
    const dx = targetPosition.x - predictedPosition.x;
    const dy = targetPosition.y - predictedPosition.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 5) { // Apenas mover se estiver longe o suficiente
        const speed = 2; // Velocidade de movimento
        const moveX = (dx / distance) * speed;
        const moveY = (dy / distance) * speed;

        // Atualizar posição prevista (computação no cliente)
        const newPos = {
            x: Math.max(0, Math.min(GAME_CONFIG.MAP_WIDTH, predictedPosition.x + moveX)),
            y: Math.max(0, Math.min(GAME_CONFIG.MAP_HEIGHT, predictedPosition.y + moveY))
        };

        predictedPosition = newPos;

        // Usar posição prevista para renderização imediata (sem lag)
        gameState.myPlayer.position = newPos;

        // Adicionar ao buffer de reconciliação
        const moveCommand = {
            position: newPos,
            timestamp: Date.now(),
            sequenceNumber: reconciliationBuffer.length
        };
        reconciliationBuffer.push(moveCommand);

        // Limitar tamanho do buffer
        if (reconciliationBuffer.length > 100) {
            reconciliationBuffer.shift();
        }

        // Enviar movimento para o servidor (throttled)
        const now = Date.now();
        if (now - lastServerUpdate > 50) { // Enviar no máximo 20 vezes por segundo
            socket.emit('player_move', { position: newPos });
            lastServerUpdate = now;
        }

        // Atualizar câmera
        updateCamera();

        // Atualizar display da posição
        updatePlayerPositionDisplay();

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

// Desenhar grid
function drawGrid() {
    ctx.strokeStyle = 'rgba(139, 69, 19, 0.2)';
    ctx.lineWidth = 1;

    const gridSize = 100;
    const startX = Math.floor(gameState.camera.x / gridSize) * gridSize;
    const startY = Math.floor(gameState.camera.y / gridSize) * gridSize;

    // Linhas verticais
    for (let x = startX; x <= gameState.camera.x + GAME_CONFIG.CANVAS_WIDTH + gridSize; x += gridSize) {
        const screenX = x - gameState.camera.x;
        ctx.beginPath();
        ctx.moveTo(screenX, 0);
        ctx.lineTo(screenX, GAME_CONFIG.CANVAS_HEIGHT);
        ctx.stroke();
    }

    // Linhas horizontais
    for (let y = startY; y <= gameState.camera.y + GAME_CONFIG.CANVAS_HEIGHT + gridSize; y += gridSize) {
        const screenY = y - gameState.camera.y;
        ctx.beginPath();
        ctx.moveTo(0, screenY);
        ctx.lineTo(GAME_CONFIG.CANVAS_WIDTH, screenY);
        ctx.stroke();
    }
}

// Desenhar jogador
function drawPlayer(player, isMe) {
    const screenX = player.position.x - gameState.camera.x;
    const screenY = player.position.y - gameState.camera.y;

    // Verificar se está visível
    if (screenX < -GAME_CONFIG.PLAYER_SIZE || screenX > GAME_CONFIG.CANVAS_WIDTH + GAME_CONFIG.PLAYER_SIZE ||
        screenY < -GAME_CONFIG.PLAYER_SIZE || screenY > GAME_CONFIG.CANVAS_HEIGHT + GAME_CONFIG.PLAYER_SIZE) {
        return;
    }

    // Corpo do coelho
    ctx.fillStyle = isMe ? '#FFB6C1' : '#F0E68C';
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 2;

    // Corpo principal (oval)
    ctx.beginPath();
    ctx.ellipse(screenX, screenY + 5, GAME_CONFIG.PLAYER_SIZE / 3, GAME_CONFIG.PLAYER_SIZE / 2.5, 0, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    // Cabeça
    ctx.beginPath();
    ctx.ellipse(screenX, screenY - 10, GAME_CONFIG.PLAYER_SIZE / 4, GAME_CONFIG.PLAYER_SIZE / 4, 0, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    // Orelhas
    ctx.beginPath();
    ctx.ellipse(screenX - 8, screenY - 18, 4, 12, -0.3, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(screenX + 8, screenY - 18, 4, 12, 0.3, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    // Olhos
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(screenX - 5, screenY - 12, 2, 0, 2 * Math.PI);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(screenX + 5, screenY - 12, 2, 0, 2 * Math.PI);
    ctx.fill();

    // Nariz
    ctx.fillStyle = '#FF69B4';
    ctx.beginPath();
    ctx.arc(screenX, screenY - 8, 1.5, 0, 2 * Math.PI);
    ctx.fill();

    // Nome do jogador
    if (isMe) {
        ctx.fillStyle = '#FF4500';
        ctx.font = 'bold 12px Arial';
    } else {
        ctx.fillStyle = '#2E8B57';
        ctx.font = '11px Arial';
    }
    ctx.textAlign = 'center';
    ctx.fillText(player.name, screenX, screenY + 30);

    // Pontuação
    ctx.fillStyle = '#8B4513';
    ctx.font = '10px Arial';
    ctx.fillText(`${player.score} pts`, screenX, screenY + 42);
}

// Desenhar cenoura
function drawCarrot(carrot) {
    const screenX = carrot.position.x - gameState.camera.x;
    const screenY = carrot.position.y - gameState.camera.y;

    // Verificar se está visível
    if (screenX < -GAME_CONFIG.CARROT_SIZE || screenX > GAME_CONFIG.CANVAS_WIDTH + GAME_CONFIG.CARROT_SIZE ||
        screenY < -GAME_CONFIG.CARROT_SIZE || screenY > GAME_CONFIG.CANVAS_HEIGHT + GAME_CONFIG.CARROT_SIZE) {
        return;
    }

    // Aplicar opacidade se estiver sendo coletada
    const previousAlpha = ctx.globalAlpha;
    if (carrot.opacity !== undefined) {
        ctx.globalAlpha = carrot.opacity;
    }

    // Cor da cenoura
    const color = carrot.type === 'golden' ? '#FFD700' : '#FF8C00';

    // Cenoura (triângulo)
    ctx.fillStyle = color;
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.moveTo(screenX, screenY + 8);        // Ponta agora embaixo
    ctx.lineTo(screenX - 6, screenY - 8);    // Base agora em cima
    ctx.lineTo(screenX + 6, screenY - 8);    // Base agora em cima
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Folhas da cenoura
    ctx.fillStyle = '#228B22';
    ctx.beginPath();
    ctx.moveTo(screenX - 3, screenY - 8);
    ctx.lineTo(screenX - 6, screenY - 15);
    ctx.lineTo(screenX - 1, screenY - 12);
    ctx.lineTo(screenX + 1, screenY - 12);
    ctx.lineTo(screenX + 6, screenY - 15);
    ctx.lineTo(screenX + 3, screenY - 8);
    ctx.closePath();
    ctx.fill();

    // Efeito brilho para cenouras douradas
    if (carrot.type === 'golden') {
        const time = Date.now() / 300;
        const alpha = Math.sin(time) * 0.3 + 0.3;
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.beginPath();
        ctx.ellipse(screenX, screenY, 8, 8, 0, 0, 2 * Math.PI);
        ctx.fill();
    }

    // Restaurar opacidade original
    ctx.globalAlpha = previousAlpha;
}

// Desenhar bordas do mapa
function drawMapBorders() {
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 4;
    ctx.setLineDash([]);

    // Borda superior
    if (gameState.camera.y <= 2) {
        ctx.beginPath();
        ctx.moveTo(0, 2 - gameState.camera.y);
        ctx.lineTo(GAME_CONFIG.CANVAS_WIDTH, 2 - gameState.camera.y);
        ctx.stroke();
    }

    // Borda inferior
    if (gameState.camera.y + GAME_CONFIG.CANVAS_HEIGHT >= GAME_CONFIG.MAP_HEIGHT - 2) {
        const y = GAME_CONFIG.MAP_HEIGHT - gameState.camera.y - 2;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(GAME_CONFIG.CANVAS_WIDTH, y);
        ctx.stroke();
    }

    // Borda esquerda
    if (gameState.camera.x <= 2) {
        ctx.beginPath();
        ctx.moveTo(2 - gameState.camera.x, 0);
        ctx.lineTo(2 - gameState.camera.x, GAME_CONFIG.CANVAS_HEIGHT);
        ctx.stroke();
    }

    // Borda direita
    if (gameState.camera.x + GAME_CONFIG.CANVAS_WIDTH >= GAME_CONFIG.MAP_WIDTH - 2) {
        const x = GAME_CONFIG.MAP_WIDTH - gameState.camera.x - 2;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, GAME_CONFIG.CANVAS_HEIGHT);
        ctx.stroke();
    }
}
// 1. ADICIONAR esta função após a função drawMapBorders():

// Desenhar target position
function drawTarget() {
    if (!targetPosition) return;

    const screenX = targetPosition.x - gameState.camera.x;
    const screenY = targetPosition.y - gameState.camera.y;

    // Verificar se está visível na tela
    if (screenX < -20 || screenX > GAME_CONFIG.CANVAS_WIDTH + 20 ||
        screenY < -20 || screenY > GAME_CONFIG.CANVAS_HEIGHT + 20) {
        return;
    }

    // Animação pulsante
    const time = Date.now() / 200;
    const pulse = Math.sin(time) * 0.3 + 0.7;

    // Círculo externo (pulsante)
    ctx.strokeStyle = `rgba(255, 0, 0, ${pulse})`;
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(screenX, screenY, 15 * pulse, 0, 2 * Math.PI);
    ctx.stroke();

    // Círculo interno
    ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
    ctx.strokeStyle = '#FF0000';
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(screenX, screenY, 8, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    // Cruz no centro
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(screenX - 4, screenY);
    ctx.lineTo(screenX + 4, screenY);
    ctx.moveTo(screenX, screenY - 4);
    ctx.lineTo(screenX, screenY + 4);
    ctx.stroke();
}
// Loop principal do jogo
function gameLoop() {
    updatePlayerPosition();
    render();
    requestAnimationFrame(gameLoop);
}

// Inicializar quando a página carregar
window.onload = init;