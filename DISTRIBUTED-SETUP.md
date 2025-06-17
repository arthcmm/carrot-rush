# CarrotRush - Configuração Distribuída

## Visão Geral da Arquitetura Distribuída

Este projeto foi expandido para demonstrar conceitos de **sistemas distribuídos** através da implementação de um **serviço de leaderboard distribuído**.

### Arquitetura

```
┌─────────────────┐    HTTP/REST    ┌─────────────────────┐
│   Game Server   │◄─────────────────►│ Leaderboard Service │
│   (Port 3000)   │                  │    (Port 3001)      │
└─────────────────┘                  └─────────────────────┘
         ▲                                       │
         │ WebSocket                             │
         ▼                                       ▼
┌─────────────────┐                  ┌─────────────────────┐
│   Game Client   │                  │   Persistent Data   │
│   (Browser)     │                  │   (JSON File)       │
└─────────────────┘                  └─────────────────────┘
```

### Componentes Distribuídos

1. **Game Server** (porta 3000)
   - Gerencia lógica do jogo, movimento dos jogadores, coleta de cenouras
   - Comunica com o Leaderboard Service via HTTP/REST
   - Mantém conexão WebSocket com clientes
   - Implementa fallback local quando o serviço está indisponível

2. **Leaderboard Service** (porta 3001)
   - Microserviço independente para gerenciar pontuações
   - API REST para operações CRUD de leaderboard
   - Persistência de dados em arquivo JSON
   - Health check e métricas

## Como Executar o Sistema Distribuído

### Pré-requisitos

```bash
# Instalar dependências para ambos os serviços
npm install --prefix carrotrush-game
npm install --prefix leaderboard-service
```

### Opção 1: Execução Manual (Recomendada para Desenvolvimento)

**Terminal 1 - Leaderboard Service:**
```bash
cd leaderboard-service
npm start
```

**Terminal 2 - Game Server:**
```bash
cd carrotrush-game
npm start
```

**Terminal 3 - Verificar Status:**
```bash
# Health check do leaderboard service
curl http://localhost:3001/health

# Status dos serviços distribuídos
curl http://localhost:3000/services/status
```

### Opção 2: Usando Docker Compose (Produção)

```bash
# Criar docker-compose.yml (veja exemplo abaixo)
docker-compose up -d
```

### Exemplo docker-compose.yml

```yaml
version: '3.8'
services:
  leaderboard-service:
    build: ./leaderboard-service
    ports:
      - "3001:3001"
    volumes:
      - ./data:/app/data
    environment:
      - NODE_ENV=production

  game-server:
    build: ./carrotrush-game
    ports:
      - "3000:3000"
    depends_on:
      - leaderboard-service
    environment:
      - LEADERBOARD_SERVICE_URL=http://leaderboard-service:3001
```

## Funcionalidades Distribuídas Implementadas

### 1. **Separação de Responsabilidades**
- **Game Server**: Lógica de jogo, movimento, colisões
- **Leaderboard Service**: Gerenciamento de pontuações, rankings

### 2. **Comunicação Entre Serviços**
- **Protocolo**: HTTP/REST
- **Formato**: JSON
- **Timeout**: 5 segundos
- **Retry**: Configurável

### 3. **Tolerância a Falhas**
- **Fallback Local**: Quando o serviço está indisponível
- **Health Checks**: Verificação automática de saúde dos serviços
- **Graceful Degradation**: Jogo continua funcionando sem leaderboard distribuído

### 4. **Persistência Distribuída**
- **Leaderboard Data**: Arquivo JSON com backup automático
- **Limpeza Automática**: Jogadores inativos são removidos
- **Backup Periódico**: Dados salvos a cada 30 segundos

### 5. **Monitoramento e Observabilidade**
- **Health Endpoints**: `/health` e `/services/status`
- **Logs Estruturados**: Com timestamps e contexto
- **Métricas**: Contadores de jogadores, pontuações, uptime

## API do Leaderboard Service

### Endpoints Disponíveis

```http
GET  /health                 # Health check
GET  /leaderboard           # Obter ranking atual
POST /player                # Adicionar/atualizar jogador
PUT  /player/:id/score      # Atualizar pontuação
DELETE /player/:id          # Remover jogador
GET  /stats                 # Estatísticas do serviço
POST /reset                 # Resetar dados (dev only)
```

### Exemplos de Uso

```bash
# Adicionar jogador
curl -X POST http://localhost:3001/player \
  -H "Content-Type: application/json" \
  -d '{"id": "player1", "name": "João", "score": 100}'

# Obter leaderboard
curl http://localhost:3001/leaderboard

# Atualizar pontuação
curl -X PUT http://localhost:3001/player/player1/score \
  -H "Content-Type: application/json" \
  -d '{"increment": 50}'

# Estatísticas
curl http://localhost:3001/stats
```

## Testando o Sistema Distribuído

### 1. **Teste de Funcionalidade Normal**
```bash
# 1. Iniciar ambos os serviços
# 2. Acessar http://localhost:3000
# 3. Jogar normalmente
# 4. Verificar se leaderboard está funcionando
```

### 2. **Teste de Tolerância a Falhas**
```bash
# 1. Iniciar ambos os serviços
# 2. Parar o leaderboard service (Ctrl+C)
# 3. Verificar se o jogo continua funcionando
# 4. Verificar logs do game server mostrando fallback
```

### 3. **Teste de Recuperação**
```bash
# 1. Reiniciar o leaderboard service
# 2. Verificar se a conexão é restabelecida
# 3. Verificar se os dados persistem
```

## Conceitos de Sistemas Distribuídos Demonstrados

### ✅ **Microserviços**
- Separação de responsabilidades
- Serviços independentes
- Comunicação via API

### ✅ **Comunicação Distribuída**
- HTTP/REST entre serviços
- WebSocket para clientes
- Timeouts e retry logic

### ✅ **Tolerância a Falhas**
- Fallback mechanisms
- Graceful degradation
- Health checks

### ✅ **Persistência Distribuída**
- Dados distribuídos entre serviços
- Backup automático
- Limpeza de dados

### ✅ **Observabilidade**
- Health endpoints
- Logs estruturados
- Métricas de sistema

## Possíveis Extensões

Para aumentar a complexidade do sistema distribuído:

1. **Banco de Dados Distribuído**: PostgreSQL com replicação
2. **Load Balancer**: Nginx com múltiplas instâncias
3. **Message Queue**: Redis/RabbitMQ para eventos
4. **Service Discovery**: Consul ou Kubernetes
5. **Caching Distribuído**: Redis para cache de leaderboard
6. **Monitoring**: Prometheus + Grafana

## Conclusão

Esta implementação demonstra os conceitos fundamentais de sistemas distribuídos em um contexto de jogo multiplayer, mantendo a simplicidade adequada para um projeto de semestre acadêmico.

---

**Desenvolvedores**: Grupo de Computação Distribuída - PUC Minas  
**Data**: 2024  
**Disciplina**: Computação Distribuída