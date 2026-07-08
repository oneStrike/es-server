import Joi from 'joi'
import { isValidTrustedProxyEntry } from '@libs/platform/bootstrap'

// 校验 TRUSTED_PROXY_IPS 是否为逗号分隔的 IP/CIDR 列表，并返回规范化后的值。
function validateTrustedProxyIps(value: string) {
  const entries = value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)

  const invalidEntry = entries.find((entry) => !isValidTrustedProxyEntry(entry))
  if (invalidEntry) {
    throw new Error(`TRUSTED_PROXY_IPS 包含非法 IP/CIDR：${invalidEntry}`)
  }

  return entries.join(',')
}

// 校验代理信任配置的互斥关系，正整数 hop-count 不能和 IP/CIDR allowlist 同时启用。
function validateProxyTrustConfig(value: Record<string, unknown>) {
  const trustedProxyIps =
    typeof value.TRUSTED_PROXY_IPS === 'string'
      ? value.TRUSTED_PROXY_IPS.trim()
      : ''
  const trustedProxyHops =
    typeof value.TRUST_PROXY_HOPS === 'number' ? value.TRUST_PROXY_HOPS : 0

  if (trustedProxyIps && trustedProxyHops > 0) {
    throw new Error('TRUSTED_PROXY_IPS 不能和正整数 TRUST_PROXY_HOPS 同时配置')
  }

  return value
}

export const environmentValidationSchema = Joi.object({
  // 应用运行环境
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test', 'provision')
    .default('development'),

  // 兼容端口配置
  PORT: Joi.number().port().optional(),

  // 数据库配置
  DATABASE_URL: Joi.string().required(),
  DB_POOL_MAX: Joi.number().integer().min(2).default(20),

  // Redis配置
  REDIS_URL: Joi.string().required(),

  // JWT配置
  JWT_EXPIRATION_IN: Joi.string().default('4h'),
  JWT_REFRESH_EXPIRATION_IN: Joi.string().default('7d'),
  JWT_JWT_ISSUER: Joi.string().required(),
  JWT_JWT_AUD: Joi.string().required(),
  JWT_STRATEGY_KEY: Joi.string().optional(),

  // 日志配置
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'debug')
    .default('info'),
  LOG_CONSOLE_LEVEL: Joi.string().default('info'),

  // 反向代理信任配置。默认关闭；生产环境应按 docs/architecture/reverse-proxy-trust.md 配置。
  TRUSTED_PROXY_IPS: Joi.string()
    .trim()
    .empty('')
    .custom(validateTrustedProxyIps)
    .optional(),
  TRUST_PROXY_HOPS: Joi.number().integer().min(0).empty('').optional(),

  // 文件上传配置
  UPLOAD_LOCAL_DIR: Joi.string().default('./uploads/public'),
  UPLOAD_TMP_DIR: Joi.string().default('./uploads/tmp'),
  UPLOAD_LOCAL_URL_PREFIX: Joi.string().default('/files'),
  UPLOAD_MAX_FILE_SIZE: Joi.string().default('100MB'),

  // ip2region 配置
  IP2REGION_XDB_PATH: Joi.string().optional(),
  IP2REGION_DATA_DIR: Joi.string().default('./uploads/ip2region'),
}).custom(validateProxyTrustConfig)
