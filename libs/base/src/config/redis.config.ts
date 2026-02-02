import process from 'node:process'
import { registerAs } from '@nestjs/config'

const { REDIS_URL } = process.env

export const RedisConfig = {
  connection: REDIS_URL,
}

export const RedisConfigRegister = registerAs('redis', () => RedisConfig)
