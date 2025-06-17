#!/bin/bash

echo "🎮 Iniciando CarrotRush - Sistema Distribuído"
echo ""

# Cores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# Função para matar processos nas portas
cleanup_ports() {
    echo -e "${BLUE}🧹 Limpando portas...${NC}"
    lsof -ti:3000 | xargs kill -9 2>/dev/null
    lsof -ti:3001 | xargs kill -9 2>/dev/null
    lsof -ti:3002 | xargs kill -9 2>/dev/null
    sleep 1
}

# Limpar portas antes de iniciar
cleanup_ports

# Iniciar Session Service
echo -e "${BLUE}🚀 Iniciando Session Service (porta 3002)...${NC}"
cd session-service && npm start &
SESSION_PID=$!
cd ..
sleep 2

# Iniciar Leaderboard Service
echo -e "${BLUE}🚀 Iniciando Leaderboard Service (porta 3001)...${NC}"
cd leaderboard-service && npm start &
LEADERBOARD_PID=$!
cd ..
sleep 2

# Iniciar Game Server
echo -e "${BLUE}🚀 Iniciando Game Server (porta 3000)...${NC}"
cd carrotrush-game && npm start &
GAME_PID=$!
cd ..

echo ""
echo -e "${GREEN}✅ Todos os serviços iniciados!${NC}"
echo ""
echo "PIDs dos processos:"
echo "  Session Service: $SESSION_PID"
echo "  Leaderboard Service: $LEADERBOARD_PID"
echo "  Game Server: $GAME_PID"
echo ""
echo -e "${GREEN}🎮 Acesse http://localhost:3000 para jogar!${NC}"
echo ""
echo -e "${RED}Para parar todos os serviços, pressione Ctrl+C${NC}"

# Função para limpar ao sair
cleanup() {
    echo ""
    echo -e "${RED}🛑 Parando todos os serviços...${NC}"
    kill $SESSION_PID $LEADERBOARD_PID $GAME_PID 2>/dev/null
    cleanup_ports
    echo -e "${GREEN}✅ Serviços encerrados${NC}"
    exit 0
}

# Capturar Ctrl+C
trap cleanup INT

# Manter o script rodando
while true; do
    sleep 1
done