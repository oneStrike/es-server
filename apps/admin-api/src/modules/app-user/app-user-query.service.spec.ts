import { AppUserDeletedScopeEnum } from '@libs/user/app-user.constant'
import { AppUserQueryService } from './app-user-query.service'

describe('AppUserQueryService admin contract assembly', () => {
  function createQueryChain(rows: unknown[]) {
    return {
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue(rows),
    }
  }

  function createUser(overrides: Record<string, unknown> = {}) {
    return {
      id: 7,
      account: 'user007',
      phoneNumber: '13800000000',
      emailAddress: 'user007@example.com',
      levelId: 3,
      nickname: '测试用户',
      avatarUrl: 'https://cdn.example.com/avatar.png',
      signature: '保持更新',
      bio: '个人简介',
      isEnabled: true,
      genderType: 1,
      birthDate: '2000-01-01',
      status: 1,
      banReason: null,
      banUntil: null,
      lastLoginAt: new Date('2026-04-20T08:00:00.000Z'),
      lastLoginIp: '127.0.0.1',
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      updatedAt: new Date('2026-04-21T00:00:00.000Z'),
      deletedAt: null,
      ...overrides,
    }
  }

  function createService() {
    const appUserTable = {
      id: 'app_user.id',
      account: 'app_user.account',
      phoneNumber: 'app_user.phone_number',
      nickname: 'app_user.nickname',
      emailAddress: 'app_user.email_address',
      isEnabled: 'app_user.is_enabled',
      status: 'app_user.status',
      levelId: 'app_user.level_id',
      deletedAt: 'app_user.deleted_at',
      lastLoginAt: 'app_user.last_login_at',
    }
    const userLevelRuleTable = {
      id: 'user_level_rule.id',
      name: 'user_level_rule.name',
    }
    const appUserCountTable = {
      userId: 'app_user_count.user_id',
      commentCount: 'app_user_count.comment_count',
      likeCount: 'app_user_count.like_count',
      favoriteCount: 'app_user_count.favorite_count',
      followingUserCount: 'app_user_count.following_user_count',
      followingAuthorCount: 'app_user_count.following_author_count',
      followingSectionCount: 'app_user_count.following_section_count',
      followersCount: 'app_user_count.followers_count',
      forumTopicCount: 'app_user_count.forum_topic_count',
      commentReceivedLikeCount: 'app_user_count.comment_received_like_count',
      forumTopicReceivedLikeCount:
        'app_user_count.forum_topic_received_like_count',
      forumTopicReceivedFavoriteCount:
        'app_user_count.forum_topic_received_favorite_count',
    }
    const drizzle = {
      db: {
        select: jest.fn(),
      },
      ext: {
        findPagination: jest.fn(),
      },
      schema: {
        appUser: appUserTable,
        appUserCount: appUserCountTable,
        userLevelRule: userLevelRuleTable,
      },
    }
    const userCoreService = {
      ensureUserExists: jest.fn(),
      getBadgeCount: jest.fn(),
      getLevelInfo: jest.fn(),
      getUserCounts: jest.fn(),
      mapBaseUser: jest.fn(
        (
          user: Record<string, unknown>,
          growth?: { experience?: number; points?: number },
        ) => ({
          id: user.id,
          account: user.account,
          nickname: user.nickname,
          points: growth?.points ?? 0,
          experience: growth?.experience ?? 0,
        }),
      ),
    }
    const growthBalanceQueryService = {
      getUserGrowthSnapshot: jest.fn(),
      getUserGrowthSnapshotMap: jest.fn(),
    }
    const appUserGrowthService = {
      getAppUserExperienceStats: jest.fn(),
      getAppUserPointStats: jest.fn(),
    }

    const service = new AppUserQueryService(
      drizzle as never,
      userCoreService as never,
      growthBalanceQueryService as never,
      appUserGrowthService as never,
    )

    return {
      appUserGrowthService,
      drizzle,
      growthBalanceQueryService,
      service,
      userCoreService,
    }
  }

  it('adds admin-only deletedAt to page rows without changing shared base mapping', async () => {
    const { drizzle, growthBalanceQueryService, service, userCoreService } =
      createService()
    const deletedAt = new Date('2026-05-01T00:00:00.000Z')
    const deletedUser = createUser({ id: 7, deletedAt })
    const activeUser = createUser({ id: 8, deletedAt: null, levelId: null })

    drizzle.ext.findPagination.mockResolvedValue({
      list: [deletedUser, activeUser],
      pageIndex: 1,
      pageSize: 10,
      total: 2,
      totalPages: 1,
    })
    drizzle.db.select
      .mockReturnValueOnce(createQueryChain([{ id: 3, name: '新手' }]))
      .mockReturnValueOnce(
        createQueryChain([
          {
            userId: 7,
            commentCount: 1,
          },
          {
            userId: 8,
            commentCount: 2,
          },
        ]),
      )
    growthBalanceQueryService.getUserGrowthSnapshotMap.mockResolvedValue(
      new Map([
        [7, { points: 100, experience: 200 }],
        [8, { points: 0, experience: 10 }],
      ]),
    )

    const result = await service.getAppUserPage({
      deletedScope: AppUserDeletedScopeEnum.ALL,
      pageIndex: 1,
      pageSize: 10,
    })

    expect(result.list[0]).toMatchObject({
      id: 7,
      deletedAt,
      levelName: '新手',
    })
    expect(result.list[1]).toMatchObject({
      id: 8,
      deletedAt: undefined,
    })
    expect(userCoreService.mapBaseUser.mock.results[0]?.value).not.toHaveProperty(
      'deletedAt',
    )
  })

  it('keeps active detail on ensureUserExists and exposes only non-deleted detail data', async () => {
    const {
      appUserGrowthService,
      growthBalanceQueryService,
      service,
      userCoreService,
    } = createService()
    const user = createUser({ deletedAt: null })
    const pointStats = { currentPoints: 80, todayEarned: 5 }
    const experienceStats = {
      currentExperience: 120,
      todayEarned: 10,
      level: { id: 3, name: '新手', requiredExperience: 100 },
      nextLevel: { id: 4, name: '进阶', requiredExperience: 200 },
      gapToNextLevel: 80,
    }

    userCoreService.ensureUserExists.mockResolvedValue(user)
    userCoreService.getLevelInfo.mockResolvedValue({
      id: 3,
      name: '新手',
      requiredExperience: 100,
    })
    userCoreService.getUserCounts.mockResolvedValue({ commentCount: 3 })
    userCoreService.getBadgeCount.mockResolvedValue(2)
    growthBalanceQueryService.getUserGrowthSnapshot.mockResolvedValue({
      points: 80,
      experience: 120,
    })
    appUserGrowthService.getAppUserPointStats.mockResolvedValue(pointStats)
    appUserGrowthService.getAppUserExperienceStats.mockResolvedValue(
      experienceStats,
    )

    const result = await service.getAppUserDetail(7)

    expect(userCoreService.ensureUserExists).toHaveBeenCalledWith(7)
    expect(result).toMatchObject({
      id: 7,
      deletedAt: undefined,
      badgeCount: 2,
      pointStats,
      experienceStats,
    })
    expect(userCoreService.mapBaseUser.mock.results[0]?.value).not.toHaveProperty(
      'deletedAt',
    )
  })

  it('does not widen detail capability for deleted users', async () => {
    const {
      appUserGrowthService,
      growthBalanceQueryService,
      service,
      userCoreService,
    } = createService()

    userCoreService.ensureUserExists.mockRejectedValue(
      new Error('APP 用户不存在'),
    )

    await expect(service.getAppUserDetail(9)).rejects.toThrow('APP 用户不存在')
    expect(userCoreService.ensureUserExists).toHaveBeenCalledWith(9)
    expect(growthBalanceQueryService.getUserGrowthSnapshot).not.toHaveBeenCalled()
    expect(appUserGrowthService.getAppUserPointStats).not.toHaveBeenCalled()
    expect(appUserGrowthService.getAppUserExperienceStats).not.toHaveBeenCalled()
  })
})
