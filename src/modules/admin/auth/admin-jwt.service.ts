import { Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { v4 as uuid } from 'uuid'
import { AdminJwtPayload, RefreshTokenPayload } from '@/common/interfaces/jwt-payload.interface'
import { BaseJwtService } from '@/common/module/jwt/base-jwt.service'
import { JwtBlacklistService } from '@/common/module/jwt/jwt-blacklist.service'
import { ADMIN_AUTH_CONFIG } from '@/config/jwt.config'

/**
 * AdminJwtService 服务
 * 负责管理员用户的 JWT 令牌生成和验证
 * 提供生成访问令牌和刷新令牌的功能
 */
@Injectable()
export class AdminJwtService extends BaseJwtService<AdminJwtPayload> {
  constructor(
    jwtService: JwtService,
    jwtBlacklistService: JwtBlacklistService,
  ) {
    super(jwtService, jwtBlacklistService, ADMIN_AUTH_CONFIG, 'admin')
  }

  // 构造 Admin 访问令牌载荷
  protected buildAccessPayload(
    payload: Omit<AdminJwtPayload, 'iat' | 'exp' | 'jti' | 'aud'>,
  ): AdminJwtPayload {
    return {
      ...payload,
      jti: uuid(),
      aud: ADMIN_AUTH_CONFIG.aud,
    }
  }

  // 构造 Admin 刷新令牌载荷
  protected buildRefreshPayload(
    payload: Pick<AdminJwtPayload, 'sub' | 'username'>,
  ): RefreshTokenPayload {
    return {
      sub: payload.sub,
      username: payload.username,
      type: 'refresh' as const,
      role: 'admin' as const,
      jti: uuid(),
    }
  }
}
