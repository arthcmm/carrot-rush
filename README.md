# 🎮 CarrotRush - Jogo Multiplayer Distribuído

Sistema distribuído para um jogo multiplayer online onde jogadores controlam coelhos que coletam cenouras em tempo real.

## 🚀 Arquitetura 100% WebSocket

Este projeto implementa uma arquitetura distribuída moderna usando **WebSocket para todas as comunicações entre serviços**, garantindo latência mínima e experiência de jogo em tempo real.

### Componentes:

1. **Game Server** (Porta 3000)
   - Servidor principal do jogo
   - Gerencia lógica e física do jogo
   - Comunica via WebSocket com outros serviços

2. **Leaderboard Service** (Porta 3001)
   - Microserviço de ranking
   - Mostra apenas jogadores online
   - Persiste pontuações de todos os jogadores

3. **Session Service** (Porta 3002)
   - Gerenciamento de sessões
   - Permite reconexão por nome
   - Salva estado do jogo

## 🎯 Features Principais

- ✅ **Comunicação WebSocket** entre todos os serviços (latência <5ms)
- ✅ **Leaderboard em tempo real** mostrando apenas jogadores online
- ✅ **Reconexão inteligente** por nome do jogador
- ✅ **Persistência de estado** (posição e pontuação)
- ✅ **Tolerância a falhas** com reconexão automática
- ✅ **Anti-cheat** com validação server-side

## 🛠️ Instalação

```bash
# Instalar todas as dependências
./install.sh
```

## 🎮 Como Jogar

### Opção 1: Script Automático (Recomendado)
```bash
# Inicia todos os serviços automaticamente
./start-all.sh
```

### Opção 2: Manual (3 terminais)
```bash
# Terminal 1
cd session-service && npm start

# Terminal 2
cd leaderboard-service && npm start

# Terminal 3
cd carrotrush-game && npm start
```

Acesse http://localhost:3000 para jogar!

## 🔧 Tecnologias

- Node.js + Express
- Socket.io (WebSocket)
- HTML5 Canvas
- Sistema de cache distribuído
- Persistência em JSON

## 📚 Documentação

- [Features Distribuídas](DISTRIBUTED-FEATURES.md) - Detalhes técnicos da arquitetura
- [Setup Distribuído](DISTRIBUTED-SETUP.md) - Guia de configuração avançada

## 🎓 Projeto Acadêmico

Desenvolvido para a disciplina de Computação Distribuída - PUC Minas