// session-server.js - Serviço Distribuído de Sessão do CarrotRush com WebSocket
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const NodeCache = require('node-cache');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.SESSION_PORT || 3002;

// Configurações do serviço
const CONFIG = {
    SESSION_TTL: 600, // 10 minutos de TTL para sessões inativas
    CLEANUP_INTERVAL: 60, // Limpar sessões expiradas a cada 60 segundos
    DATA_FILE: path.join(__dirname, 'session-data.json'),
    BACKUP_INTERVAL: 30000 // 30 segundos
};

// Cache de sessões com TTL automático
const sessionCache = new NodeCache({ 
    stdTTL: CONFIG.SESSION_TTL,
    checkperiod: CONFIG.CLEANUP_INTERVAL,
    useClones: false
});

// Mapa de conexões do game server
const gameServerConnections = new Map();

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint (mantido para monitoramento)
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        activeSessions: sessionCache.keys().length,
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
    
    // Criar nova sessão
    socket.on('session:create', async (data, callback) => {
        try {
            const sessionId = uuidv4();
            const session = {
                sessionId,
                playerId: data.playerId,
                playerName: data.playerName,
                gameState: data.gameState || { position: null, score: 0 },
                createdAt: Date.now(),
                lastActivity: Date.now(),
                reconnectCount: 0,
                isOnline: true
            };
            
            sessionCache.set(sessionId, session);
            await saveData();
            
            console.log(`✅ Sessão criada: ${sessionId} para ${data.playerName}`);
            callback({ success: true, sessionId, session });
        } catch (error) {
            console.error('Erro ao criar sessão:', error);
            callback({ success: false, error: error.message });
        }
    });
    
    // Obter sessão por ID
    socket.on('session:get', (sessionId, callback) => {
        const session = sessionCache.get(sessionId);
        if (session) {
            session.lastActivity = Date.now();
            sessionCache.set(sessionId, session);
        }
        callback({ success: !!session, session });
    });
    
    // Atualizar estado da sessão
    socket.on('session:update', async (data, callback) => {
        try {
            const session = sessionCache.get(data.sessionId);
            if (!session) {
                callback({ success: false, error: 'Sessão não encontrada' });
                return;
            }
            
            // Atualizar estado do jogo
            if (data.gameState) {
                session.gameState = { ...session.gameState, ...data.gameState };
            }
            session.lastActivity = Date.now();
            session.isOnline = true;
            
            sessionCache.set(data.sessionId, session);
            
            callback({ success: true, session });
        } catch (error) {
            console.error('Erro ao atualizar sessão:', error);
            callback({ success: false, error: error.message });
        }
    });
    
    // Registrar reconexão
    socket.on('session:reconnect', async (sessionId, callback) => {
        try {
            const session = sessionCache.get(sessionId);
            if (session) {
                session.reconnectCount++;
                session.lastActivity = Date.now();
                session.isOnline = true;
                sessionCache.set(sessionId, session);
                
                console.log(`🔄 Reconexão registrada: ${session.playerName} (${session.reconnectCount}x)`);
                callback({ success: true, session });
            } else {
                callback({ success: false, error: 'Sessão não encontrada' });
            }
        } catch (error) {
            console.error('Erro ao registrar reconexão:', error);
            callback({ success: false, error: error.message });
        }
    });
    
    // Marcar jogador como offline
    socket.on('session:disconnect', async (sessionId, callback) => {
        try {
            const session = sessionCache.get(sessionId);
            if (session) {
                session.isOnline = false;
                session.lastDisconnect = Date.now();
                sessionCache.set(sessionId, session);
                await saveData();
                
                console.log(`👋 Jogador desconectado: ${session.playerName}`);
                callback({ success: true });
            } else {
                callback({ success: false, error: 'Sessão não encontrada' });
            }
        } catch (error) {
            console.error('Erro ao marcar desconexão:', error);
            callback({ success: false, error: error.message });
        }
    });
    
    // Buscar sessão por nome do jogador
    socket.on('session:findByName', (playerName, callback) => {
        try {
            const keys = sessionCache.keys();
            let foundSession = null;
            
            for (const key of keys) {
                const session = sessionCache.get(key);
                if (session && session.playerName === playerName) {
                    foundSession = session;
                    break;
                }
            }
            
            callback({ success: !!foundSession, session: foundSession });
        } catch (error) {
            console.error('Erro ao buscar sessão por nome:', error);
            callback({ success: false, error: error.message });
        }
    });
    
    // Obter estatísticas
    socket.on('session:stats', (data, callback) => {
        const keys = sessionCache.keys();
        const sessions = [];
        let onlineCount = 0;
        
        keys.forEach(key => {
            const session = sessionCache.get(key);
            if (session) {
                sessions.push(session);
                if (session.isOnline) onlineCount++;
            }
        });
        
        callback({
            success: true,
            stats: {
                totalSessions: sessions.length,
                onlinePlayers: onlineCount,
                offlinePlayers: sessions.length - onlineCount,
                sessions: sessions
            }
        });
    });
    
    // Remover sessão
    socket.on('session:remove', async (sessionId, callback) => {
        try {
            const deleted = sessionCache.del(sessionId);
            if (deleted) {
                await saveData();
                console.log(`🗑️ Sessão removida: ${sessionId}`);
            }
            callback({ success: deleted });
        } catch (error) {
            console.error('Erro ao remover sessão:', error);
            callback({ success: false, error: error.message });
        }
    });
    
    // Desconexão do game server
    socket.on('disconnect', () => {
        gameServerConnections.delete(socket.id);
        console.log(`🔌 Game Server desconectado: ${socket.id}`);
    });
});

// Carregar dados do arquivo ao iniciar
async function loadData() {
    try {
        if (await fs.pathExists(CONFIG.DATA_FILE)) {
            const data = await fs.readJson(CONFIG.DATA_FILE);
            const sessions = data.sessions || [];
            
            // Restaurar sessões no cache
            sessions.forEach(session => {
                if (session.lastActivity && 
                    Date.now() - session.lastActivity < CONFIG.SESSION_TTL * 1000) {
                    // Marcar como offline ao carregar
                    session.isOnline = false;
                    sessionCache.set(session.sessionId, session);
                }
            });
            
            console.log(`📂 Dados carregados: ${sessionCache.keys().length} sessões restauradas`);
        }
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
    }
}
// Salvar dados no arquivo
async function saveData() {
    try {
        const sessions = [];
        const keys = sessionCache.keys();
        
        keys.forEach(key => {
            const session = sessionCache.get(key);
            if (session) {
                sessions.push(session);
            }
        });
        
        const data = {
            sessions,
            lastBackup: Date.now()
        };
        
        await fs.writeJson(CONFIG.DATA_FILE, data, { spaces: 2 });
        console.log(`💾 Backup realizado: ${sessions.length} sessões salvas`);
    } catch (error) {
        console.error('Erro ao salvar dados:', error);
    }
}

// Backup automático
setInterval(saveData, CONFIG.BACKUP_INTERVAL);

// Evento de limpeza do cache
sessionCache.on('expired', (key, value) => {
    console.log(`⏰ Sessão expirada: ${value.playerName} (${key})`);
    saveData();
});

// Inicializar servidor
loadData().then(() => {
    server.listen(PORT, () => {
        console.log(`🎮 Serviço de Sessão rodando na porta ${PORT}`);
        console.log(`🔌 Aguardando conexões WebSocket do Game Server...`);
    });
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Encerrando serviço de sessão...');
    await saveData();
    process.exit(0);
});