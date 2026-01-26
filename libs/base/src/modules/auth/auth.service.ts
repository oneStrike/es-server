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
   * 同时生成 Access Token 和 Refresh Token
   * @param payload - Token 负载数据，通常包含用户 ID 等信息
   * @returns Token 对，包含 accessToken 和 refreshToken
   */
  async generateTokens(payload) {
    const basePayload = {
      ...payload,
      aud: this.config.aud,
      iss: this.config.iss,
    }

    const signOptions = this.config.privateKey
      ? { privateKey: this.config.privateKey, algorithm: 'RS256' as const }
      : { secret: this.config.secret }

    const refreshSignOptions = this.config.privateKey
      ? { privateKey: this.config.privateKey, algorithm: 'RS256' as const }
      : { secret: this.config.refreshSecret }

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { ...basePayload, jti: uuid(), type: 'access' },
        {
          ...signOptions,
          expiresIn: this.config.expiresIn,
        },
      ),
      this.jwtService.signAsync(
        { ...basePayload, jti: uuid(), type: 'refresh' },
        {
          ...refreshSignOptions,
          expiresIn: this.config.refreshExpiresIn,
        },
      ),
    ])

    return { accessToken, refreshToken }
  }

  /**
   * 使用 Refresh Token 刷新 Access Token
   * 验证 Refresh Token 的有效性，撤销旧的 Refresh Token，生成新的 Token 对
   * @param refreshToken - Refresh Token 字符串
   * @returns 新的 Token 对，包含 accessToken 和 refreshToken
   * @throws {UnauthorizedException} Refresh Token 无效或已撤销
   */
  async refreshAccessToken(refreshToken: string) {
    const verifyOptions = this.config.publicKey
      ? { publicKey: this.config.publicKey, algorithms: ['RS256' as const] }
      : { secret: this.config.refreshSecret }

    const { aud, jti, exp, iat, ...payload } =
      await this.jwtService.verifyAsync(refreshToken, verifyOptions)
    const isBlacklist = await this.blacklistService.isInBlacklist(jti)
    if (payload.type !== 'refresh' || aud !== this.config.aud || isBlacklist) {
      throw new UnauthorizedException(AuthErrorConstant.LOGIN_INVALID)
    }

    await this.addToBlacklist(refreshToken, this.config.refreshSecret)
    return this.generateTokens(payload)
  }

  /**
   * 计算令牌剩余有效时间并提取 JTI
   * @param token - JWT Token 字符串
   * @param secret - 用于验证 Token 的密钥
   * @returns 包含 ttlMs（剩余毫秒数）、jti 和其他 payload 字段的对象
   */
  protected async tokenTtlMsAndJti(token: string, secret: string) {
    const verifyOptions = this.config.publicKey
      ? { publicKey: this.config.publicKey, algorithms: ['RS256' as const] }
      : { secret }

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
   * @param accessToken - Access Token 字符串
   * @param refreshToken - Refresh Token 字符串
   * @returns 退出登录成功返回 true
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
   * @param token - JWT Token 字符串
   * @param secret - 用于验证 Token 的密钥
   * @returns 无返回值
   */
  async addToBlacklist(token: string, secret: string): Promise<void> {
    const { jti, ttlMs } = await this.tokenTtlMsAndJti(token, secret)
    if (!jti || typeof ttlMs !== 'number' || ttlMs <= 0) {
      return
    }
    await this.blacklistService.addBlacklist(jti, ttlMs)
  }

  /**
   * 解码 Token（不验证签名）
   * 用于提取 Token 负载信息，不进行签名验证，性能更好
   * @param token - JWT Token 字符串
   * @returns Token 负载对象
   * @throws {UnauthorizedException} Token 格式无效
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
