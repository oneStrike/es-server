import Joi from 'joi'

export const environmentValidationSchema = Joi.object({
  // 应用运行环境
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test', 'provision')
    .default('development'),

  // 兼容端口配置
  PORT: Joi.number().port().optional(),

  // 数据库配置
  DATABASE_URL: Joi.string().required(),

  // Redis配置
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().port().required(),
  REDIS_PASSWORD: Joi.string().optional(),
  REDIS_NAMESPACE: Joi.string().default('ES'),

  // JWT配置
  JWT_EXPIRATION_IN: Joi.string().default('4h'),
  JWT_REFRESH_EXPIRATION_IN: Joi.string().default('7d'),
  JWT_JWT_ISSUER: Joi.string().default('es'),
  JWT_JWT_AUD: Joi.string().optional(),
  JWT_STRATEGY_KEY: Joi.string().optional(),

  // 日志配置
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
  LOG_PATH: Joi.string().default('./logs'),
  LOG_RETAIN_DAYS: Joi.string().default('7d'),
  LOG_MAX_SIZE: Joi.string().default('20m'),
  LOG_COMPRESS: Joi.string().default('true'),
  LOG_CONSOLE_LEVEL: Joi.string().default('info'),
  LOG_FORMAT: Joi.string().optional(),
  LOG_MAX_FILES: Joi.string().optional(),
  LOG_DATE_PATTERN: Joi.string().optional(),

  // 文件上传配置
  UPLOAD_DIR: Joi.string().default('./uploads'),
  UPLOAD_MAX_FILE_SIZE: Joi.string().default('100MB'),
})
