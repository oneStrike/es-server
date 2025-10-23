import { Injectable, Logger } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { v4 as uuid } from 'uuid'

import { JwtBlacklistService } from '@/common/module/jwt/jwt-blacklist.service'
import { ADMIN_AUTH_CONFIG, CLIENT_AUTH_CONFIG } from '@/config/jwt.config'

type AuthConfig = typeof ADMIN_AUTH_CONFIG | typeof CLIENT_AUTH_CONFIG

@Injectable()
export class BaseJwtService {
  protected readonly logger = new Logger(BaseJwtService.name)

  constructor(
    protected readonly jwtService: JwtService,
    protected readonly jwtBlacklistService: JwtBlacklistService,
    protected readonly config: AuthConfig,
  ) {}

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
    const payload = await this.jwtService.verifyAsync(refreshToken, {
      secret: this.config.refreshSecret,
    })

    if (payload.type !== 'refresh') {
      throw new Error('无效的刷新令牌')
    }

    const accessPayload = {
      ...payload,
      type: 'access',
      jti: uuid(),
    }

    const accessToken = await this.jwtService.signAsync(accessPayload, {
      secret: this.config.secret,
      expiresIn: this.config.expiresIn,
    })

    return { accessToken, refreshToken }
  }

  protected async tokenTtlSeconds(token: string, secret: string) {
    const payload = await this.jwtService.verifyAsync(token, {
      secret,
      ignoreExpiration: true,
    })
    const expTimeMs = payload.exp * 1000
    const currentTimeMs = Date.now()
    const ttlSec = Math.max(0, Math.floor(expTimeMs - currentTimeMs))
    const jti = payload.jti
    return { ttlSec, jti }
  }

  async logout(accessToken: string, refreshToken?: string): Promise<boolean> {
    const { jti, ttlSec } = await this.tokenTtlSeconds(
      accessToken,
      this.config.secret,
    )
    if (!jti) {
      return false
    }

    if (this.config.aud === 'admin') {
      await this.jwtBlacklistService.addToAdminBlacklist(jti, ttlSec)
    } else {
      await this.jwtBlacklistService.addToClientBlacklist(jti, ttlSec)
    }

    if (refreshToken) {
      const { jti: rjti, ttlSec: rttlSec } = await this.tokenTtlSeconds(
        refreshToken,
        this.config.refreshSecret,
      )
      if (rjti) {
        if (this.config.aud === 'admin') {
          await this.jwtBlacklistService.addToAdminBlacklist(rjti, rttlSec)
        } else {
          await this.jwtBlacklistService.addToClientBlacklist(rjti, rttlSec)
        }
      }
    }

    return true
  }
}
