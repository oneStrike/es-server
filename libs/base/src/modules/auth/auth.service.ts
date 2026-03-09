import type { AuthConfigInterface } from '@libs/base/types'
import { Buffer } from 'node:buffer'
import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { v4 as uuid } from 'uuid'
import { AuthErrorConstant } from './auth.constant'
import { JwtBlacklistService } from './jwt-blacklist.service'

interface RefreshAccessTokenOptions {
  validateRefreshTokenJti?: (jti: string) => boolean | Promise<boolean>
  revokeRefreshTokenJti?: (jti: string) => void | Promise<void>
}

/**
 * JWT 璁よ瘉鏈嶅姟绫?
 * 鎻愪緵 JWT Token 鐨勭敓鎴愩€侀獙璇併€佸埛鏂板拰鎾ら攢鍔熻兘
 * 鏀寔 Access Token 鍜?Refresh Token 鍙屼护鐗屾満鍒?
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
      throw new Error('AuthService锛氱己灏?auth 閰嶇疆')
    }
    this.config = config
  }

  /**
   * 鐢熸垚 JWT Token 瀵?
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
   * 浣跨敤 Refresh Token 鍒锋柊 Access Token
   */
  async refreshAccessToken(
    refreshToken: string,
    options: RefreshAccessTokenOptions = {},
  ) {
    const { aud, jti, ...payload } =
      await this.jwtService.verifyAsync(refreshToken)
    if (!jti || typeof jti !== 'string') {
      throw new UnauthorizedException(AuthErrorConstant.LOGIN_INVALID)
    }

    const isBlacklist = await this.blacklistService.isInBlacklist(jti)
    const isPersisted = options.validateRefreshTokenJti
      ? await options.validateRefreshTokenJti(jti)
      : true

    if (
      payload.type !== 'refresh'
      || aud !== this.config.aud
      || isBlacklist
      || !isPersisted
    ) {
      throw new UnauthorizedException(AuthErrorConstant.LOGIN_INVALID)
    }

    if (options.revokeRefreshTokenJti) {
      await options.revokeRefreshTokenJti(jti)
    }

    await this.addToBlacklist(refreshToken)
    return this.generateTokens(payload)
  }

  /**
   * 璁＄畻浠ょ墝鍓╀綑鏈夋晥鏃堕棿骞舵彁鍙?JTI
   */
  protected async tokenTtlMsAndJti(token: string) {
    const publicKey = this.configService.get('rsa.publicKey')

    if (!publicKey) {
      throw new Error('鏃犳硶楠岃瘉 Token: 鏈厤缃?RSA 鍏挜')
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
   * 閫€鍑虹櫥褰曪紝灏?Access Token 鍜?Refresh Token 娣诲姞鍒伴粦鍚嶅崟
   */
  async logout(accessToken: string, refreshToken: string): Promise<boolean> {
    await Promise.all([
      this.addToBlacklist(accessToken),
      this.addToBlacklist(refreshToken),
    ])
    return true
  }

  /**
   * 灏嗕护鐗屾坊鍔犲埌榛戝悕鍗?
   */
  async addToBlacklist(token: string) {
    const { jti, ttlMs } = await this.tokenTtlMsAndJti(token)
    if (!jti || typeof ttlMs !== 'number' || ttlMs <= 0) {
      return
    }
    await this.blacklistService.addBlacklist(jti, ttlMs)
  }

  /**
   * 瑙ｇ爜 Token锛堜笉楠岃瘉绛惧悕锛?
   */
  async decodeToken(token: string) {
    const parts = token.split('.')
    if (parts.length !== 3) {
      throw new UnauthorizedException('鏃犳晥鐨?Token 鏍煎紡')
    }

    const payload = parts[1]
    const decoded = Buffer.from(payload, 'base64').toString('utf-8')
    return JSON.parse(decoded)
  }
}
