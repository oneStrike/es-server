import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { ClientJwtPayload } from '@/common/interfaces/jwt-payload.interface'
import { JwtBlacklistService } from '@/common/module/jwt/jwt-blacklist.service'
import { clientJwtConfig } from '@/config/jwt.config'

/**
 * ClientJwtStrategy 类
 * 实现基于 JWT 的客户端用户认证策略
 * 使用 passport-jwt 库提供的 Strategy 类
 */
@Injectable()
export class ClientJwtStrategy extends PassportStrategy(
  Strategy,
  'client-jwt',
) {
  constructor(private jwtBlacklistService: JwtBlacklistService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: clientJwtConfig.secret!,
      passReqToCallback: true,
    })
  }

  /**
   * 验证 JWT 负载
   * 该方法在 JWT 被成功解码后调用
   * @param request 请求对象
   * @param payload JWT 负载
   * @returns 验证通过的用户信息
   * @throws UnauthorizedException 如果角色不是 'client' 或令牌在黑名单中
   */
  async validate(request: any, payload: ClientJwtPayload) {
    if (payload.role !== 'client') {
      throw new UnauthorizedException('登录失效，请重新登录！')
    }

    const token = ExtractJwt.fromAuthHeaderAsBearerToken()(request)

    if (token) {
      const isBlacklisted = await this.jwtBlacklistService.isInClientBlacklist(token)
      if (isBlacklisted) {
        throw new UnauthorizedException('登录失效，请重新登录！')
      }
    }

    return payload
  }
}
