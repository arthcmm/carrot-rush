// server.js - Servidor Principal do CarrotRush com WebSocket
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const ioClient = require('socket.io-client');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Configurações do jogo
const GAME_CONFIG = {
    MAP_WIDTH: 2000,
    MAP_HEIGHT: 2000,
    CARROT_SPAWN_INTERVAL: 3000,
    MAX_CARROTS: 20,
    LEADERBOARD_SIZE: 10,
    PLAYER_SPEED: 150,
    CARROT_COLLECT_RADIUS: 40
};

// Conexões WebSocket com os serviços
let leaderboardSocket = null;
let sessionSocket = null;

// Configurações dos serviços
const SERVICES = {
    LEADERBOARD_SERVICE_URL: process.env.LEADERBOARD_SERVICE_URL || 'http://localhost:3001',
    SESSION_SERVICE_URL: process.env.SESSION_SERVICE_URL || 'http://localhost:3002',
    RECONNECT_DELAY: 5000
};
// Estado global do jogo
let gameState = {
    players: new Map(),
    carrots: new Map(),
    leaderboard: [],
    sessions: new Map(), // socket.id -> sessionId
    playersByName: new Map() // playerName -> playerId (para reconexão)
};

// Conectar ao Leaderboard Service
function connectLeaderboardService() {
    leaderboardSocket = ioClient(SERVICES.LEADERBOARD_SERVICE_URL, {
        reconnection: true,
        reconnectionDelay: SERVICES.RECONNECT_DELAY
    });

    leaderboardSocket.on('connect', () => {
        console.log('Conectado ao Leaderboard Service');
    });

    leaderboardSocket.on('leaderboard:update', (data) => {
        gameState.leaderboard = data.leaderboard;
        io.emit('leaderboard_update', data.leaderboard);
    });

    leaderboardSocket.on('disconnect', () => {
        console.log('Desconectado do Leaderboard Service');
    });

    leaderboardSocket.on('connect_error', (error) => {
        console.error('Erro ao conectar ao Leaderboard Service:', error.message);
    });
}
// Conectar ao Session Service
function connectSessionService() {
    sessionSocket = ioClient(SERVICES.SESSION_SERVICE_URL, {
        reconnection: true,
        reconnectionDelay: SERVICES.RECONNECT_DELAY
    });

    sessionSocket.on('connect', () => {
        console.log('Conectado ao Session Service');
    });

    sessionSocket.on('disconnect', () => {
        console.log('Desconectado do Session Service');
    });

    sessionSocket.on('connect_error', (error) => {
        console.error('Erro ao conectar ao Session Service:', error.message);
    });
}

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Rota principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota de status dos serviços
app.get('/services/status', (req, res) => {
    res.json({
        gameServer: {
            status: 'healthy',
            port: process.env.PORT || 3000,
            players: gameState.players.size,
            carrots: gameState.carrots.size,
            activeSessions: gameState.sessions.size
        },
        leaderboardService: {
            status: leaderboardSocket?.connected ? 'connected' : 'disconnected',
            url: SERVICES.LEADERBOARD_SERVICE_URL
        },
        sessionService: {
            status: sessionSocket?.connected ? 'connected' : 'disconnected',
            url: SERVICES.SESSION_SERVICE_URL
        },
        architecture: 'websocket-based',
        timestamp: new Date().toISOString()
    });
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
    io.emit('carrot_spawned', carrot);
}
// Função para calcular distância
function getDistance(pos1, pos2) {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return Math.sqrt(dx * dx + dy * dy);
}

// Função para validar posição
function isValidPosition(position) {
    return position.x >= 0 && position.x <= GAME_CONFIG.MAP_WIDTH &&
        position.y >= 0 && position.y <= GAME_CONFIG.MAP_HEIGHT;
}

// Funções de comunicação com os serviços via WebSocket

// Criar sessão no Session Service
function createSession(playerId, playerName, gameState) {
    return new Promise((resolve) => {
        if (!sessionSocket?.connected) {
            console.warn('Session Service não conectado');
            resolve(null);
            return;
        }

        sessionSocket.emit('session:create', {
            playerId,
            playerName,
            gameState
        }, (response) => {
            if (response.success) {
                resolve(response.sessionId);
            } else {
                console.error('Erro ao criar sessão:', response.error);
                resolve(null);
            }
        });
    });
}
// Buscar sessão por nome
function findSessionByName(playerName) {
    return new Promise((resolve) => {
        if (!sessionSocket?.connected) {
            resolve(null);
            return;
        }

        sessionSocket.emit('session:findByName', playerName, (response) => {
            if (response.success) {
                resolve(response.session);
            } else {
                resolve(null);
            }
        });
    });
}

// Obter sessão por ID
function getSession(sessionId) {
    return new Promise((resolve) => {
        if (!sessionSocket?.connected) {
            resolve(null);
            return;
        }

        sessionSocket.emit('session:get', sessionId, (response) => {
            if (response.success) {
                resolve(response.session);
            } else {
                resolve(null);
            }
        });
    });
}
// Atualizar sessão
function updateSession(sessionId, gameState) {
    if (!sessionSocket?.connected) return;

    sessionSocket.emit('session:update', {
        sessionId,
        gameState
    }, (response) => {
        if (!response.success) {
            console.error('Erro ao atualizar sessão:', response.error);
        }
    });
}

// Registrar reconexão
function registerReconnection(sessionId) {
    return new Promise((resolve) => {
        if (!sessionSocket?.connected) {
            resolve(false);
            return;
        }

        sessionSocket.emit('session:reconnect', sessionId, (response) => {
            resolve(response.success);
        });
    });
}

// Marcar jogador como desconectado na sessão
function markPlayerOffline(sessionId) {
    if (!sessionSocket?.connected) return;

    sessionSocket.emit('session:disconnect', sessionId, (response) => {
        if (!response.success) {
            console.error('Erro ao marcar jogador como offline:', response.error);
        }
    });
}
// Atualizar jogador no Leaderboard Service
function updatePlayerScore(playerId, playerName, score) {
    if (!leaderboardSocket?.connected) {
        console.warn('Leaderboard Service não conectado');
        return;
    }

    leaderboardSocket.emit('player:update', {
        id: playerId,
        name: playerName,
        score: score
    }, (response) => {
        if (!response.success) {
            console.error('Erro ao atualizar pontuação:', response.error);
        }
    });
}

// Marcar jogador como online no leaderboard
function markPlayerOnlineLeaderboard(playerId) {
    if (!leaderboardSocket?.connected) return;

    leaderboardSocket.emit('player:online', playerId, (response) => {
        if (!response.success) {
            console.error('Erro ao marcar jogador online no leaderboard');
        }
    });
}

// Marcar jogador como offline no leaderboard
function markPlayerOfflineLeaderboard(playerId) {
    if (!leaderboardSocket?.connected) return;

    leaderboardSocket.emit('player:offline', playerId, (response) => {
        if (!response.success) {
            console.error('Erro ao marcar jogador offline no leaderboard');
        }
    });
}
// Eventos do Socket.io
io.on('connection', (socket) => {
    console.log('Jogador conectado:', socket.id);

    // Evento: Jogador entra no jogo
    socket.on('player_join', async (playerData) => {
        let player;
        let sessionId = null;
        let isReconnection = false;

        // Verificar se é uma reconexão por nome
        const existingSession = await findSessionByName(playerData.name);

        if (existingSession && !existingSession.isOnline) {
            // É uma reconexão - restaurar estado do jogador
            player = {
                id: socket.id,
                name: existingSession.playerName,
                position: existingSession.gameState.position || getRandomPosition(),
                score: existingSession.gameState.score || 0,
                lastUpdate: Date.now()
            };

            sessionId = existingSession.sessionId;
            isReconnection = true;
            await registerReconnection(sessionId);

            console.log('Reconexão:', player.name, '(Score:', player.score, ')');
        } else {
            // Criar novo jogador
            player = {
                id: socket.id,
                name: playerData.name || `Coelho${Math.floor(Math.random() * 1000)}`,
                position: getRandomPosition(),
                score: 0,
                lastUpdate: Date.now()
            };
        }
        // Se não for reconexão, criar nova sessão
        if (!isReconnection) {
            sessionId = await createSession(socket.id, player.name, {
                position: player.position,
                score: player.score
            });

            if (!sessionId) {
                console.warn('Falha ao criar sessão - continuando sem persistência');
            }
        }

        // Salvar mapeamentos
        if (sessionId) {
            gameState.sessions.set(socket.id, sessionId);
        }
        gameState.players.set(socket.id, player);
        gameState.playersByName.set(player.name, socket.id);

        // Atualizar jogador no leaderboard e marcar como online
        updatePlayerScore(socket.id, player.name, player.score);
        markPlayerOnlineLeaderboard(socket.id);

        // Enviar estado atual para o novo jogador
        socket.emit('game_state', {
            player: player,
            players: Array.from(gameState.players.values()),
            carrots: Array.from(gameState.carrots.values()),
            leaderboard: gameState.leaderboard,
            sessionId: sessionId,
            isReconnection: isReconnection
        });

        // Notificar outros jogadores
        socket.broadcast.emit('player_joined', player);

        console.log(isReconnection ? 'Reconexão:' : 'Novo jogador:', player.name);
    });
    // Evento: Movimento do jogador
    socket.on('player_move', async (moveData) => {
        const player = gameState.players.get(socket.id);
        if (!player) return;

        if (!player.lastUpdate) {
            player.lastUpdate = Date.now();
            player.position = moveData.position;
            return;
        }

        if (!moveData || !moveData.position ||
            typeof moveData.position.x !== 'number' ||
            typeof moveData.position.y !== 'number') {
            return;
        }

        const currentTime = Date.now();
        const timeDiff = Math.max((currentTime - player.lastUpdate) / 1000, 0.016);

        const maxDistance = GAME_CONFIG.PLAYER_SPEED * timeDiff;
        const actualDistance = getDistance(player.position, moveData.position);

        const tolerance = Math.min(maxDistance * 0.1, 5); 

        if (actualDistance <= maxDistance + tolerance && isValidPosition(moveData.position)) {
            // Movimento válido
            player.position = moveData.position;
            player.lastUpdate = currentTime;

            const sessionId = gameState.sessions.get(socket.id);
            if (sessionId) {
                player.moveCount = (player.moveCount || 0) + 1;
                if (player.moveCount % 5 === 0) {
                    updateSession(sessionId, {
                        position: player.position,
                        score: player.score
                    });
                }
            }

            socket.broadcast.emit('player_moved', {
                id: socket.id,
                position: player.position,
                timestamp: currentTime 
            });

            // Verificar coleta de cenouras
            for (const [carrotId, carrot] of gameState.carrots) {
                const distance = getDistance(player.position, carrot.position);

                if (distance <= GAME_CONFIG.CARROT_COLLECT_RADIUS) {
                    // Coletar cenoura
                    gameState.carrots.delete(carrotId);
                    player.score += carrot.points;

                    // Notificar coleta
                    io.emit('carrot_collected', {
                        playerId: socket.id,
                        carrotId: carrotId,
                        newScore: player.score
                    });

                    // Atualizar pontuação no leaderboard
                    updatePlayerScore(socket.id, player.name, player.score);

                    // Atualizar sessão com nova pontuação
                    if (sessionId) {
                        updateSession(sessionId, {
                            position: player.position,
                            score: player.score
                        });
                    }

                    console.log(player.name, 'coletou cenoura', carrot.type, '(+' + carrot.points + ')');
                    break;
                }
            }
        } else {
            console.log(`Movimento inválido detectado para ${player.name}: distância ${actualDistance.toFixed(2)} > máxima ${(maxDistance + tolerance).toFixed(2)}`);

            const ratio = Math.min(maxDistance / actualDistance, 1);
            const correctedPosition = {
                x: player.position.x + (moveData.position.x - player.position.x) * ratio,
                y: player.position.y + (moveData.position.y - player.position.y) * ratio
            };

            player.position = correctedPosition;
            player.lastUpdate = currentTime;

            socket.emit('position_correction', {
                position: correctedPosition,
                reason: 'speed_limit'
            });
        }
    });

    // Evento: Jogador desconecta
    socket.on('disconnect', () => {
        const player = gameState.players.get(socket.id);
        if (!player) return;

        // Remover jogador do estado
        gameState.players.delete(socket.id);
        gameState.playersByName.delete(player.name);

        // Marcar como offline nos serviços
        const sessionId = gameState.sessions.get(socket.id);
        if (sessionId) {
            markPlayerOffline(sessionId);
            gameState.sessions.delete(socket.id);
        }
        // Marcar como offline no leaderboard
        markPlayerOfflineLeaderboard(socket.id);

        // Notificar outros jogadores
        io.emit('player_left', socket.id);

        console.log(player.name, 'saiu do jogo (Score:', player.score, ')');
    });
});

// Inicializar spawner de cenouras
setInterval(spawnCarrot, GAME_CONFIG.CARROT_SPAWN_INTERVAL);

// Inicializar conexões com os serviços
connectLeaderboardService();
connectSessionService();

// Inicializar servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log('Servidor do CarrotRush rodando na porta', PORT);
    console.log('Conectando aos serviços distribuídos via WebSocket...');

    // Spawnar algumas cenouras iniciais
    for (let i = 0; i < 5; i++) {
        spawnCarrot();
    }
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nEncerrando servidor do jogo...');

    // Desconectar dos serviços
    if (leaderboardSocket) leaderboardSocket.close();
    if (sessionSocket) sessionSocket.close();

    process.exit(0);
});