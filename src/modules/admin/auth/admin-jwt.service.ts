import { Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'

import { BaseJwtService } from '@/common/module/jwt/base-jwt.service'
import { JwtBlacklistService } from '@/common/module/jwt/jwt-blacklist.service'
import { ADMIN_AUTH_CONFIG } from '@/config/jwt.config'

/**
 * AdminJwtService 服务
 * 负责管理员用户的 JWT 令牌生成和验证
 * 提供生成访问令牌和刷新令牌的功能
 */
@Injectable()
export class AdminJwtService extends BaseJwtService {
  protected readonly config = ADMIN_AUTH_CONFIG

  constructor(
    jwtService: JwtService,
    jwtBlacklistService: JwtBlacklistService,
  ) {
    super(jwtService, jwtBlacklistService)
  }
}
