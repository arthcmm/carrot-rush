#!/bin/bash

echo "🚀 Instalando dependências do CarrotRush..."
echo ""

# Cores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Instalar dependências do Game Server
echo -e "${BLUE}📦 Instalando dependências do Game Server...${NC}"
cd carrotrush-game
npm install
cd ..
echo -e "${GREEN}✅ Game Server pronto!${NC}"
echo ""

# Instalar dependências do Leaderboard Service
echo -e "${BLUE}📦 Instalando dependências do Leaderboard Service...${NC}"
cd leaderboard-service
npm install
cd ..
echo -e "${GREEN}✅ Leaderboard Service pronto!${NC}"
echo ""

# Instalar dependências do Session Service
echo -e "${BLUE}📦 Instalando dependências do Session Service...${NC}"
cd session-service
npm install
cd ..
echo -e "${GREEN}✅ Session Service pronto!${NC}"
echo ""

echo -e "${GREEN}🎉 Instalação completa!${NC}"
echo ""
echo "Para executar o sistema:"
echo "1. Abra 3 terminais"
echo "2. Terminal 1: cd session-service && npm start"
echo "3. Terminal 2: cd leaderboard-service && npm start"
echo "4. Terminal 3: cd carrotrush-game && npm start"
echo ""
echo "Acesse http://localhost:3000 para jogar!"