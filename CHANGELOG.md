# 📋 CHANGELOG - CarrotRush

## v2.0.0 - Migração para WebSocket (2025-06-16)

### 🚀 Mudanças Principais

#### Arquitetura
- **BREAKING**: Migração completa de REST para WebSocket em todas as comunicações entre serviços
- Redução de latência de 50-100ms para <5ms
- Comunicação bidirecional em tempo real entre todos os componentes

#### Leaderboard
- **FIXED**: Leaderboard agora mostra apenas jogadores online
- Atualização instantânea quando jogadores entram/saem
- Persistência de dados de todos os jogadores (online e offline)
- Novo ranking "All Time" disponível nos dados

#### Sistema de Reconexão
- **IMPROVED**: Reconexão simplificada usando apenas o nome do jogador
- Removida dependência de sessionId no cliente
- Estado mantido no servidor por 10 minutos após desconexão
- Preenchimento automático do nome ao voltar ao jogo

### 🛠️ Mudanças Técnicas

#### Game Server
- Usa `socket.io-client` para conectar aos serviços
- Mapeamento interno de playerName -> playerId
- Reconexão automática com serviços se caírem
- Validação melhorada de movimento

#### Session Service
- Interface 100% WebSocket
- Eventos: create, get, update, reconnect, disconnect, findByName
- Cache com TTL automático
- Persistência assíncrona

#### Leaderboard Service
- Interface 100% WebSocket
- Eventos: update, online, offline, get, remove
- Broadcast automático de atualizações
- Separação entre jogadores online/offline

#### Cliente (Browser)
- Removido localStorage de sessionId
- Reconexão automática por nome
- Feedback visual melhorado
- Performance otimizada

### 📦 Novas Dependências
- `socket.io-client`: ^4.7.2 (no game server)

### 🔧 Scripts Utilitários
- `install.sh`: Instalação automática de dependências
- `start-all.sh`: Iniciar todos os serviços com um comando

### 📈 Melhorias de Performance
- Latência reduzida em 95%
- Taxa de atualização aumentada para 60Hz
- Eliminação de overhead HTTP
- Conexões persistentes entre serviços

### 🐛 Bugs Corrigidos
- Leaderboard não removia jogadores desconectados
- Delay perceptível em ações do jogo
- Estados inconsistentes entre serviços
- Falhas de reconexão

### 📝 Notas de Migração

Para migrar do sistema antigo:

1. Executar `npm install` em todos os diretórios
2. Usar os novos scripts de inicialização
3. Limpar dados antigos se necessário

O sistema é retrocompatível com dados salvos, mas recomenda-se limpar os arquivos JSON para começar fresh.

---

## v1.0.0 - Versão Inicial
- Sistema distribuído com REST
- 3 microserviços independentes
- Persistência básica
- Multiplayer funcional