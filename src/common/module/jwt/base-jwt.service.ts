import { Injectable, Logger } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { v4 as uuid } from 'uuid'
import {
  BaseJwtPayload,
  RefreshTokenPayload,
  TokenPair,
} from '@/common/interfaces/jwt-payload.interface'
import { JwtBlacklistService } from '@/common/module/jwt/jwt-blacklist.service'
import { ADMIN_AUTH_CONFIG, CLIENT_AUTH_CONFIG } from '@/config/jwt.config'

type AuthConfig = typeof ADMIN_AUTH_CONFIG | typeof CLIENT_AUTH_CONFIG

type Scope = 'admin' | 'client'

@Injectable()
export class BaseJwtService<TPayload extends BaseJwtPayload> {
  protected readonly logger = new Logger(BaseJwtService.name)

  constructor(
    protected readonly jwtService: JwtService,
    protected readonly jwtBlacklistService: JwtBlacklistService,
    protected readonly config: AuthConfig,
    protected readonly scope: Scope,
  ) {}

  async generateTokens(
    payload: Omit<TPayload, 'iat' | 'exp' | 'jti' | 'aud'>,
  ): Promise<TokenPair> {
    const accessPayload = this.buildAccessPayload(payload)
    const refreshPayload = this.buildRefreshPayload({
      sub: payload.sub,
      username: payload.username,
    })

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: this.config.secret,
        expiresIn: this.config.expiresIn,
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: this.config.refreshSecret,
        expiresIn: this.config.refreshExpiresIn,
      }),
    ])

    return { accessToken, refreshToken }
  }

  async verifyToken(token: string): Promise<TPayload> {
    return this.jwtService.verifyAsync(token, {
      secret: this.config.secret,
    })
  }

  async refreshAccessToken(refreshToken: string): Promise<TokenPair> {
    const payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(
      refreshToken,
      { secret: this.config.refreshSecret },
    )

    if (payload.type !== 'refresh' || payload.role !== this.scope) {
      throw new Error('Invalid refresh token')
    }

    const accessPayload = this.buildAccessPayload({
      sub: payload.sub,
      username: payload.username,
    } as Omit<TPayload, 'iat' | 'exp' | 'jti' | 'aud'>)

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
    const payloadAny = (payload as unknown) as { exp: number, jti?: string }
    const expTimeMs = payloadAny.exp * 1000
    const currentTimeMs = Date.now()
    const ttlSec = Math.max(0, Math.floor((expTimeMs - currentTimeMs) / 1000))
    const jti = payloadAny.jti
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

    if (this.scope === 'admin') {
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
        if (this.scope === 'admin') {
          await this.jwtBlacklistService.addToAdminBlacklist(rjti, rttlSec)
        } else {
          await this.jwtBlacklistService.addToClientBlacklist(rjti, rttlSec)
        }
      }
    }

    return true
  }

  protected buildAccessPayload(
    payload: Omit<TPayload, 'iat' | 'exp' | 'jti' | 'aud'>,
  ): TPayload {
    return {
      ...(payload as any),
      jti: uuid(),
      aud: this.config.aud,
    } as TPayload
  }

  protected buildRefreshPayload(
    payload: Pick<BaseJwtPayload, 'sub' | 'username'>,
  ): RefreshTokenPayload {
    return {
      sub: payload.sub,
      username: payload.username,
      type: 'refresh',
      role: this.scope,
      jti: uuid(),
    }
  }
}
