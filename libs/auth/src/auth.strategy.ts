import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy, StrategyOptions } from 'passport-jwt'
import { JwtBlacklistService } from './jwt-blacklist.service'

/**
 * JWT负载接口定义
 */
interface JwtPayload {
  jti: string
  aud: string
  [key: string]: any
}

/**
 * AuthStrategy 类
 * 实现基于 JWT 的用户认证策略
 * 使用 passport-jwt 库提供的 Strategy 类
 */
@Injectable()
export class AuthStrategy extends PassportStrategy(Strategy) {
  // 错误消息常量
  private static readonly UNAUTHORIZED_MESSAGE = '登录失效，请重新登录！'

  constructor(
    private readonly jwtBlacklistService: JwtBlacklistService,
    private readonly configService: ConfigService,
  ) {
    // 获取并验证必要的配置
    const secret = configService.get<string>('auth.secret')
    if (!secret) {
      throw new Error('AuthStrategy：缺少 JWT 密钥配置')
    }

    // 配置 JWT 策略选项
    const options: StrategyOptions = {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
      passReqToCallback: true,
    }

    super(options)
  }

  /**
   * 验证 JWT 负载
   * 该方法在 JWT 被成功解码后调用
   * @param request 请求对象
   * @param payload JWT 负载
   * @returns 验证通过的用户信息
   * @throws UnauthorizedException 如果验证失败
   */
  async validate(request: Request, payload: JwtPayload): Promise<JwtPayload> {
    // 验证 audience
    const expectedAud = this.configService.get<string>('auth.aud')
    if (expectedAud && payload.aud !== expectedAud) {
      throw new UnauthorizedException(AuthStrategy.UNAUTHORIZED_MESSAGE)
    }

    // 验证 token ID 是否存在
    const jti = payload.jti
    if (!jti) {
      throw new UnauthorizedException(AuthStrategy.UNAUTHORIZED_MESSAGE)
    }

    // 检查令牌是否在黑名单中
    const isBlacklisted = await this.jwtBlacklistService.isInBlacklist(jti)
    if (isBlacklisted) {
      throw new UnauthorizedException(AuthStrategy.UNAUTHORIZED_MESSAGE)
    }

    // 验证通过，返回用户信息
    return payload
  }
}
