import process from 'node:process'
import { registerAs } from '@nestjs/config'

const { REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_NAMESPACE } = process.env

export const RedisConfig = {
  // 数据库连接配置
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD,
  namespace: REDIS_NAMESPACE || 'ES',
}

export const RedisConfigRegister = registerAs('redis', () => RedisConfig)
