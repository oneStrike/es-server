/**
 * App API PM2 Ecosystem configuration (CommonJS)
 * - Uses pm2-runtime in Docker
 * - Allows cluster via env (default fork:1 in container)
 * - App API specific configuration
 */
const process = require('node:process')

module.exports = {
  apps: [
    {
      name: 'app-api',
      script: 'dist/apps/app-api/src/main.js',
      // Default one process per container; allow enabling cluster by env
      instances: process.env.PM2_INSTANCES || 1,
      exec_mode: process.env.PM2_EXEC_MODE || 'fork', // set 'cluster' to enable cluster mode
      watch: false,
      autorestart: true,
      max_memory_restart: process.env.PM2_MAX_MEMORY || '512M',
      exp_backoff_restart_delay: 100,
      kill_timeout: 2000,
    },
  ],
}
