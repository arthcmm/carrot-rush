// server.js - Servidor Principal do CarrotRush
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const axios = require('axios');

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
    CARROT_COLLECT_RADIUS: 40
};

// Configurações dos serviços distribuídos
const SERVICES = {
    LEADERBOARD_SERVICE_URL: process.env.LEADERBOARD_SERVICE_URL || 'http://localhost:3001',
    SESSION_SERVICE_URL: process.env.SESSION_SERVICE_URL || 'http://localhost:3002',
    REQUEST_TIMEOUT: 5000, // 5 segundos
    RETRY_ATTEMPTS: 3,
    FALLBACK_ENABLED: true
};

// Estado global do jogo
let gameState = {
    players: new Map(),
    carrots: new Map(),
    leaderboard: [],
    sessions: new Map() // Mapear socket.id para sessionId
};

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Rota principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota de status dos serviços distribuídos
app.get('/services/status', async (req, res) => {
    const leaderboardHealth = await checkLeaderboardServiceHealth().catch(() => false);
    const sessionHealth = await checkSessionServiceHealth().catch(() => false);
    
    res.json({
        gameServer: {
            status: 'healthy',
            port: process.env.PORT || 3000,
            players: gameState.players.size,
            carrots: gameState.carrots.size,
            activeSessions: gameState.sessions.size
        },
        leaderboardService: {
            status: leaderboardHealth ? 'healthy' : 'unavailable',
            url: SERVICES.LEADERBOARD_SERVICE_URL,
            fallbackEnabled: SERVICES.FALLBACK_ENABLED
        },
        sessionService: {
            status: sessionHealth ? 'healthy' : 'unavailable',
            url: SERVICES.SESSION_SERVICE_URL
        },
        architecture: 'distributed',
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
    
    // Notificar todos os clientes
    io.emit('carrot_spawned', carrot);
}

// Função para calcular distância
function getDistance(pos1, pos2) {
    return Math.sqrt(Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.y - pos2.y, 2));
}

// Função para atualizar leaderboard (versão distribuída)
async function updateLeaderboard() {
    try {
        // Enviar dados de todos os jogadores para o serviço de leaderboard
        const players = Array.from(gameState.players.values());
        const updatePromises = players.map(player => 
            updatePlayerInLeaderboard(player.id, player.name, player.score)
        );
        
        await Promise.allSettled(updatePromises);
        
        // Buscar leaderboard atualizado do serviço
        const leaderboard = await fetchLeaderboard();
        if (leaderboard) {
            gameState.leaderboard = leaderboard;
            io.emit('leaderboard_update', leaderboard);
        }
    } catch (error) {
        console.error('Erro ao atualizar leaderboard distribuído:', error.message);
        // Fallback para leaderboard local
        if (SERVICES.FALLBACK_ENABLED) {
            updateLeaderboardLocal();
        }
    }
}

// Função para atualizar jogador no serviço de leaderboard
async function updatePlayerInLeaderboard(playerId, playerName, playerScore) {
    try {
        const response = await axios.post(`${SERVICES.LEADERBOARD_SERVICE_URL}/player`, {
            id: playerId,
            name: playerName,
            score: playerScore
        }, {
            timeout: SERVICES.REQUEST_TIMEOUT
        });
        
        return response.data;
    } catch (error) {
        console.error(`Erro ao atualizar jogador ${playerId}:`, error.message);
        throw error;
    }
}

// Função para buscar leaderboard do serviço
async function fetchLeaderboard() {
    try {
        const response = await axios.get(`${SERVICES.LEADERBOARD_SERVICE_URL}/leaderboard`, {
            timeout: SERVICES.REQUEST_TIMEOUT
        });
        
        return response.data.leaderboard;
    } catch (error) {
        console.error('Erro ao buscar leaderboard:', error.message);
        return null;
    }
}

// Função para remover jogador do serviço de leaderboard
async function removePlayerFromLeaderboard(playerId) {
    try {
        await axios.delete(`${SERVICES.LEADERBOARD_SERVICE_URL}/player/${playerId}`, {
            timeout: SERVICES.REQUEST_TIMEOUT
        });
    } catch (error) {
        console.error(`Erro ao remover jogador ${playerId}:`, error.message);
    }
}

// Função de fallback - leaderboard local (quando serviço está indisponível)
function updateLeaderboardLocal() {
    console.log('🔄 Usando leaderboard local (fallback)');
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
    socket.on('player_join', async (playerData) => {
        let player;
        let sessionId = playerData.sessionId;
        let isReconnection = false;

        // Verificar se é uma reconexão
        if (sessionId) {
            const session = await getSession(sessionId);
            if (session) {
                // É uma reconexão - restaurar estado do jogador
                player = {
                    id: socket.id,
                    name: session.playerName,
                    position: session.gameState.position || getRandomPosition(),
                    score: session.gameState.score || 0,
                    lastUpdate: Date.now()
                };
                
                isReconnection = true;
                await registerReconnection(sessionId);
                console.log(`🔄 Reconexão: ${player.name} (Sessão: ${sessionId})`);
            }
        }
        
        // Se não for reconexão ou sessão inválida, criar novo jogador
        if (!player) {
            player = {
                id: socket.id,
                name: playerData.name || `Coelho${Math.floor(Math.random() * 1000)}`,
                position: getRandomPosition(),
                score: 0,
                lastUpdate: Date.now()
            };
            
            // Criar nova sessão
            sessionId = await createSession(socket.id, player.name, {
                position: player.position,
                score: player.score
            });
            
            if (!sessionId) {
                console.warn('⚠️ Falha ao criar sessão - continuando sem persistência');
            }
        }
        
        // Salvar mapeamento de socket para sessão
        if (sessionId) {
            gameState.sessions.set(socket.id, sessionId);
        }
        
        gameState.players.set(socket.id, player);
        
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
        
        await updateLeaderboard();
        
        console.log(`${isReconnection ? '♻️' : '🆕'} ${player.name} entrou no jogo`);
    });
    
    // Evento: Movimento do jogador
    socket.on('player_move', async (moveData) => {
        const player = gameState.players.get(socket.id);
        if (!player) return;
        
        // Validar movimento (anti-cheat básico)
        const timeDiff = (Date.now() - player.lastUpdate) / 1000;
        const maxDistance = GAME_CONFIG.PLAYER_SPEED * timeDiff;
        const actualDistance = getDistance(player.position, moveData.position);
        
        if (actualDistance <= maxDistance + 10 && isValidPosition(moveData.position)) { // +10 para tolerância
            player.position = moveData.position;
            player.lastUpdate = Date.now();
            
            // Atualizar sessão periodicamente (a cada 5 movimentos)
            const sessionId = gameState.sessions.get(socket.id);
            if (sessionId && player.moveCount === undefined) {
                player.moveCount = 0;
            }
            if (sessionId) {
                player.moveCount++;
                if (player.moveCount % 5 === 0) {
                    // Atualizar estado na sessão de forma assíncrona
                    updateSessionGameState(sessionId, {
                        position: player.position,
                        score: player.score
                    }).catch(err => console.error('Erro ao atualizar sessão:', err));
                }
            }
            
            // Notificar outros jogadores
            socket.broadcast.emit('player_moved', {
                id: socket.id,
                position: player.position
            });
        }
    });
    
    // Evento: Tentativa de coletar cenoura
    socket.on('collect_carrot', async (carrotId) => {
        const player = gameState.players.get(socket.id);
        const carrot = gameState.carrots.get(carrotId);
        
        if (!player || !carrot) return;
        
        // Verificar se jogador está próximo o suficiente
        const distance = getDistance(player.position, carrot.position);
        if (distance <= GAME_CONFIG.CARROT_COLLECT_RADIUS) {
            // Coletar cenoura
            player.score += carrot.points;
            gameState.carrots.delete(carrotId);
            
            // Atualizar sessão com nova pontuação
            const sessionId = gameState.sessions.get(socket.id);
            if (sessionId) {
                updateSessionGameState(sessionId, {
                    position: player.position,
                    score: player.score
                }).catch(err => console.error('Erro ao atualizar sessão:', err));
            }
            
            // Notificar todos os jogadores
            io.emit('carrot_collected', {
                carrotId: carrotId,
                playerId: socket.id,
                playerScore: player.score,
                points: carrot.points
            });
            
            await updateLeaderboard();
            
            console.log(`${player.name} coletou cenoura ${carrot.type} (+${carrot.points} pontos)`);
        }
    });
    
    // Evento: Desconexão
    socket.on('disconnect', async () => {
        const player = gameState.players.get(socket.id);
        if (player) {
            console.log(`${player.name} saiu do jogo`);
            
            // Salvar estado final na sessão
            const sessionId = gameState.sessions.get(socket.id);
            if (sessionId) {
                await updateSessionGameState(sessionId, {
                    position: player.position,
                    score: player.score
                });
                console.log(`💾 Estado salvo para reconexão: ${player.name}`);
            }
            
            // Remover do estado ativo mas manter no leaderboard
            gameState.players.delete(socket.id);
            gameState.sessions.delete(socket.id);
            
            // Notificar outros jogadores
            socket.broadcast.emit('player_left', socket.id);
            
            // Atualizar leaderboard (jogador permanece no ranking)
            await updateLeaderboard();
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

// Função para verificar saúde do serviço de leaderboard
async function checkLeaderboardServiceHealth() {
    try {
        const response = await axios.get(`${SERVICES.LEADERBOARD_SERVICE_URL}/health`, {
            timeout: SERVICES.REQUEST_TIMEOUT
        });
        
        console.log('✅ Serviço de Leaderboard: CONECTADO');
        console.log(`📊 Status: ${response.data.status}`);
        return true;
    } catch (error) {
        console.log('❌ Serviço de Leaderboard: DESCONECTADO');
        console.log(`🔄 Fallback local: ${SERVICES.FALLBACK_ENABLED ? 'ATIVADO' : 'DESATIVADO'}`);
        return false;
    }
}

// Função para verificar saúde do serviço de sessão
async function checkSessionServiceHealth() {
    try {
        const response = await axios.get(`${SERVICES.SESSION_SERVICE_URL}/health`, {
            timeout: SERVICES.REQUEST_TIMEOUT
        });
        
        console.log('✅ Serviço de Sessão: CONECTADO');
        console.log(`🔐 Status: ${response.data.status}`);
        return true;
    } catch (error) {
        console.log('❌ Serviço de Sessão: DESCONECTADO');
        return false;
    }
}

// Função para criar sessão
async function createSession(playerId, playerName, gameState) {
    try {
        const response = await axios.post(`${SERVICES.SESSION_SERVICE_URL}/session/create`, {
            playerId,
            playerName,
            gameState
        }, {
            timeout: SERVICES.REQUEST_TIMEOUT
        });
        
        return response.data.sessionId;
    } catch (error) {
        console.error('Erro ao criar sessão:', error.message);
        return null;
    }
}

// Função para obter sessão
async function getSession(sessionId) {
    try {
        const response = await axios.get(`${SERVICES.SESSION_SERVICE_URL}/session/${sessionId}`, {
            timeout: SERVICES.REQUEST_TIMEOUT
        });
        
        return response.data.session;
    } catch (error) {
        console.error('Erro ao obter sessão:', error.message);
        return null;
    }
}

// Função para atualizar estado do jogo na sessão
async function updateSessionGameState(sessionId, gameState) {
    try {
        await axios.put(`${SERVICES.SESSION_SERVICE_URL}/session/${sessionId}/update`, {
            gameState
        }, {
            timeout: SERVICES.REQUEST_TIMEOUT
        });
        
        return true;
    } catch (error) {
        console.error('Erro ao atualizar sessão:', error.message);
        return false;
    }
}

// Função para registrar reconexão
async function registerReconnection(sessionId) {
    try {
        const response = await axios.put(`${SERVICES.SESSION_SERVICE_URL}/session/${sessionId}/reconnect`, {}, {
            timeout: SERVICES.REQUEST_TIMEOUT
        });
        
        return response.data.session;
    } catch (error) {
        console.error('Erro ao registrar reconexão:', error.message);
        return null;
    }
}

// Inicializar algumas cenouras
for (let i = 0; i < 5; i++) {
    spawnCarrot();
}

// Função para inicializar servidor
async function startServer() {
    const PORT = process.env.PORT || 3000;
    
    console.log('\n🚀 Iniciando CarrotRush - Versão Distribuída\n');
    
    // Verificar conectividade com serviços
    console.log('🔍 Verificando serviços distribuídos...');
    await checkLeaderboardServiceHealth();
    await checkSessionServiceHealth();
    
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`\n🎮 Servidor de Jogo rodando na porta ${PORT}`);
        console.log(`🏆 Serviço de Leaderboard: ${SERVICES.LEADERBOARD_SERVICE_URL}`);
        console.log(`🔐 Serviço de Sessão: ${SERVICES.SESSION_SERVICE_URL}`);
        console.log(`⚡ Modo distribuído: ATIVO\n`);
    });
}

// Iniciar servidor
startServer();