# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CarrotRush is a distributed multiplayer game where players control rabbits collecting carrots in real-time. Built for a PUC Minas Distributed Computing course, it demonstrates real-time multiplayer game architecture using WebSockets.

## Core Architecture

### Distributed Architecture (New)
- **Game Server**: Node.js/Express server with Socket.IO for real-time communication (Port 3000)
- **Leaderboard Service**: Independent microservice for score management (Port 3001)
- **Frontend**: Vanilla HTML5 Canvas-based game client
- **Communication**: HTTP/REST between services, WebSocket to clients
- **Persistence**: Distributed data storage with automatic backup
- **Fault Tolerance**: Fallback mechanisms when services are unavailable

### Original Architecture
- **Backend**: Node.js/Express server with Socket.IO for real-time communication
- **Frontend**: Vanilla HTML5 Canvas-based game client
- **Real-time Features**: Player movement, carrot spawning, collision detection, leaderboard updates
- **Game State**: Centralized server-side state management with anti-cheat validation

## Development Commands

### Distributed Mode (Recommended)
```bash
# Install dependencies for both services
npm install --prefix carrotrush-game
npm install --prefix leaderboard-service

# Terminal 1 - Start leaderboard service
cd leaderboard-service && npm start

# Terminal 2 - Start game server
cd carrotrush-game && npm start

# Check services status
curl http://localhost:3000/services/status
curl http://localhost:3001/health
```

### Single Server Mode (Original)
```bash
# Navigate to game directory
cd carrotrush-game

# Install dependencies
npm install

# Start development server
npm start

# Start server (production)
node server.js
```

## Key Technical Details

### Server Architecture (`server.js`)
- Uses Socket.IO for real-time multiplayer communication
- Maintains global game state with players Map and carrots Map
- Implements movement validation and basic anti-cheat mechanisms
- Handles player connections, disconnections, and game events
- Automatic carrot spawning every 3 seconds with golden carrot variants (20% chance)

### Game Configuration
- Map size: 2000x2000 pixels
- Max carrots: 20 simultaneous
- Player speed: 150 pixels/second with server-side validation
- Carrot collection radius: 40 pixels

### Socket Events
- `player_join`: Player enters game
- `player_move`: Movement with anti-cheat validation
- `collect_carrot`: Carrot collection with distance validation
- `carrot_spawned`: New carrot appears
- `leaderboard_update`: Score updates

## File Structure

### Distributed Setup
- `carrotrush-game/server.js`: Main game server with distributed leaderboard integration
- `carrotrush-game/public/index.html`: Complete client-side game implementation
- `carrotrush-game/package.json`: Game server dependencies and scripts
- `leaderboard-service/leaderboard-server.js`: Independent leaderboard microservice
- `leaderboard-service/package.json`: Leaderboard service dependencies
- `leaderboard-service/leaderboard-data.json`: Persistent leaderboard data
- `DISTRIBUTED-SETUP.md`: Complete distributed architecture documentation

### Original Structure
- `carrotrush-game/server.js`: Main server file with all game logic
- `carrotrush-game/public/index.html`: Complete client-side game implementation
- `carrotrush-game/package.json`: Dependencies and scripts

## Development Notes

- Server runs on port 3000 by default (configurable via PORT env var)
- Game uses HTML5 Canvas for rendering
- All game logic is server-authoritative to prevent cheating
- Client-server communication is event-based via Socket.IO
- Responsive design supports mobile devices