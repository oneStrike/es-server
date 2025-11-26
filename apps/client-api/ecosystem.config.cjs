/**
 * Client API PM2 Ecosystem configuration (CommonJS)
 * - Uses pm2-runtime in Docker
 * - Allows cluster via env (default fork:1 in container)
 * - Separates stdout/stderr logs and enables merge for multi-instances
 * - Client API specific configuration
 */
const process = require('node:process')

module.exports = {
  apps: [
    {
      name: 'client-api',
      script: 'dist/apps/client-api/main.js',
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

      env: {
        NODE_ENV: process.env.NODE_ENV || 'production',
        PORT: process.env.PORT || 8081,
        // Client API specific environment variables
        API_PREFIX: process.env.API_PREFIX || '/api',
        // 方案B：生产启用控制台告警输出到 stderr
        LOG_ENABLE_CONSOLE: process.env.LOG_ENABLE_CONSOLE || 'true',
        LOG_CONSOLE_LEVEL: process.env.LOG_CONSOLE_LEVEL || 'warn',
        LOG_LEVEL: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'development' ? 'debug' : 'info'),
        LOG_PATH: process.env.LOG_PATH || '/app/logs',
        LOG_MAX_SIZE: process.env.LOG_MAX_SIZE || '50m',
        LOG_RETAIN_DAYS: process.env.LOG_RETAIN_DAYS || '30d',
        LOG_COMPRESS: process.env.LOG_COMPRESS || 'true',
        // Client API specific configurations
        CLIENT_API_HOST: process.env.CLIENT_API_HOST || '0.0.0.0',
        CLIENT_API_PORT: process.env.CLIENT_API_PORT || 8081,
        JWT_SECRET: process.env.JWT_SECRET,
        JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 8081,
        LOG_LEVEL: 'debug',
        LOG_ENABLE_CONSOLE: 'true',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 8081,
        LOG_LEVEL: 'info',
        LOG_ENABLE_CONSOLE: 'false',
      },
    },
  ],
}
