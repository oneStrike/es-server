import type { ITokenStorageService } from './auth.type'
import type {
  AuthLogoutOptions,
  AuthLogoutTokenPair,
  AuthTokenPair,
  SessionClientContext,
} from './session.type'
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import {
  AuthDefaultValue,
  AuthErrorMessages,
  RevokeTokenReasonEnum,
  TOKEN_STORAGE_SERVICE,
} from './auth.constant'
import { AuthService as BaseAuthService } from './auth.service'
import { TokenTypeEnum } from './auth.type'

/** 认证会话服务，负责 token 签发结果的持久化、刷新轮换与退出撤销。 */
@Injectable()
export class AuthSessionService {
  constructor(
    private readonly baseJwtService: BaseAuthService,
    @Inject(TOKEN_STORAGE_SERVICE)
    private readonly tokenStorageService: ITokenStorageService,
  ) {}

  /** 持久化 access/refresh token 对，并记录客户端来源快照。 */
  async persistTokens(
    userId: number,
    tokens: AuthTokenPair,
    clientContext: SessionClientContext,
  ) {
    const [accessPayload, refreshPayload] = await Promise.all([
      this.baseJwtService.decodeToken(tokens.accessToken),
      this.baseJwtService.decodeToken(tokens.refreshToken),
    ])

    await this.tokenStorageService.createTokens([
      {
        userId,
        jti: accessPayload.jti,
        tokenType: TokenTypeEnum.ACCESS,
        expiresAt: new Date(accessPayload.exp * 1000),
        deviceInfo: clientContext.deviceInfo,
        ipAddress: clientContext.ip || AuthDefaultValue.IP_ADDRESS_UNKNOWN,
        userAgent: clientContext.userAgent,
        geoCountry: clientContext.geoCountry,
        geoProvince: clientContext.geoProvince,
        geoCity: clientContext.geoCity,
        geoIsp: clientContext.geoIsp,
        geoSource: clientContext.geoSource,
      },
      {
        userId,
        jti: refreshPayload.jti,
        tokenType: TokenTypeEnum.REFRESH,
        expiresAt: new Date(refreshPayload.exp * 1000),
        deviceInfo: clientContext.deviceInfo,
        ipAddress: clientContext.ip || AuthDefaultValue.IP_ADDRESS_UNKNOWN,
        userAgent: clientContext.userAgent,
        geoCountry: clientContext.geoCountry,
        geoProvince: clientContext.geoProvince,
        geoCity: clientContext.geoCity,
        geoIsp: clientContext.geoIsp,
        geoSource: clientContext.geoSource,
      },
    ])
  }

  /** 原子消费 refresh token 后签发并持久化新的 token 对。 */
  async refreshAndPersist(
    refreshToken: string,
    clientContext: SessionClientContext,
  ) {
    const tokens = await this.baseJwtService.refreshAccessToken(refreshToken, {
      consumeRefreshTokenJti: async (jti) =>
        this.tokenStorageService.consumeByJti(
          jti,
          RevokeTokenReasonEnum.TOKEN_REFRESH,
        ),
    })

    const payload = await this.baseJwtService.decodeToken(tokens.accessToken)
    const userId = Number(payload.sub)
    await this.persistTokens(userId, tokens, clientContext)
    return tokens
  }

  /** 退出登录；需要时同步撤销数据库中的 access/refresh token。 */
  async logout(dto: AuthLogoutTokenPair, options?: AuthLogoutOptions) {
    const { accessToken, refreshToken } = dto

    if (options?.revokeDbTokens) {
      const [accessPayload, refreshPayload] = await Promise.all([
        this.baseJwtService.verifyToken(accessToken, {
          ignoreExpiration: true,
        }),
        this.baseJwtService.verifyToken(refreshToken, {
          ignoreExpiration: true,
        }),
      ])

      if (
        !accessPayload?.jti ||
        typeof accessPayload.jti !== 'string' ||
        !refreshPayload?.jti ||
        typeof refreshPayload.jti !== 'string'
      ) {
        throw new UnauthorizedException(AuthErrorMessages.LOGIN_INVALID)
      }

      await this.tokenStorageService.revokeByJtis(
        [accessPayload.jti, refreshPayload.jti],
        RevokeTokenReasonEnum.USER_LOGOUT,
      )
    }

    return this.baseJwtService.logout(accessToken, refreshToken)
  }
}
