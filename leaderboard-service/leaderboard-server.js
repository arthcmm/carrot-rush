// leaderboard-server.js - Serviço Distribuído de Leaderboard com WebSocket
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.LEADERBOARD_PORT || 3001;

// Configurações do serviço
const CONFIG = {
    LEADERBOARD_SIZE: 10,
    DATA_FILE: path.join(__dirname, 'leaderboard-data.json'),
    BACKUP_INTERVAL: 30000, // 30 segundos
    BROADCAST_INTERVAL: 1000 // Broadcast do leaderboard a cada 1 segundo
};

// Estado do leaderboard
let leaderboardData = {
    players: new Map(), // Todos os jogadores (online e offline)
    onlinePlayers: new Set(), // IDs dos jogadores online
    leaderboard: [], // Top 10 dos jogadores ONLINE
    allTimeLeaderboard: [], // Top 10 de todos os tempos
    lastUpdate: Date.now()
};

// Mapa de conexões do game server
const gameServerConnections = new Map();

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        totalPlayers: leaderboardData.players.size,
        onlinePlayers: leaderboardData.onlinePlayers.size,
        connectedServers: gameServerConnections.size,
        timestamp: new Date().toISOString() 
    });
});
// WebSocket para comunicação com o Game Server
io.on('connection', (socket) => {
    console.log(`🔌 Game Server conectado: ${socket.id}`);
    
    // Registrar conexão do game server
    gameServerConnections.set(socket.id, {
        connectedAt: Date.now(),
        socket: socket
    });
    
    // Enviar leaderboard atual ao conectar
    socket.emit('leaderboard:update', {
        leaderboard: leaderboardData.leaderboard,
        allTimeLeaderboard: leaderboardData.allTimeLeaderboard
    });
    
    // Atualizar jogador
    socket.on('player:update', async (data, callback) => {
        try {
            const player = {
                id: data.id,
                name: data.name,
                score: data.score,
                lastUpdate: Date.now()
            };
            
            leaderboardData.players.set(data.id, player);
            leaderboardData.onlinePlayers.add(data.id);
            
            calculateLeaderboard();
            await saveData();
            
            // Broadcast para todos os game servers
            broadcastLeaderboard();
            
            callback({ success: true, player });
        } catch (error) {
            console.error('Erro ao atualizar jogador:', error);
            callback({ success: false, error: error.message });
        }
    });    
    // Marcar jogador como online
    socket.on('player:online', (playerId, callback) => {
        leaderboardData.onlinePlayers.add(playerId);
        calculateLeaderboard();
        broadcastLeaderboard();
        
        console.log(`✅ Jogador online: ${playerId}`);
        callback({ success: true });
    });
    
    // Marcar jogador como offline
    socket.on('player:offline', async (playerId, callback) => {
        leaderboardData.onlinePlayers.delete(playerId);
        calculateLeaderboard();
        await saveData();
        broadcastLeaderboard();
        
        console.log(`❌ Jogador offline: ${playerId}`);
        callback({ success: true });
    });
    
    // Obter leaderboard atual
    socket.on('leaderboard:get', (data, callback) => {
        callback({
            success: true,
            leaderboard: leaderboardData.leaderboard,
            allTimeLeaderboard: leaderboardData.allTimeLeaderboard,
            onlineCount: leaderboardData.onlinePlayers.size
        });
    });
    
    // Remover jogador completamente
    socket.on('player:remove', async (playerId, callback) => {
        leaderboardData.players.delete(playerId);
        leaderboardData.onlinePlayers.delete(playerId);
        calculateLeaderboard();
        await saveData();
        broadcastLeaderboard();
        
        console.log(`🗑️ Jogador removido: ${playerId}`);
        callback({ success: true });
    });    
    // Obter estatísticas
    socket.on('stats:get', (data, callback) => {
        const stats = {
            totalPlayers: leaderboardData.players.size,
            onlinePlayers: leaderboardData.onlinePlayers.size,
            offlinePlayers: leaderboardData.players.size - leaderboardData.onlinePlayers.size,
            lastUpdate: leaderboardData.lastUpdate
        };
        
        callback({ success: true, stats });
    });
    
    // Desconexão do game server
    socket.on('disconnect', () => {
        gameServerConnections.delete(socket.id);
        console.log(`🔌 Game Server desconectado: ${socket.id}`);
    });
});

// Calcular leaderboard (apenas jogadores online)
function calculateLeaderboard() {
    // Leaderboard dos jogadores ONLINE
    const onlinePlayersList = Array.from(leaderboardData.players.entries())
        .filter(([id, player]) => leaderboardData.onlinePlayers.has(id))
        .map(([id, player]) => ({ ...player, isOnline: true }))
        .sort((a, b) => b.score - a.score)
        .slice(0, CONFIG.LEADERBOARD_SIZE);
    
    // Leaderboard de todos os tempos (online e offline)
    const allTimePlayers = Array.from(leaderboardData.players.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, CONFIG.LEADERBOARD_SIZE)
        .map(player => ({
            ...player,
            isOnline: leaderboardData.onlinePlayers.has(player.id)
        }));
    
    leaderboardData.leaderboard = onlinePlayersList;
    leaderboardData.allTimeLeaderboard = allTimePlayers;
    leaderboardData.lastUpdate = Date.now();
    
    console.log(`🏆 Leaderboard atualizado: ${onlinePlayersList.length} jogadores online`);
}
// Broadcast leaderboard para todos os game servers conectados
function broadcastLeaderboard() {
    const data = {
        leaderboard: leaderboardData.leaderboard,
        allTimeLeaderboard: leaderboardData.allTimeLeaderboard,
        onlineCount: leaderboardData.onlinePlayers.size,
        timestamp: Date.now()
    };
    
    gameServerConnections.forEach(connection => {
        connection.socket.emit('leaderboard:update', data);
    });
}

// Carregar dados do arquivo ao iniciar
async function loadData() {
    try {
        if (await fs.pathExists(CONFIG.DATA_FILE)) {
            const data = await fs.readJson(CONFIG.DATA_FILE);
            
            // Carregar jogadores
            if (data.players) {
                leaderboardData.players = new Map(data.players);
            }
            
            // Todos começam como offline ao carregar
            leaderboardData.onlinePlayers.clear();
            
            console.log(`📂 Dados carregados: ${leaderboardData.players.size} jogadores`);
            calculateLeaderboard();
        }
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
    }
}
// Salvar dados no arquivo
async function saveData() {
    try {
        const data = {
            players: Array.from(leaderboardData.players.entries()),
            lastUpdate: leaderboardData.lastUpdate,
            savedAt: Date.now()
        };
        
        await fs.writeJson(CONFIG.DATA_FILE, data, { spaces: 2 });
        console.log(`💾 Dados salvos: ${leaderboardData.players.size} jogadores`);
    } catch (error) {
        console.error('Erro ao salvar dados:', error);
    }
}

// Backup automático
setInterval(saveData, CONFIG.BACKUP_INTERVAL);

// Broadcast automático do leaderboard
setInterval(() => {
    if (gameServerConnections.size > 0) {
        broadcastLeaderboard();
    }
}, CONFIG.BROADCAST_INTERVAL);

// Inicializar servidor
loadData().then(() => {
    server.listen(PORT, () => {
        console.log(`🏆 Serviço de Leaderboard rodando na porta ${PORT}`);
        console.log(`🔌 Aguardando conexões WebSocket do Game Server...`);
    });
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Encerrando serviço de leaderboard...');
    await saveData();
    process.exit(0);
});