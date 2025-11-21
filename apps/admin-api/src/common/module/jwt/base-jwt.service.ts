import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { v4 as uuid } from 'uuid'

import {
  ADMIN_AUTH_CONFIG,
  CLIENT_AUTH_CONFIG,
} from '../../../config/jwt.config'
import { JwtBlacklistService } from './jwt-blacklist.service'

type AuthConfig = typeof ADMIN_AUTH_CONFIG | typeof CLIENT_AUTH_CONFIG

@Injectable()
export abstract class BaseJwtService {
  protected abstract readonly config: AuthConfig

  constructor(
    protected readonly jwtService: JwtService,
    protected readonly jwtBlacklistService: JwtBlacklistService,
  ) {
    // 日志功能已移除
  }

  async generateTokens(payload) {
    payload = {
      ...payload,
      jti: uuid(),
      aud: this.config.aud,
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
    const isBlacklist =
      this.config.aud === 'admin'
        ? await this.jwtBlacklistService.isInAdminBlacklist(jti)
        : await this.jwtBlacklistService.isInClientBlacklist(jti)
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
    if (!jti || typeof ttlMs !== 'number') {
      return
    }
    if (this.config.aud === 'admin') {
      await this.jwtBlacklistService.addToAdminBlacklist(jti, ttlMs)
    } else {
      await this.jwtBlacklistService.addToClientBlacklist(jti, ttlMs)
    }
  }
}
