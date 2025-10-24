import { Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { v4 as uuid } from 'uuid'

import { JwtBlacklistService } from '@/common/module/jwt/jwt-blacklist.service'
import { ADMIN_AUTH_CONFIG, CLIENT_AUTH_CONFIG } from '@/config/jwt.config'

type AuthConfig = typeof ADMIN_AUTH_CONFIG | typeof CLIENT_AUTH_CONFIG

@Injectable()
export abstract class BaseJwtService {
  protected readonly logger = new Logger(BaseJwtService.name)
  protected abstract readonly config: AuthConfig

  constructor(
    protected readonly jwtService: JwtService,
    protected readonly jwtBlacklistService: JwtBlacklistService,
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
    const { aud, jti, exp, iat, ...payload } =
      await this.jwtService.verifyAsync(refreshToken, {
        secret: this.config.refreshSecret,
      })
    const isBlacklist =
      this.config.aud === 'admin'
        ? await this.jwtBlacklistService.isInAdminBlacklist(jti)
        : await this.jwtBlacklistService.isInClientBlacklist(jti)
    if (
      payload.type !== 'refresh' ||
      aud !== this.config.aud ||
      isBlacklist
    ) {
      throw new UnauthorizedException('登录失效，请重新登录！')
    }

    return this.generateTokens(payload)
  }

  protected async tokenTtlMsAndJti(token: string, secret: string) {
    const payload = await this.jwtService.verifyAsync(token, {
      secret,
      ignoreExpiration: true,
    })
    const expTimeMs = payload.exp * 1000
    const currentTimeMs = Date.now()
    const ttlMs = Math.max(0, Math.floor(expTimeMs - currentTimeMs))
    return { ttlMs, jti: payload.jti }
  }

  async logout(accessToken: string, refreshToken?: string): Promise<boolean> {
    const { jti, ttlMs } = await this.tokenTtlMsAndJti(
      accessToken,
      this.config.secret,
    )
    if (!jti) {
      return false
    }

    if (this.config.aud === 'admin') {
      await this.jwtBlacklistService.addToAdminBlacklist(jti, ttlMs)
    } else {
      await this.jwtBlacklistService.addToClientBlacklist(jti, ttlMs)
    }

    if (refreshToken) {
      const { jti: rjti, ttlMs: rttlMs } = await this.tokenTtlMsAndJti(
        refreshToken,
        this.config.refreshSecret,
      )
      if (rjti) {
        if (this.config.aud === 'admin') {
          await this.jwtBlacklistService.addToAdminBlacklist(rjti, rttlMs)
        } else {
          await this.jwtBlacklistService.addToClientBlacklist(rjti, rttlMs)
        }
      }
    }

    return true
  }
}
