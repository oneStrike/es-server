import Joi from 'joi'

export const environmentValidationSchema = Joi.object({
  // 应用运行环境
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test', 'provision')
    .default('development'),

  // 兼容端口配置
  PORT: Joi.number().port().optional(),

  // 数据库配置
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().port().required(),
  DB_USER: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_NAME: Joi.string().required(),
  DB_MAX_QUERY_LIST_LIMIT: Joi.number().min(1).required(),
  DB_PAGINATION_PAGE_SIZE: Joi.number().min(1).required(),
  DB_PAGINATION_PAGE_INDEX: Joi.number().min(0).required(),

  // Redis配置
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().port().required(),
  REDIS_PASSWORD: Joi.string().optional(),
  REDIS_NAMESPACE: Joi.string().required(),

  // JWT配置
  JWT_SECRET: Joi.string().required(),
  JWT_REFRESH_SECRET: Joi.string().required(),
  JWT_EXPIRATION_IN: Joi.string().required(),
  JWT_REFRESH_EXPIRATION_IN: Joi.string().required(),
  JWT_JWT_ISSUER: Joi.string().required(),
  JWT_JWT_AUD: Joi.string().optional(),
  JWT_STRATEGY_KEY: Joi.string().optional(),

  // RSA密钥配置
  RSA_PUBLIC_KEY: Joi.string().required(),
  RSA_PRIVATE_KEY: Joi.string().required(),

  // 日志配置
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').required(),
  LOG_PATH: Joi.string().required(),
  LOG_RETAIN_DAYS: Joi.string().required(),
  LOG_MAX_SIZE: Joi.string().required(),
  LOG_COMPRESS: Joi.string().required(),
  LOG_CONSOLE_LEVEL: Joi.string().required(),
  LOG_FORMAT: Joi.string().optional(),
  LOG_MAX_FILES: Joi.string().optional(),
  LOG_DATE_PATTERN: Joi.string().optional(),

  // 文件上传配置
  UPLOAD_DIR: Joi.string().required(),
  UPLOAD_MAX_FILE_SIZE: Joi.string().required(),
})
