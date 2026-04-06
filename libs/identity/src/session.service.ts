import type { ITokenStorageService } from '@libs/platform/modules/auth/auth.types';
import type { FastifyRequest } from 'fastify'
import { AuthDefaultValue, AuthErrorMessages, RevokeTokenReasonEnum } from '@libs/platform/modules/auth/auth.constant';
import { AuthService as BaseAuthService } from '@libs/platform/modules/auth/auth.service';
import { extractIpAddress, extractUserAgent, parseDeviceInfo } from '@libs/platform/utils/requestParse';
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
    req: FastifyRequest,
  ) {
    const [accessPayload, refreshPayload] = await Promise.all([
      this.baseJwtService.decodeToken(tokens.accessToken),
      this.baseJwtService.decodeToken(tokens.refreshToken),
    ])

    const ipAddress =
      extractIpAddress(req) || AuthDefaultValue.IP_ADDRESS_UNKNOWN
    const userAgent = extractUserAgent(req) || req.headers['user-agent']
    const deviceInfoStr = parseDeviceInfo(
      typeof userAgent === 'string' ? userAgent : undefined,
    )
    const deviceInfo = deviceInfoStr ? JSON.parse(deviceInfoStr) : undefined

    await this.tokenStorageService.createTokens([
      {
        userId,
        jti: accessPayload.jti,
        tokenType: 'ACCESS',
        expiresAt: new Date(accessPayload.exp * 1000),
        deviceInfo,
        ipAddress,
        userAgent: typeof userAgent === 'string' ? userAgent : undefined,
      },
      {
        userId,
        jti: refreshPayload.jti,
        tokenType: 'REFRESH',
        expiresAt: new Date(refreshPayload.exp * 1000),
        deviceInfo,
        ipAddress,
        userAgent: typeof userAgent === 'string' ? userAgent : undefined,
      },
    ])
  }

  async refreshAndPersist(refreshToken: string, req: FastifyRequest) {
    const tokens = await this.baseJwtService.refreshAccessToken(refreshToken, {
      consumeRefreshTokenJti: async (jti) =>
        this.tokenStorageService.consumeByJti(
          jti,
          RevokeTokenReasonEnum.TOKEN_REFRESH,
        ),
    })

    const payload = await this.baseJwtService.decodeToken(tokens.accessToken)
    const userId = Number(payload.sub)
    await this.persistTokens(userId, tokens, req)
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
