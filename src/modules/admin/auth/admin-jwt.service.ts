import { Injectable, Logger } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { v4 as uuid } from 'uuid'
import {
  AdminJwtPayload,
  TokenPair,
} from '@/common/interfaces/jwt-payload.interface'
import { JwtBlacklistService } from '@/common/module/jwt/jwt-blacklist.service'
import { ADMIN_AUTH_CONFIG } from '@/config/jwt.config'

/**
 * AdminJwtService 服务
 * 负责管理员用户的 JWT 令牌生成和验证
 * 提供生成访问令牌和刷新令牌的功能
 */
@Injectable()
export class AdminJwtService {
  private readonly logger = new Logger(AdminJwtService.name)

  constructor(
    private jwtService: JwtService,
    private jwtBlacklistService: JwtBlacklistService,
  ) {}

  /**
   * 生成访问令牌和刷新令牌
   * @param payload 不包含角色的 JWT 负载
   * @returns 包含访问令牌和刷新令牌的对象
   */
  async generateTokens(
    payload: Omit<AdminJwtPayload, 'role' | 'iat' | 'exp' | 'jti' | 'aud'>,
  ): Promise<TokenPair> {
    const adminPayload = {
      ...payload,
      jti: uuid(),
      type: 'access',
      aud: ADMIN_AUTH_CONFIG.aud,
    }

    const refreshPayload = {
      sub: payload.sub,
      username: payload.username,
      type: 'refresh',
      jti: uuid(),
      aud: ADMIN_AUTH_CONFIG.aud,
    }

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(adminPayload, {
        secret: ADMIN_AUTH_CONFIG.secret,
        expiresIn: ADMIN_AUTH_CONFIG.expiresIn,
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: ADMIN_AUTH_CONFIG.refreshSecret,
        expiresIn: ADMIN_AUTH_CONFIG.refreshExpiresIn,
      }),
    ])

    return {
      accessToken,
      refreshToken,
    }
  }

  /**
   * 验证 JWT 令牌
   * @param token 要验证的 JWT 令牌
   * @returns 解码后的 JWT 负载
   */
  async verifyToken(token: string): Promise<AdminJwtPayload> {
    return this.jwtService.verifyAsync(token, {
      secret: ADMIN_AUTH_CONFIG.secret,
    })
  }

  /**
   * 使用刷新令牌生成新的访问令牌
   * @param refreshToken 刷新令牌
   * @returns 新的访问令牌和原有的刷新令牌
   * @throws 如果刷新令牌无效或已过期
   */
  async refreshAccessToken(refreshToken: string): Promise<TokenPair> {
    // 验证刷新令牌
    const payload = await this.jwtService.verifyAsync(refreshToken, {
      secret: ADMIN_AUTH_CONFIG.secret,
    })

    if (payload.type !== 'refresh' || payload.role !== 'admin') {
      throw new Error('Invalid refresh token')
    }

    // 只生成新的访问令牌，使用原始 payload 中的数据
    const adminPayload = {
      sub: payload.sub,
      username: payload.username,
      permissions: payload.permissions,
      jti: uuid(),
      aud: ADMIN_AUTH_CONFIG.aud,
    }

    const accessToken = await this.jwtService.signAsync(adminPayload, {
      secret: ADMIN_AUTH_CONFIG.secret,
      expiresIn: ADMIN_AUTH_CONFIG.expiresIn,
    })

    // 返回新的访问令牌和原有的刷新令牌
    return {
      accessToken,
      refreshToken, // 保持原有的刷新令牌不变
    }
  }

  async tokenTtl(token: string, secret: string) {
    const payload = await this.jwtService.verifyAsync(token, {
      secret,
      ignoreExpiration: true,
    })

    const expTime = payload.exp * 1000
    const currentTime = Date.now()
    return {
      ttl: Math.max(0, Math.floor(expTime - currentTime)),
      jti: payload.jti,
    }
  }

  /**
   * 登出用户，将访问令牌和刷新令牌添加到黑名单
   * @param accessToken 访问令牌
   * @param refreshToken 刷新令牌
   * @returns 是否成功登出
   */
  async logout(accessToken: string, refreshToken?: string): Promise<boolean> {
    const { jti, ttl } = await this.tokenTtl(
      accessToken,
      ADMIN_AUTH_CONFIG.secret,
    )
    await this.jwtBlacklistService.addToAdminBlacklist(jti, ttl)

    if (refreshToken) {
      const { jti, ttl } = await this.tokenTtl(
        refreshToken,
        ADMIN_AUTH_CONFIG.refreshSecret,
      )
      await this.jwtBlacklistService.addToAdminBlacklist(jti, ttl)
    }

    return true
  }
}
