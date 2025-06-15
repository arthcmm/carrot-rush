// server.js - Servidor Principal do CarrotRush
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Configurações do jogo
const GAME_CONFIG = {
    MAP_WIDTH: 2000,
    MAP_HEIGHT: 2000,
    CARROT_SPAWN_INTERVAL: 3000, // 3 segundos
    MAX_CARROTS: 20,
    LEADERBOARD_SIZE: 10,
    PLAYER_SPEED: 150,
    CARROT_COLLECT_RADIUS: 30
};

// Estado global do jogo
let gameState = {
    players: new Map(),
    carrots: new Map(),
    leaderboard: []
};

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Rota principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Função para gerar ID único
function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

// Função para gerar posição aleatória
function getRandomPosition() {
    return {
        x: Math.random() * (GAME_CONFIG.MAP_WIDTH - 100) + 50,
        y: Math.random() * (GAME_CONFIG.MAP_HEIGHT - 100) + 50
    };
}

// Função para spawnar cenoura
function spawnCarrot() {
    if (gameState.carrots.size >= GAME_CONFIG.MAX_CARROTS) return;
    
    const carrotId = generateId();
    const isGolden = Math.random() < 0.2; // 20% chance de cenoura dourada
    
    const carrot = {
        id: carrotId,
        position: getRandomPosition(),
        type: isGolden ? 'golden' : 'normal',
        points: isGolden ? 5 : 1,
        spawnTime: Date.now()
    };
    
    gameState.carrots.set(carrotId, carrot);
    
    // Notificar todos os clientes
    io.emit('carrot_spawned', carrot);
}

// Função para calcular distância
function getDistance(pos1, pos2) {
    return Math.sqrt(Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.y - pos2.y, 2));
}

// Função para atualizar leaderboard
function updateLeaderboard() {
    const sortedPlayers = Array.from(gameState.players.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, GAME_CONFIG.LEADERBOARD_SIZE)
        .map(player => ({
            id: player.id,
            name: player.name,
            score: player.score
        }));
    
    gameState.leaderboard = sortedPlayers;
    io.emit('leaderboard_update', sortedPlayers);
}

// Função para validar posição
function isValidPosition(position) {
    return position.x >= 0 && position.x <= GAME_CONFIG.MAP_WIDTH &&
           position.y >= 0 && position.y <= GAME_CONFIG.MAP_HEIGHT;
}

// Eventos do Socket.io
io.on('connection', (socket) => {
    console.log(`Jogador conectado: ${socket.id}`);
    
    // Evento: Jogador entra no jogo
    socket.on('player_join', (playerData) => {
        const player = {
            id: socket.id,
            name: playerData.name || `Coelho${Math.floor(Math.random() * 1000)}`,
            position: getRandomPosition(),
            score: 0,
            lastUpdate: Date.now()
        };
        
        gameState.players.set(socket.id, player);
        
        // Enviar estado atual para o novo jogador
        socket.emit('game_state', {
            player: player,
            players: Array.from(gameState.players.values()),
            carrots: Array.from(gameState.carrots.values()),
            leaderboard: gameState.leaderboard
        });
        
        // Notificar outros jogadores
        socket.broadcast.emit('player_joined', player);
        
        updateLeaderboard();
        
        console.log(`${player.name} entrou no jogo`);
    });
    
    // Evento: Movimento do jogador
    socket.on('player_move', (moveData) => {
        const player = gameState.players.get(socket.id);
        if (!player) return;
        
        // Validar movimento (anti-cheat básico)
        const timeDiff = (Date.now() - player.lastUpdate) / 1000;
        const maxDistance = GAME_CONFIG.PLAYER_SPEED * timeDiff;
        const actualDistance = getDistance(player.position, moveData.position);
        
        if (actualDistance <= maxDistance + 10 && isValidPosition(moveData.position)) { // +10 para tolerância
            player.position = moveData.position;
            player.lastUpdate = Date.now();
            
            // Notificar outros jogadores
            socket.broadcast.emit('player_moved', {
                id: socket.id,
                position: player.position
            });
        }
    });
    
    // Evento: Tentativa de coletar cenoura
    socket.on('collect_carrot', (carrotId) => {
        const player = gameState.players.get(socket.id);
        const carrot = gameState.carrots.get(carrotId);
        
        if (!player || !carrot) return;
        
        // Verificar se jogador está próximo o suficiente
        const distance = getDistance(player.position, carrot.position);
        if (distance <= GAME_CONFIG.CARROT_COLLECT_RADIUS) {
            // Coletar cenoura
            player.score += carrot.points;
            gameState.carrots.delete(carrotId);
            
            // Notificar todos os jogadores
            io.emit('carrot_collected', {
                carrotId: carrotId,
                playerId: socket.id,
                playerScore: player.score,
                points: carrot.points
            });
            
            updateLeaderboard();
            
            console.log(`${player.name} coletou cenoura ${carrot.type} (+${carrot.points} pontos)`);
        }
    });
    
    // Evento: Desconexão
    socket.on('disconnect', () => {
        const player = gameState.players.get(socket.id);
        if (player) {
            console.log(`${player.name} saiu do jogo`);
            gameState.players.delete(socket.id);
            
            // Notificar outros jogadores
            socket.broadcast.emit('player_left', socket.id);
            
            updateLeaderboard();
        }
    });
    
    // Evento: Ping para manter conexão
    socket.on('ping', () => {
        socket.emit('pong');
    });
});

// Sistema de spawn de cenouras
setInterval(() => {
    spawnCarrot();
}, GAME_CONFIG.CARROT_SPAWN_INTERVAL);

// Limpar cenouras antigas (opcional - evita acúmulo)
setInterval(() => {
    const now = Date.now();
    const CARROT_LIFETIME = 60000; // 1 minuto
    
    for (let [carrotId, carrot] of gameState.carrots) {
        if (now - carrot.spawnTime > CARROT_LIFETIME) {
            gameState.carrots.delete(carrotId);
            io.emit('carrot_expired', carrotId);
        }
    }
}, 30000); // Verificar a cada 30 segundos

// Inicializar algumas cenouras
for (let i = 0; i < 5; i++) {
    spawnCarrot();
}

// Iniciar servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});