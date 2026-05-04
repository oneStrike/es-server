jest.mock('uuid', () => ({
  v4: jest.fn(() => '00000000-0000-4000-8000-000000000000'),
}))

import { AuthService } from './auth.service'

describe('AuthService returned user contract', () => {
  function createSelectChain(user: object) {
    return {
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([user]),
    }
  }

  function createUpdateChain() {
    const where = jest.fn().mockResolvedValue(undefined)
    const set = jest.fn().mockReturnValue({ where })
    const update = jest.fn().mockReturnValue({ set })

    return { set, update, where }
  }

  function createService() {
    const user = {
      id: 7,
      account: 'user007',
      phoneNumber: '13800000000',
      password: 'hashed-password',
      nickname: '测试用户',
      avatarUrl: 'https://cdn.example.com/avatar.png',
      profileBackgroundImageUrl:
        'https://cdn.example.com/profile-background.png',
      emailAddress: 'user007@example.com',
      genderType: 1,
      birthDate: '2000-01-01',
      signature: '保持更新',
      bio: '个人简介',
      status: 1,
      isEnabled: true,
      banReason: null,
      banUntil: null,
    }
    const selectChain = createSelectChain(user)
    const updateChain = createUpdateChain()
    const drizzle = {
      db: {
        select: jest.fn().mockReturnValue(selectChain),
        update: updateChain.update,
      },
      schema: {
        appUser: {
          id: 'appUser.id',
          account: 'appUser.account',
          phoneNumber: 'appUser.phoneNumber',
          deletedAt: 'appUser.deletedAt',
          lastLoginAt: 'appUser.lastLoginAt',
          lastLoginIp: 'appUser.lastLoginIp',
        },
      },
      withErrorHandling: jest.fn(async (callback: () => Promise<unknown>) =>
        callback(),
      ),
    }
    const baseJwtService = {
      generateTokens: jest.fn().mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      }),
    }
    const authSessionService = {
      persistTokens: jest.fn().mockResolvedValue(undefined),
    }
    const loginGuardService = {
      checkLock: jest.fn().mockResolvedValue(undefined),
      clearHistory: jest.fn().mockResolvedValue(undefined),
    }
    const userCoreService = {
      ensureAppUserNotBanned: jest.fn(),
      getUserGrowthSnapshot: jest.fn().mockResolvedValue({
        points: 100,
        experience: 200,
      }),
    }

    const service = new AuthService(
      drizzle as never,
      { decryptWith: jest.fn().mockReturnValue('plain-password') } as never,
      {} as never,
      { verifyPassword: jest.fn().mockResolvedValue(true) } as never,
      baseJwtService as never,
      authSessionService as never,
      {} as never,
      {} as never,
      loginGuardService as never,
      userCoreService as never,
    )

    return {
      authSessionService,
      baseJwtService,
      service,
      userCoreService,
    }
  }

  it('includes profileBackgroundImageUrl in login user snapshots', async () => {
    const { authSessionService, baseJwtService, service, userCoreService } =
      createService()

    const result = await service.login(
      {
        phone: '13800000000',
        password: 'cipher-password',
      } as never,
      {
        ip: '127.0.0.1',
      } as never,
    )

    expect(result.user).toMatchObject({
      id: 7,
      points: 100,
      experience: 200,
      profileBackgroundImageUrl:
        'https://cdn.example.com/profile-background.png',
    })
    expect(result.tokens).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    })
    expect(baseJwtService.generateTokens).toHaveBeenCalledWith({
      sub: '7',
      phone: '13800000000',
    })
    expect(authSessionService.persistTokens).toHaveBeenCalledWith(
      7,
      {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      },
      {
        ip: '127.0.0.1',
      },
    )
    expect(userCoreService.getUserGrowthSnapshot).toHaveBeenCalledWith(7)
  })
})
