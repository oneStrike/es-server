import process from 'node:process'
import { registerAs } from '@nestjs/config'

const { REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_NAMESPACE } = process.env

if (!REDIS_HOST) {
  throw new Error('缺少环境变量 REDIS_HOST 环境变量')
}

if (!REDIS_PORT) {
  throw new Error('缺少环境变量 REDIS_PORT 环境变量')
}

if (!REDIS_NAMESPACE) {
  throw new Error('缺少环境变量 REDIS_NAMESPACE 环境变量')
}

export const RedisConfig = {
  // 数据库连接配置
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD,
  namespace: REDIS_NAMESPACE || 'ES',
}

export const RedisConfigRegister = registerAs('redis', () => RedisConfig)
