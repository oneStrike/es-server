/**
 * Admin API PM2 Ecosystem configuration (CommonJS)
 * - Uses pm2-runtime in Docker
 * - Allows cluster via env (default fork:1 in container)
 * - Separates stdout/stderr logs and enables merge for multi-instances
 * - Admin API specific configuration
 */
const process = require('node:process')

module.exports = {
  apps: [
    {
      name: 'admin-api',
      script: 'dist/apps/admin-api/src/main.js',
      // Default one process per container; allow enabling cluster by env
      instances: process.env.PM2_INSTANCES || 1,
      exec_mode: process.env.PM2_EXEC_MODE || 'fork', // set 'cluster' to enable cluster mode
      watch: false,
      autorestart: true,
      max_memory_restart: process.env.PM2_MAX_MEMORY || '512M',
      exp_backoff_restart_delay: 100,
      kill_timeout: 2000,

      // Logging: redirect to stdout/stderr in Docker; configurable via env
      out_file: process.env.PM2_OUT_FILE || '/dev/stdout',
      error_file: process.env.PM2_ERROR_FILE || '/dev/stderr',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      env_development: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
}
