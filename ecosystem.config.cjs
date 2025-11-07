/**
 * PM2 Ecosystem configuration for es-server (CommonJS)
 * - Uses pm2-runtime in Docker
 * - Allows cluster via env (default fork:1 in container)
 * - Separates stdout/stderr logs and enables merge for multi-instances
 */

module.exports = {
  apps: [
    {
      name: 'es-server',
      script: 'dist/main.js',
      // Default one process per container; allow enabling cluster by env
      instances: process.env.PM2_INSTANCES || 1,
      exec_mode: process.env.PM2_EXEC_MODE || 'fork', // set 'cluster' to enable cluster mode
      watch: false,
      autorestart: true,
      max_memory_restart: process.env.PM2_MAX_MEMORY || '512M',
      exp_backoff_restart_delay: 100,
      kill_timeout: 2000,

      // Logging
      out_file: 'logs/app-out.log',
      error_file: 'logs/app-error.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      env: {
        NODE_ENV: process.env.NODE_ENV || 'production',
        PORT: process.env.PORT || 8080,
      },
      env_development: {
        NODE_ENV: 'development',
      },
    },
  ],
}