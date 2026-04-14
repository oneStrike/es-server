import type { ITokenStorageService } from '@libs/platform/modules/auth/auth.types';
import type { SessionClientContext } from './session.type'
import { AuthDefaultValue, AuthErrorMessages, RevokeTokenReasonEnum } from '@libs/platform/modules/auth/auth.constant';
import { AuthService as BaseAuthService } from '@libs/platform/modules/auth/auth.service';
import { TokenTypeEnum } from '@libs/platform/modules/auth/token-storage.types'
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'

@Injectable()
export class AuthSessionService {
  constructor(
    private readonly baseJwtService: BaseAuthService,
    @Inject('ITokenStorageService')
    private readonly tokenStorageService: ITokenStorageService,
  ) {}

  async persistTokens(
    userId: number,
    tokens: { accessToken: string, refreshToken: string },
    clientContext: SessionClientContext,
  ) {
    const [accessPayload, refreshPayload] = await Promise.all([
      this.baseJwtService.decodeToken(tokens.accessToken),
      this.baseJwtService.decodeToken(tokens.refreshToken),
    ])

    const ipAddress =
      clientContext.ip || AuthDefaultValue.IP_ADDRESS_UNKNOWN
    const userAgent = clientContext.userAgent
    const deviceInfo = clientContext.deviceInfo
    const geoCountry = clientContext.geoCountry
    const geoProvince = clientContext.geoProvince
    const geoCity = clientContext.geoCity
    const geoIsp = clientContext.geoIsp
    const geoSource = clientContext.geoSource

    await this.tokenStorageService.createTokens([
      {
        userId,
        jti: accessPayload.jti,
        tokenType: TokenTypeEnum.ACCESS,
        expiresAt: new Date(accessPayload.exp * 1000),
        deviceInfo,
        ipAddress,
        userAgent,
        geoCountry,
        geoProvince,
        geoCity,
        geoIsp,
        geoSource,
      },
      {
        userId,
        jti: refreshPayload.jti,
        tokenType: TokenTypeEnum.REFRESH,
        expiresAt: new Date(refreshPayload.exp * 1000),
        deviceInfo,
        ipAddress,
        userAgent,
        geoCountry,
        geoProvince,
        geoCity,
        geoIsp,
        geoSource,
      },
    ])
  }

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

  async logout(
    dto: { accessToken: string, refreshToken: string },
    options?: { revokeDbTokens?: boolean },
  ) {
    const { accessToken, refreshToken } = dto

    if (options?.revokeDbTokens) {
      const [accessPayload, refreshPayload] = await Promise.all([
        this.baseJwtService.verifyToken(accessToken, { ignoreExpiration: true }),
        this.baseJwtService.verifyToken(refreshToken, { ignoreExpiration: true }),
      ])

      if (
        !accessPayload?.jti
        || typeof accessPayload.jti !== 'string'
        || !refreshPayload?.jti
        || typeof refreshPayload.jti !== 'string'
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
