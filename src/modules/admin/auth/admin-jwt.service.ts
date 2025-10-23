import { Injectable, Logger } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { v4 as uuid } from 'uuid'
import { JWT_AUDIENCE } from '@/common/constants/auth.constants'
import {
  AdminJwtPayload,
  RefreshTokenPayload,
  TokenPair,
} from '@/common/interfaces/jwt-payload.interface'
import { JwtBlacklistService } from '@/common/module/jwt/jwt-blacklist.service'
import { adminJwtConfig } from '@/config/jwt.config'

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
    const jti = uuid()
    const adminPayload: Omit<AdminJwtPayload, 'iat' | 'exp'> = {
      ...payload,
      role: 'admin',
      jti,
      aud: JWT_AUDIENCE.ADMIN,
    }

    const refreshPayload: Omit<RefreshTokenPayload, 'iat' | 'exp'> = {
      sub: payload.sub,
      username: payload.username,
      type: 'refresh',
      role: 'admin',
      jti: uuid(),
    }

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(adminPayload, {
        secret: adminJwtConfig.secret,
        expiresIn: adminJwtConfig.expiresIn,
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: adminJwtConfig.secret,
        expiresIn: adminJwtConfig.refreshExpiresIn,
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
      secret: adminJwtConfig.secret,
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
      secret: adminJwtConfig.secret,
    })

    if (payload.type !== 'refresh' || payload.role !== 'admin') {
      throw new Error('Invalid refresh token')
    }

    // 只生成新的访问令牌，使用原始 payload 中的数据
    const adminPayload: Omit<AdminJwtPayload, 'iat' | 'exp'> = {
      sub: payload.sub,
      username: payload.username,
      role: 'admin',
      permissions: payload.permissions,
      jti: uuid(),
      aud: JWT_AUDIENCE.ADMIN,
    }

    const accessToken = await this.jwtService.signAsync(adminPayload, {
      secret: adminJwtConfig.secret,
      expiresIn: adminJwtConfig.expiresIn,
    })

    // 返回新的访问令牌和原有的刷新令牌
    return {
      accessToken,
      refreshToken, // 保持原有的刷新令牌不变
    }
  }

  /**
   * 登出用户，将访问令牌和刷新令牌添加到黑名单
   * @param accessToken 访问令牌
   * @param refreshToken 刷新令牌
   * @returns 是否成功登出
   */
  async logout(accessToken: string, refreshToken?: string): Promise<boolean> {
    try {
      const payload = await this.jwtService.verifyAsync(accessToken, {
        secret: adminJwtConfig.secret,
        ignoreExpiration: true,
      })

      const expTime = payload.exp * 1000
      const currentTime = Date.now()
      const ttl = Math.max(0, Math.floor((expTime - currentTime) / 1000))

      await this.jwtBlacklistService.addToAdminBlacklist(accessToken, ttl)

      if (refreshToken) {
        try {
          const refreshPayload = await this.jwtService.verifyAsync(
            refreshToken,
            {
              secret: adminJwtConfig.secret,
              ignoreExpiration: true,
            },
          )

          const refreshExpTime = refreshPayload.exp * 1000
          const refreshTtl = Math.max(
            0,
            Math.floor((refreshExpTime - currentTime) / 1000),
          )

          await this.jwtBlacklistService.addToAdminBlacklist(
            refreshToken,
            refreshTtl,
          )
        } catch (error) {
          this.logger.error('刷新令牌添加到黑名单失败', error instanceof Error ? error.message : String(error))
        }
      }

      return true
    } catch (error) {
      this.logger.error('登出失败', error instanceof Error ? error.message : String(error))
      return false
    }
  }
}
