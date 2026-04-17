import type { DrizzleService } from '@db/core'
import { AppUserQueryService } from './app-user-query.service'

function createDrizzleStub() {
  const selectChain = {
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockResolvedValue([]),
  }

  return {
    db: {
      select: jest.fn().mockReturnValue(selectChain),
    },
    schema: {
      appUser: {
        id: 'id',
        account: 'account',
        phoneNumber: 'phoneNumber',
        nickname: 'nickname',
        emailAddress: 'emailAddress',
        isEnabled: 'isEnabled',
        status: 'status',
        levelId: 'levelId',
        deletedAt: 'deletedAt',
        lastLoginAt: 'lastLoginAt',
      },
      adminUser: {
        role: 'role',
      },
      appUserCount: {
        userId: 'userId',
        commentCount: 'commentCount',
        likeCount: 'likeCount',
        favoriteCount: 'favoriteCount',
        followingUserCount: 'followingUserCount',
        followingAuthorCount: 'followingAuthorCount',
        followingSectionCount: 'followingSectionCount',
        followersCount: 'followersCount',
        forumTopicCount: 'forumTopicCount',
        commentReceivedLikeCount: 'commentReceivedLikeCount',
        forumTopicReceivedLikeCount: 'forumTopicReceivedLikeCount',
        forumTopicReceivedFavoriteCount: 'forumTopicReceivedFavoriteCount',
      },
      userLevelRule: {
        id: 'id',
        name: 'name',
      },
      growthLedgerRecord: {},
      userBadgeAssignment: {},
      userBadge: {},
    },
    ext: {
      findPagination: jest.fn().mockResolvedValue({
        list: [
          {
            id: 7,
            account: '700001',
            phoneNumber: null,
            emailAddress: null,
            levelId: null,
            nickname: '测试用户',
            avatarUrl: null,
            signature: null,
            bio: null,
            isEnabled: true,
            genderType: 0,
            birthDate: null,
            status: 1,
            banReason: null,
            banUntil: null,
            lastLoginAt: null,
            lastLoginIp: null,
            createdAt: new Date('2026-04-18T00:00:00.000Z'),
            updatedAt: new Date('2026-04-18T00:00:00.000Z'),
            deletedAt: null,
          },
        ],
        total: 1,
        pageIndex: 1,
        pageSize: 20,
      }),
    },
    buildPage: jest.fn(),
  } as unknown as DrizzleService
}

describe('appUserQueryService', () => {
  it('loads user growth snapshots in one batch when building the page', async () => {
    const drizzle = createDrizzleStub()
    const userCoreService = {
      mapBaseUser: jest.fn().mockImplementation((user, growth) => ({
        id: user.id,
        nickname: user.nickname,
        points: growth?.points ?? 0,
        experience: growth?.experience ?? 0,
      })),
      getUserGrowthSnapshot: jest.fn(),
    }
    const growthBalanceQueryService = {
      getUserGrowthSnapshotMap: jest.fn().mockResolvedValue(
        new Map([
          [
            7,
            {
              points: 18,
              experience: 31,
            },
          ],
        ]),
      ),
    }

    const service = new AppUserQueryService(
      drizzle,
      userCoreService as never,
      growthBalanceQueryService as never,
      {} as never,
    )

    const result = await service.getAppUserPage({
      pageIndex: 1,
      pageSize: 20,
    } as never)

    expect(growthBalanceQueryService.getUserGrowthSnapshotMap).toHaveBeenCalledTimes(1)
    expect(growthBalanceQueryService.getUserGrowthSnapshotMap).toHaveBeenCalledWith([7])
    expect(userCoreService.getUserGrowthSnapshot).not.toHaveBeenCalled()
    expect(userCoreService.mapBaseUser).toHaveBeenCalledWith(
      expect.objectContaining({ id: 7 }),
      { points: 18, experience: 31 },
    )
    expect(result.list[0]).toEqual(
      expect.objectContaining({
        id: 7,
        points: 18,
        experience: 31,
      }),
    )
  })
})
