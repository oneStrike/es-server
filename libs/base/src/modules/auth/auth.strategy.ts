import type { AuthConfigInterface } from '@libs/base/types'
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy, StrategyOptions } from 'passport-jwt'
import { AuthErrorConstant } from './auth.constant'
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
 * Token 存储服务接口
 */
export interface ITokenStorageService {
  /**
   * 根据 JTI 查询 Token
   * @param jti JWT Token ID
   * @returns Token 记录或 null
   */
  findByJti: (jti: string) => Promise<any>

  /**
   * 检查 Token 是否有效
   * 有效条件：Token 存在、未被撤销、未过期
   * @param jti JWT Token ID
   * @returns true=有效, false=无效
   */
  isTokenValid: (jti: string) => Promise<boolean>

  /**
   * 清理过期 Token
   * @returns 清理数量
   */
  cleanupExpiredTokens: () => Promise<number>

  /**
   * 删除已撤销的旧 Token
   * @param retentionDays 保留天数
   * @returns 删除数量
   */
  deleteOldRevokedTokens: (retentionDays: number) => Promise<number>
}

/**
 * AuthStrategy 类
 * 实现基于 JWT 的用户认证策略
 * 使用 passport-jwt 库提供的 Strategy 类
 */
@Injectable()
export class AuthStrategy extends PassportStrategy(Strategy) {
  name: string

  constructor(
    private readonly jwtBlacklistService: JwtBlacklistService,
    /**
     * 使用依赖注入获取 TokenStorageService 实现
     * 这样可以在不修改 libs/base 的情况下，由应用层提供具体实现
     */
    @Inject('ITokenStorageService')
    private readonly tokenStorageService: ITokenStorageService,
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {
    // 获取并验证必要的配置
    const authConfig = configService.get<AuthConfigInterface>('auth')
    const rsaConfig = configService.get('rsa')

    if (!authConfig) {
      throw new Error('AuthStrategy：缺少 auth 配置')
    }
    if (!rsaConfig?.publicKey) {
      throw new Error('AuthStrategy：缺少 RSA 公钥配置')
    }

    // 配置 JWT 策略选项
    const options: StrategyOptions = {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: rsaConfig.publicKey,
      algorithms: ['RS256'],
      passReqToCallback: true,
    }

    super(options)
    this.name = authConfig.strategyKey
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
      throw new UnauthorizedException(AuthErrorConstant.LOGIN_INVALID)
    }

    // 验证令牌类型必须为 access
    if (payload.type !== 'access') {
      throw new UnauthorizedException(AuthErrorConstant.LOGIN_INVALID)
    }

    // 验证发行者（可选）
    const expectedIss = this.configService.get<string>('auth.iss')
    if (expectedIss && payload.iss !== expectedIss) {
      throw new UnauthorizedException(AuthErrorConstant.LOGIN_INVALID)
    }

    // 验证 token ID 是否存在
    const jti = payload.jti
    if (!jti) {
      throw new UnauthorizedException(AuthErrorConstant.LOGIN_INVALID)
    }

    // 检查令牌是否在黑名单中
    const isBlacklisted = await this.jwtBlacklistService.isInBlacklist(jti)
    if (isBlacklisted) {
      throw new UnauthorizedException(AuthErrorConstant.LOGIN_INVALID)
    }

    // 检查令牌是否在数据库中被撤销
    const isRevoked = !(await this.tokenStorageService.isTokenValid(jti))
    if (isRevoked) {
      throw new UnauthorizedException(AuthErrorConstant.LOGIN_INVALID)
    }

    // 验证通过，返回用户信息
    return payload
  }
}
