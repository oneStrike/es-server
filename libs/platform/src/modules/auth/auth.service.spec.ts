jest.mock('uuid', () => ({
  v4: () => 'test-jti',
}))

import { UnauthorizedException } from '@nestjs/common'
import { JsonWebTokenError } from '@nestjs/jwt'
import { AuthService } from './auth.service'

describe('AuthService refresh token errors', () => {
  function createService() {
    const jwtService = {
      verifyAsync: jest.fn(),
    }
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'auth') {
          return {
            aud: 'es-admin',
            expiresIn: '4h',
            iss: 'es',
            refreshExpiresIn: '7d',
            strategyKey: 'jwt',
          }
        }
        return undefined
      }),
    }
    const blacklistService = {
      isInBlacklist: jest.fn(async () => false),
    }

    return {
      service: new AuthService(
        jwtService as never,
        configService as never,
        blacklistService as never,
      ),
      jwtService,
    }
  }

  it('maps invalid refresh token signatures to unauthorized errors', async () => {
    const { service, jwtService } = createService()
    jwtService.verifyAsync.mockRejectedValueOnce(
      new JsonWebTokenError('invalid signature'),
    )

    await expect(
      service.refreshAccessToken('stale-refresh-token'),
    ).rejects.toBeInstanceOf(UnauthorizedException)
  })
})
