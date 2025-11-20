import { Injectable } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'

import { JwtBlacklistService } from '../../../common/module/jwt/jwt-blacklist.service'
import { validateJwtPayload } from '../../../common/module/jwt/jwt-strategy.util'
import { ADMIN_AUTH_CONFIG } from '../../../config/jwt.config'

/**
 * AdminJwtStrategy 类
 * 实现基于 JWT 的管理员用户认证策略
 * 使用 passport-jwt 库提供的 Strategy 类
 */
@Injectable()
export class AdminJwtStrategy extends PassportStrategy(
  Strategy,
  ADMIN_AUTH_CONFIG.strategyKey,
) {
  constructor(private jwtBlacklistService: JwtBlacklistService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: ADMIN_AUTH_CONFIG.secret,
      passReqToCallback: true,
    })
  }

  /**
   * 验证 JWT 负载
   * 该方法在 JWT 被成功解码后调用
   * @param request 请求对象
   * @param payload JWT 负载
   * @returns 验证通过的用户信息
   * @throws UnauthorizedException 如果角色不是 'admin' 或令牌在黑名单中
   */
  async validate(request: any, payload: any) {
    return validateJwtPayload({
      payload,
      expectedAud: ADMIN_AUTH_CONFIG.aud,
      blacklistService: this.jwtBlacklistService,
    })
  }
}
