module.exports = {
  apps: [
    {
      name: 'carrotrush-game',
      cwd: './carrotrush-game',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 3000
      }
    },
    {
      name: 'leaderboard-service',
      cwd: './leaderboard-service',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      }
    },
    {
      name: 'session-service',
      cwd: './session-service',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3002
      }
    }
  ]
}