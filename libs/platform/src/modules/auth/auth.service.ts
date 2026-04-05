import type { AuthConfigInterface } from '@libs/platform/types'
import { Buffer } from 'node:buffer'
import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { v4 as uuid } from 'uuid'
import { AuthErrorMessages } from './auth.constant'
import { JwtBlacklistService } from './jwt-blacklist.service'

interface RefreshAccessTokenOptions {
  consumeRefreshTokenJti?: (jti: string) => boolean | Promise<boolean>
}

/**
 * JWT 认证服务。
 * 负责生成、校验、刷新和撤销 access/refresh token，并与黑名单服务协同处理失效态。
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
      throw new Error('AuthService 缺少 auth 配置')
    }
    this.config = config
  }

  /**
   * 生成 access/refresh token 对。
   * 两类 token 会分别生成独立 jti，避免刷新链路和登出链路共享同一幂等锚点。
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
   * 使用 refresh token 刷新新的 token 对。
   * 刷新成功后会立即把旧 refresh token 加入黑名单，避免同一 refresh token 被重复消费。
   */
  async refreshAccessToken(
    refreshToken: string,
    options: RefreshAccessTokenOptions = {},
  ) {
    const {
      aud,
      iss: _iss,
      exp: _exp,
      iat: _iat,
      nbf: _nbf,
      jti,
      ...payload
    } = await this.jwtService.verifyAsync(refreshToken)
    if (!jti || typeof jti !== 'string') {
      throw new UnauthorizedException(AuthErrorMessages.LOGIN_INVALID)
    }

    const isBlacklist = await this.blacklistService.isInBlacklist(jti)

    if (payload.type !== 'refresh' || aud !== this.config.aud || isBlacklist) {
      throw new UnauthorizedException(AuthErrorMessages.LOGIN_INVALID)
    }

    const isRefreshTokenConsumed = options.consumeRefreshTokenJti
      ? await options.consumeRefreshTokenJti(jti)
      : true
    if (!isRefreshTokenConsumed) {
      throw new UnauthorizedException(AuthErrorMessages.LOGIN_INVALID)
    }

    await this.addToBlacklist(refreshToken)
    return this.generateTokens(payload)
  }

  /**
   * 计算 token 剩余有效时长并提取 jti。
   * 该方法允许忽略过期校验，用于登出或失效清理场景回收已过期 token。
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
   * 登出并同时撤销 access token 和 refresh token。
   * 两类 token 都会被写入黑名单，避免客户端仅销毁一端后仍能继续访问。
   */
  async logout(accessToken: string, refreshToken: string): Promise<boolean> {
    await Promise.all([
      this.addToBlacklist(accessToken),
      this.addToBlacklist(refreshToken),
    ])
    return true
  }

  /**
   * 将 token 加入黑名单。
   * 仅当 token 仍有剩余 TTL 时写入黑名单，避免为已过期 token 额外占用缓存。
   */
  async addToBlacklist(token: string) {
    const { jti, ttlMs } = await this.tokenTtlMsAndJti(token)
    if (!jti || typeof ttlMs !== 'number' || ttlMs <= 0) {
      return
    }
    await this.blacklistService.addBlacklist(jti, ttlMs)
  }

  /**
   * 解码 token 载荷而不做签名校验。
   * 仅用于调试或辅助流程，不能替代正式验签结果。
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

  /**
   * 验签并解析 Token。
   * 默认校验过期时间；在登出等场景可按需忽略过期限制。
   */
  async verifyToken(token: string, options?: { ignoreExpiration?: boolean }) {
    return this.jwtService.verifyAsync(token, {
      ignoreExpiration: options?.ignoreExpiration ?? false,
    })
  }
}
