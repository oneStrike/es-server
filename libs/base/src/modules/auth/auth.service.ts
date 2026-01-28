import type { AuthConfigInterface } from '@libs/base/types'
import { Buffer } from 'node:buffer'
import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { v4 as uuid } from 'uuid'
import { AuthErrorConstant } from './auth.constant'
import { JwtBlacklistService } from './jwt-blacklist.service'

/**
 * JWT 认证服务类
 * 提供 JWT Token 的生成、验证、刷新和撤销功能
 * 支持 Access Token 和 Refresh Token 双令牌机制
 */
@Injectable()
export class AuthService {
  protected readonly config: AuthConfigInterface

  constructor(
    protected readonly jwtService: JwtService,
    protected readonly configService: ConfigService,
    protected readonly blacklistService: JwtBlacklistService,
  ) {
    const config = this.configService.get<AuthConfigInterface>('auth')
    if (!config) {
      throw new Error('AuthService：缺少 auth 配置')
    }
    this.config = config
  }

  /**
   * 生成 JWT Token 对
   */
  async generateTokens(payload) {
    const basePayload = {
      ...payload,
    }

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { ...basePayload, jti: uuid(), type: 'access' },
        {
          expiresIn: this.config.expiresIn,
        },
      ),
      this.jwtService.signAsync(
        { ...basePayload, jti: uuid(), type: 'refresh' },
        {
          expiresIn: this.config.refreshExpiresIn,
        },
      ),
    ])

    return { accessToken, refreshToken }
  }

  /**
   * 使用 Refresh Token 刷新 Access Token
   */
  async refreshAccessToken(refreshToken: string) {
    const { aud, jti, exp, iat, iss, ...payload } =
      await this.jwtService.verifyAsync(refreshToken)
    const isBlacklist = await this.blacklistService.isInBlacklist(jti)
    if (payload.type !== 'refresh' || aud !== this.config.aud || isBlacklist) {
      throw new UnauthorizedException(AuthErrorConstant.LOGIN_INVALID)
    }

    await this.addToBlacklist(refreshToken)
    return this.generateTokens(payload)
  }

  /**
   * 计算令牌剩余有效时间并提取 JTI
   */
  protected async tokenTtlMsAndJti(token: string) {
    const publicKey = this.configService.get('rsa.publicKey')

    if (!publicKey) {
      throw new Error('无法验证 Token: 未配置 RSA 公钥')
    }

    const verifyOptions = { publicKey, algorithms: ['RS256' as const] }

    const payload = await this.jwtService.verifyAsync(token, {
      ...verifyOptions,
      ignoreExpiration: true,
    })
    const expTimeMs = payload.exp * 1000
    const currentTimeMs = Date.now()
    const ttlMs = Math.max(0, Math.floor(expTimeMs - currentTimeMs))
    return { ttlMs, ...payload }
  }

  /**
   * 退出登录，将 Access Token 和 Refresh Token 添加到黑名单
   */
  async logout(accessToken: string, refreshToken: string): Promise<boolean> {
    await Promise.all([
      this.addToBlacklist(accessToken),
      this.addToBlacklist(refreshToken),
    ])
    return true
  }

  /**
   * 将令牌添加到黑名单
   */
  async addToBlacklist(token: string) {
    const { jti, ttlMs } = await this.tokenTtlMsAndJti(token)
    if (!jti || typeof ttlMs !== 'number' || ttlMs <= 0) {
      return
    }
    await this.blacklistService.addBlacklist(jti, ttlMs)
  }

  /**
   * 解码 Token（不验证签名）
   */
  async decodeToken(token: string) {
    const parts = token.split('.')
    if (parts.length !== 3) {
      throw new UnauthorizedException('无效的 Token 格式')
    }

    const payload = parts[1]
    const decoded = Buffer.from(payload, 'base64').toString('utf-8')
    return JSON.parse(decoded)
  }
}
