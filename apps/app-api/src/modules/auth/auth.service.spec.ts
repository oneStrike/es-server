jest.mock('@libs/platform/modules/auth/auth.service', () => ({
  AuthService: class MockBaseAuthService {},
}))

import { appUser } from '@db/schema'
import type { SessionClientContext } from '@libs/identity/session.type'
import type { LoginDto, RefreshTokenDto } from '@libs/platform/modules/auth/dto'
import { AuthService } from './auth.service'

describe('AuthService latest login geo', () => {
  const activeUser = {
    id: 7,
    account: 'reader001',
    phoneNumber: '13800000000',
    password: 'hashed-password',
    nickname: 'reader',
    avatarUrl: undefined,
    profileBackgroundImageUrl: undefined,
    emailAddress: undefined,
    genderType: undefined,
    birthDate: undefined,
    signature: undefined,
    bio: undefined,
    isEnabled: true,
    status: 1,
    banReason: undefined,
    banUntil: undefined,
    levelId: undefined,
    deletedAt: undefined,
  }

  function createService() {
    const updateSet = jest.fn((payload) => ({
      where: jest.fn(async () => {
        void payload
      }),
    }))
    const db = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            limit: jest.fn(async () => [activeUser]),
          })),
        })),
      })),
      update: jest.fn(() => ({
        set: updateSet,
      })),
    }

    const drizzle = {
      db,
      schema: { appUser },
      withErrorHandling: jest.fn((callback) => callback()),
    }
    const rsaService = { decryptWith: jest.fn(async () => 'plain-password') }
    const smsService = {}
    const scryptService = { verifyPassword: jest.fn(async () => true) }
    const baseJwtService = {
      generateTokens: jest.fn(async () => ({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600,
        refreshExpiresIn: 7200,
      })),
      decodeToken: jest.fn(async () => ({ sub: String(activeUser.id) })),
    }
    const authSessionService = {
      persistTokens: jest.fn(async () => undefined),
      refreshAndPersist: jest.fn(async () => ({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 3600,
        refreshExpiresIn: 7200,
      })),
      logout: jest.fn(async () => undefined),
    }
    const passwordService = {}
    const profileService = {}
    const loginGuardService = {
      checkLock: jest.fn(async () => undefined),
      clearHistory: jest.fn(async () => undefined),
    }
    const userCoreService = {
      ensureAppUserNotBanned: jest.fn(() => undefined),
      getUserGrowthSnapshot: jest.fn(async () => ({
        levelId: undefined,
        levelName: undefined,
        currentLevelPoints: 0,
        nextLevelPoints: 100,
        totalPoints: 0,
        experience: 0,
      })),
      findById: jest.fn(async () => activeUser),
    }

    const service = new AuthService(
      drizzle as never,
      rsaService as never,
      smsService as never,
      scryptService as never,
      baseJwtService as never,
      authSessionService as never,
      passwordService as never,
      profileService as never,
      loginGuardService as never,
      userCoreService as never,
    )

    return { service, updateSet }
  }

  it('persists latest login geo snapshot after successful login without exposing it in login response', async () => {
    const { service, updateSet } = createService()

    const result = await service.login(
      {
        account: activeUser.account,
        password: 'encrypted-password',
      } as LoginDto,
      {
        ip: '203.0.113.9',
        geoCountry: '中国',
        geoProvince: '广东省',
        geoCity: '深圳市',
        geoIsp: '电信',
      } as SessionClientContext,
    )

    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        lastLoginGeoCountry: '中国',
        lastLoginGeoProvince: '广东省',
        lastLoginGeoCity: '深圳市',
        lastLoginGeoIsp: '电信',
      }),
    )
    expect(result.user).not.toHaveProperty('lastLoginGeo')
    expect(result.user).not.toHaveProperty('lastLoginIp')
  })

  it('does not overwrite login geo snapshot when refreshing tokens', async () => {
    const { service, updateSet } = createService()

    await service.refreshToken(
      { refreshToken: 'refresh-token' } as RefreshTokenDto,
      {
        ip: '198.51.100.7',
        geoCountry: '中国',
        geoProvince: '上海市',
        geoCity: '上海市',
        geoIsp: '联通',
      } as SessionClientContext,
    )

    expect(updateSet).not.toHaveBeenCalled()
  })
})
