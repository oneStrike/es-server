import type { JwtSignOptions } from '@nestjs/jwt'
import process from 'node:process'
import dotenv from 'dotenv'

dotenv.config({
  path: process.env.NODE_ENV ? `.env.${process.env.NODE_ENV}` : '.env',
})

// 管理端登录的JWT配置
export const adminJwtConfig = {
  secret: process.env.ADMIN_JWT_SECRET,
  expiresIn: process.env.ADMIN_JWT_EXPIRES_IN as JwtSignOptions['expiresIn'],
  refreshExpiresIn: process.env
    .ADMIN_REFRESH_TOKEN_EXPIRES_IN as JwtSignOptions['expiresIn'],
}

// 客户端登录的JWT配置
export const clientJwtConfig = {
  secret: process.env.CLIENT_JWT_SECRET,
  expiresIn: process.env.CLIENT_JWT_EXPIRES_IN as JwtSignOptions['expiresIn'],
  refreshExpiresIn: process.env
    .CLIENT_REFRESH_TOKEN_EXPIRES_IN as JwtSignOptions['expiresIn'],
}
