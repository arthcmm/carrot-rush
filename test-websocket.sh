#!/bin/bash

# test-websocket.sh - Script de teste para validar a comunicação WebSocket

echo "🧪 Testando Sistema CarrotRush WebSocket"
echo ""

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Função para testar porta
test_port() {
    local port=$1
    local service=$2
    
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        echo -e "${GREEN}✅ $service rodando na porta $port${NC}"
        return 0
    else
        echo -e "${RED}❌ $service não está rodando na porta $port${NC}"
        return 1
    fi
}

# Função para testar health endpoint
test_health() {
    local port=$1
    local service=$2
    
    response=$(curl -s http://localhost:$port/health 2>/dev/null)
    if [ $? -eq 0 ] && [ ! -z "$response" ]; then
        echo -e "${GREEN}✅ Health check $service: OK${NC}"
        echo "   Resposta: $response"
        return 0
    else
        echo -e "${RED}❌ Health check $service: FALHOU${NC}"
        return 1
    fi
}

echo "1️⃣ Verificando se os serviços estão rodando..."
echo ""

session_ok=0
leaderboard_ok=0
game_ok=0

test_port 3002 "Session Service" && session_ok=1
test_port 3001 "Leaderboard Service" && leaderboard_ok=1
test_port 3000 "Game Server" && game_ok=1

echo ""
echo "2️⃣ Testando endpoints de health..."
echo ""

if [ $session_ok -eq 1 ]; then
    test_health 3002 "Session Service"
fi

if [ $leaderboard_ok -eq 1 ]; then
    test_health 3001 "Leaderboard Service"
fi

echo ""
echo "3️⃣ Testando status dos serviços distribuídos..."
echo ""

if [ $game_ok -eq 1 ]; then
    status=$(curl -s http://localhost:3000/services/status 2>/dev/null)
    if [ $? -eq 0 ] && [ ! -z "$status" ]; then
        echo -e "${GREEN}✅ Status do sistema:${NC}"
        echo "$status" | jq '.' 2>/dev/null || echo "$status"
    else
        echo -e "${RED}❌ Não foi possível obter status do sistema${NC}"
    fi
fi

echo ""
echo "📊 Resumo dos Testes:"
echo ""

total=$((session_ok + leaderboard_ok + game_ok))

if [ $total -eq 3 ]; then
    echo -e "${GREEN}✅ Todos os serviços estão funcionando corretamente!${NC}"
    echo -e "${GREEN}🎮 O jogo está pronto em http://localhost:3000${NC}"
elif [ $total -eq 0 ]; then
    echo -e "${RED}❌ Nenhum serviço está rodando!${NC}"
    echo -e "${YELLOW}💡 Execute ./start-all.sh para iniciar o sistema${NC}"
else
    echo -e "${YELLOW}⚠️  Apenas $total de 3 serviços estão rodando${NC}"
    echo -e "${YELLOW}💡 Verifique os serviços que falharam e reinicie${NC}"
fi

echo ""