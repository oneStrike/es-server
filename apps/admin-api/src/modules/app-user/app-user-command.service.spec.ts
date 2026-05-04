import { AppUserCommandService } from './app-user-command.service'

class TestableAppUserCommandService extends AppUserCommandService {
  protected override async ensureSuperAdmin() {
    return undefined
  }

  protected override async generateUniqueAccount() {
    return 123456
  }
}

describe('AppUserCommandService profile background image writes', () => {
  function createSelectChain(defaultLevel = { id: 3 }) {
    return {
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([defaultLevel]),
    }
  }

  function createInsertChain() {
    const returning = jest.fn().mockResolvedValue([{ id: 7 }])
    const values = jest.fn().mockReturnValue({ returning })
    return { returning, values }
  }

  function createUpdateChain() {
    const where = jest.fn().mockResolvedValue(undefined)
    const set = jest.fn().mockReturnValue({ where })
    const update = jest.fn().mockReturnValue({ set })
    return { set, update, where }
  }

  function createService(overrides?: {
    insertChain?: ReturnType<typeof createInsertChain>
    updateChain?: ReturnType<typeof createUpdateChain>
  }) {
    const insertChain = overrides?.insertChain ?? createInsertChain()
    const updateChain = overrides?.updateChain ?? createUpdateChain()
    const tx = {
      insert: jest.fn().mockReturnValue({ values: insertChain.values }),
      select: jest.fn().mockReturnValue(createSelectChain()),
    }
    const drizzle = {
      db: {
        transaction: jest.fn(async (callback: (txArg: unknown) => unknown) =>
          callback(tx),
        ),
        update: updateChain.update,
      },
      schema: {
        appUser: {
          id: 'appUser.id',
        },
        userLevelRule: {
          id: 'userLevelRule.id',
          isEnabled: 'userLevelRule.isEnabled',
          sortOrder: 'userLevelRule.sortOrder',
        },
      },
      withErrorHandling: jest.fn(async (callback: () => Promise<unknown>) =>
        callback(),
      ),
      isUniqueViolation: jest.fn().mockReturnValue(false),
    }
    const userCoreService = {
      ensureUserExists: jest.fn().mockResolvedValue({ id: 7 }),
    }
    const appUserCountService = {
      initUserCounts: jest.fn().mockResolvedValue(undefined),
    }
    const service = new TestableAppUserCommandService(
      drizzle as never,
      userCoreService as never,
      appUserCountService as never,
      { decryptWith: jest.fn().mockReturnValue('plain-password') } as never,
      {
        encryptPassword: jest.fn().mockResolvedValue('hashed-password'),
      } as never,
      {} as never,
    )

    return {
      insertChain,
      service,
      updateChain,
    }
  }

  it('writes profileBackgroundImageUrl when creating an APP user', async () => {
    const { insertChain, service } = createService()

    await service.createAppUser(1, {
      nickname: '测试用户',
      password: 'cipher',
      profileBackgroundImageUrl:
        'https://cdn.example.com/profile-background.png',
    } as never)

    expect(insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        profileBackgroundImageUrl:
          'https://cdn.example.com/profile-background.png',
      }),
    )
  })

  it('writes profileBackgroundImageUrl when updating an APP user profile', async () => {
    const { service, updateChain } = createService()

    await service.updateAppUserProfile(1, {
      id: 7,
      profileBackgroundImageUrl:
        'https://cdn.example.com/profile-background.png',
    } as never)

    expect(updateChain.set).toHaveBeenCalledWith({
      profileBackgroundImageUrl:
        'https://cdn.example.com/profile-background.png',
    })
  })

  it('omits profileBackgroundImageUrl when updating without it', async () => {
    const { service, updateChain } = createService()

    await service.updateAppUserProfile(1, {
      id: 7,
      nickname: '新昵称',
    } as never)

    expect(updateChain.set).toHaveBeenCalledWith({
      nickname: '新昵称',
    })
  })
})
