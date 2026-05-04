import { GrowthRuleTypeEnum } from '@libs/growth/growth-rule.constant'
import { UserService } from './user.service'

describe('App UserService ledger record mapping', () => {
  function createService() {
    const userPointService = {
      getPointRecordPage: jest.fn(),
    }
    const userExperienceService = {
      getExperienceRecordPage: jest.fn(),
    }

    const service = new UserService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      userPointService as never,
      userExperienceService as never,
      {} as never,
      {} as never,
    )

    return {
      service,
      userPointService,
      userExperienceService,
    }
  }

  it('strips bizKey and context from point records while preserving remark', async () => {
    const { service, userPointService } = createService()
    userPointService.getPointRecordPage.mockResolvedValue({
      list: [
        {
          id: 1,
          userId: 7,
          ruleId: 10,
          ruleType: GrowthRuleTypeEnum.CREATE_TOPIC,
          targetType: 5,
          targetId: 99,
          points: 5,
          beforePoints: 10,
          afterPoints: 15,
          bizKey: 'growth:rule:1',
          remark: '发表帖子',
          context: { targetId: 99 },
          createdAt: new Date('2026-04-22T10:00:00.000Z'),
        },
      ],
      total: 1,
      pageIndex: 1,
      pageSize: 20,
      totalPages: 1,
    })

    const page = await service.getUserPointRecords(7, {
      pageIndex: 1,
      pageSize: 20,
    } as never)

    expect(page.list[0]).toEqual({
      id: 1,
      userId: 7,
      ruleId: 10,
      ruleType: GrowthRuleTypeEnum.CREATE_TOPIC,
      targetType: 5,
      targetId: 99,
      points: 5,
      beforePoints: 10,
      afterPoints: 15,
      remark: '发表帖子',
      createdAt: new Date('2026-04-22T10:00:00.000Z'),
    })
  })

  it('strips bizKey, context and updatedAt from experience records while preserving remark', async () => {
    const { service, userExperienceService } = createService()
    userExperienceService.getExperienceRecordPage.mockResolvedValue({
      list: [
        {
          id: 2,
          userId: 7,
          ruleId: 11,
          ruleType: GrowthRuleTypeEnum.COMIC_WORK_VIEW,
          targetType: 1,
          targetId: 8,
          experience: 12,
          beforeExperience: 100,
          afterExperience: 112,
          bizKey: 'growth:rule:100',
          remark: '浏览漫画作品',
          context: { targetId: 8 },
          createdAt: new Date('2026-04-22T10:00:00.000Z'),
          updatedAt: new Date('2026-04-22T11:00:00.000Z'),
        },
      ],
      total: 1,
      pageIndex: 1,
      pageSize: 20,
      totalPages: 1,
    })

    const page = await service.getUserExperienceRecords(7, {
      pageIndex: 1,
      pageSize: 20,
    } as never)

    expect(page.list[0]).toEqual({
      id: 2,
      userId: 7,
      ruleId: 11,
      ruleType: GrowthRuleTypeEnum.COMIC_WORK_VIEW,
      targetType: 1,
      targetId: 8,
      experience: 12,
      beforeExperience: 100,
      afterExperience: 112,
      remark: '浏览漫画作品',
      createdAt: new Date('2026-04-22T10:00:00.000Z'),
    })
  })
})

describe('App UserService profile background image contract', () => {
  function createUpdateChain() {
    const where = jest.fn().mockResolvedValue(undefined)
    const set = jest.fn().mockReturnValue({ where })
    const update = jest.fn().mockReturnValue({ set })

    return { set, update, where }
  }

  function createServiceForProfile(overrides?: {
    updateChain?: ReturnType<typeof createUpdateChain>
    user?: Record<string, unknown>
  }) {
    const updateChain = overrides?.updateChain ?? createUpdateChain()
    const user = {
      id: 7,
      account: 'user007',
      phoneNumber: '13800000000',
      nickname: '测试用户',
      avatarUrl: 'https://cdn.example.com/avatar.png',
      profileBackgroundImageUrl:
        'https://cdn.example.com/profile-background.png',
      emailAddress: 'user007@example.com',
      genderType: 1,
      birthDate: '2000-01-01',
      levelId: 3,
      signature: '保持更新',
      bio: '个人简介',
      status: 1,
      banReason: null,
      banUntil: null,
      ...overrides?.user,
    }
    const drizzle = {
      db: {
        update: updateChain.update,
      },
      schema: {
        appUser: {
          id: 'appUser.id',
        },
      },
      withErrorHandling: jest.fn(async (callback: () => Promise<unknown>) =>
        callback(),
      ),
      isUniqueViolation: jest.fn().mockReturnValue(false),
    }
    const userCoreService = {
      ensureUserExists: jest.fn().mockResolvedValue(user),
      getBadgeCount: jest.fn().mockResolvedValue(2),
      getLevelInfo: jest.fn().mockResolvedValue({
        id: 3,
        name: '新手',
        icon: 'https://cdn.example.com/level.png',
        color: '#1677ff',
      }),
      getUserCounts: jest.fn().mockResolvedValue({ commentCount: 1 }),
      getUserGrowthSnapshot: jest.fn().mockResolvedValue({
        points: 100,
        experience: 200,
      }),
    }
    const userAssetsService = {
      getUserAssetsSummary: jest.fn().mockResolvedValue({ favoriteCount: 4 }),
    }
    const taskService = {
      getUserTaskSummary: jest.fn().mockResolvedValue({ claimableCount: 1 }),
    }
    const messageInboxService = {
      getSummary: jest.fn().mockResolvedValue({
        notificationUnread: { total: 0 },
        totalUnreadCount: 0,
      }),
    }

    const service = new UserService(
      drizzle as never,
      userCoreService as never,
      {} as never,
      userAssetsService as never,
      {} as never,
      {} as never,
      taskService as never,
      messageInboxService as never,
    )

    return {
      service,
      updateChain,
      userCoreService,
    }
  }

  it('writes profileBackgroundImageUrl when updating my profile', async () => {
    const { service, updateChain } = createServiceForProfile()

    await service.updateUserProfile(7, {
      profileBackgroundImageUrl:
        'https://cdn.example.com/profile-background.png',
    } as never)

    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        profileBackgroundImageUrl:
          'https://cdn.example.com/profile-background.png',
      }),
    )
  })

  it('returns profileBackgroundImageUrl in the user center user section', async () => {
    const { service } = createServiceForProfile()

    const result = await service.getUserCenter(7)

    expect(result.user).toMatchObject({
      profileBackgroundImageUrl:
        'https://cdn.example.com/profile-background.png',
    })
    expect(result.profile).not.toHaveProperty('profileBackgroundImageUrl')
  })
})
