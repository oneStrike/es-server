import { Injectable, Logger } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { v4 as uuid } from 'uuid'
import { JWT_AUDIENCE } from '@/common/constants/auth.constants'
import {
  ClientJwtPayload,
  RefreshTokenPayload,
  TokenPair,
} from '@/common/interfaces/jwt-payload.interface'
import { JwtBlacklistService } from '@/common/module/jwt/jwt-blacklist.service'
import { clientJwtConfig } from '@/config/jwt.config'

/**
 * ClientJwtService 服务
 * 负责客户端用户的 JWT 令牌生成和验证
 * 提供生成访问令牌和刷新令牌的功能
 */
@Injectable()
export class ClientJwtService {
  private readonly logger = new Logger(ClientJwtService.name)

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
    payload: Omit<ClientJwtPayload, 'role' | 'iat' | 'exp' | 'jti' | 'aud'>,
  ): Promise<TokenPair> {
    const jti = uuid()
    const clientPayload: Omit<ClientJwtPayload, 'iat' | 'exp'> = {
      ...payload,
      role: 'client',
      jti,
      aud: JWT_AUDIENCE.CLIENT,
    }

    const refreshPayload: Omit<RefreshTokenPayload, 'iat' | 'exp'> = {
      sub: payload.sub,
      username: payload.username,
      type: 'refresh',
      role: 'client',
      jti: uuid(),
    }

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(clientPayload, {
        secret: clientJwtConfig.secret,
        expiresIn: clientJwtConfig.expiresIn,
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: clientJwtConfig.secret,
        expiresIn: clientJwtConfig.refreshExpiresIn,
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
  async verifyToken(token: string): Promise<ClientJwtPayload> {
    return this.jwtService.verifyAsync(token, {
      secret: clientJwtConfig.secret,
    })
  }

  /**
   * 使用刷新令牌生成新的访问令牌
   * @param refreshToken 刷新令牌
   * @returns 新的访问令牌和原有的刷新令牌
   * @throws 如果刷新令牌无效或已过期
   */
  async refreshAccessToken(refreshToken: string): Promise<TokenPair> {
    const payload = await this.jwtService.verifyAsync(refreshToken, {
      secret: clientJwtConfig.secret,
    })

    if (payload.type !== 'refresh' || payload.role !== 'client') {
      throw new Error('Invalid refresh token')
    }

    const newPayload: Omit<ClientJwtPayload, 'iat' | 'exp'> = {
      sub: payload.sub,
      username: payload.username || 'client',
      role: 'client',
      clientId: payload.clientId,
      permissions: payload.permissions,
      jti: uuid(),
      aud: JWT_AUDIENCE.CLIENT,
    }

    const accessToken = await this.jwtService.signAsync(newPayload, {
      secret: clientJwtConfig.secret,
      expiresIn: clientJwtConfig.expiresIn,
    })

    return {
      accessToken,
      refreshToken,
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
        secret: clientJwtConfig.secret,
        ignoreExpiration: true,
      })

      const expTime = payload.exp * 1000
      const currentTime = Date.now()
      const ttl = Math.max(0, Math.floor((expTime - currentTime) / 1000))

      await this.jwtBlacklistService.addToClientBlacklist(accessToken, ttl)

      if (refreshToken) {
        try {
          const refreshPayload = await this.jwtService.verifyAsync(
            refreshToken,
            {
              secret: clientJwtConfig.secret,
              ignoreExpiration: true,
            },
          )

          const refreshExpTime = refreshPayload.exp * 1000
          const refreshTtl = Math.max(
            0,
            Math.floor((refreshExpTime - currentTime) / 1000),
          )

          await this.jwtBlacklistService.addToClientBlacklist(
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
