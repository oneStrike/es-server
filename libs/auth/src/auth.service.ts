import type { AuthConfig } from './types'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'

import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { Cache } from 'cache-manager'
import { v4 as uuid } from 'uuid'
import { JwtBlacklistService } from './jwt-blacklist.service'

@Injectable()
export class AuthService {
  protected readonly config: AuthConfig

  constructor(
    protected readonly jwtService: JwtService,
    protected readonly configService: ConfigService,
    protected readonly blacklistService: JwtBlacklistService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    const config = this.configService.get<AuthConfig>('auth')
    if (!config) {
      throw new Error('AuthService：缺少 auth 配置')
    }
    this.config = config
  }

  async generateTokens(payload) {
    payload = {
      ...payload,
      jti: uuid(),
      aud: this.config.aud,
      iss: this.config.iss,
    }

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { ...payload, type: 'access' },
        {
          secret: this.config.secret,
          expiresIn: this.config.expiresIn,
        },
      ),
      this.jwtService.signAsync(
        { ...payload, type: 'refresh' },
        {
          secret: this.config.refreshSecret,
          expiresIn: this.config.refreshExpiresIn,
        },
      ),
    ])

    return { accessToken, refreshToken }
  }

  async refreshAccessToken(refreshToken: string) {
    const { aud, jti, exp, iat, ...payload } =
      await this.jwtService.verifyAsync(refreshToken, {
        secret: this.config.refreshSecret,
      })
    const isBlacklist = await this.blacklistService.isInBlacklist(jti)
    if (payload.type !== 'refresh' || aud !== this.config.aud || isBlacklist) {
      throw new UnauthorizedException('登录失效，请重新登录！')
    }

    await this.addToBlacklist(refreshToken, this.config.refreshSecret)
    return this.generateTokens(payload)
  }

  /**
   * 计算令牌剩余有效时间
   */
  protected async tokenTtlMsAndJti(token: string, secret: string) {
    const payload = await this.jwtService.verifyAsync(token, {
      secret,
      ignoreExpiration: true,
    })
    const expTimeMs = payload.exp * 1000
    const currentTimeMs = Date.now()
    const ttlMs = Math.max(0, Math.floor(expTimeMs - currentTimeMs))
    return { ttlMs, ...payload }
  }

  /**
   * 退出登录，将令牌添加到黑名单
   */
  async logout(accessToken: string, refreshToken: string): Promise<boolean> {
    await Promise.all([
      this.addToBlacklist(accessToken, this.config.secret),
      this.addToBlacklist(refreshToken, this.config.refreshSecret),
    ])
    return true
  }

  /**
   * 将令牌添加到黑名单
   */
  async addToBlacklist(token: string, secret: string): Promise<void> {
    const { jti, ttlMs } = await this.tokenTtlMsAndJti(token, secret)
    if (!jti || typeof ttlMs !== 'number' || ttlMs <= 0) {
      return
    }
    await this.blacklistService.addBlacklist(jti, ttlMs)
  }
}
