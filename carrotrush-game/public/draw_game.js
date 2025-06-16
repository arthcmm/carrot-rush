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
