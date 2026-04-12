import type { UserService as UserCoreService } from '@libs/user/user.service'
import { GenderEnum } from '@libs/platform/constant/profile.constant'
import { UserStatusEnum } from '@libs/user/app-user.constant'
import { UserService } from './user.service'

describe('app user service', () => {
  function createService() {
    const userCoreService = {
      ensureUserExists: jest.fn(),
      getUserCounts: jest.fn(),
      getBadgeCount: jest.fn(),
      getLevelInfo: jest.fn(),
      queryMentionCandidates: jest.fn(),
    } as unknown as jest.Mocked<UserCoreService>

    const taskService = {
      getUserTaskSummary: jest.fn(),
    } as const

    const messageInboxService = {
      getSummary: jest.fn(),
    } as const

    const service = new UserService(
      {} as never,
      userCoreService,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      taskService as never,
      messageInboxService as never,
    )

    return {
      service,
      userCoreService,
      taskService,
      messageInboxService,
    }
  }

  it('getUserCenter 只返回 UserCenterDto 定义的字段', async () => {
    const { service, userCoreService, taskService, messageInboxService } =
      createService()
    const banUntil = new Date('2026-03-08T10:00:00.000Z')

    userCoreService.ensureUserExists.mockResolvedValue({
      id: 1,
      account: 'user001',
      phoneNumber: '13800138000',
      nickname: '测试用户',
      avatarUrl: 'https://example.com/avatar.png',
      emailAddress: 'user@example.com',
      genderType: GenderEnum.MALE,
      birthDate: '2000-01-01',
      points: 120,
      experience: 350,
      levelId: 8,
      signature: '持续输出，永不停歇。',
      bio: '一段简短的自我介绍。',
      status: UserStatusEnum.NORMAL,
      banReason: '限制原因',
      banUntil,
    } as never)
    userCoreService.getUserCounts.mockResolvedValue({
      userId: 1,
      commentCount: 11,
      likeCount: 12,
      favoriteCount: 13,
      followingUserCount: 14,
      followingAuthorCount: 15,
      followingSectionCount: 16,
      followersCount: 17,
      forumTopicCount: 18,
      commentReceivedLikeCount: 19,
      forumTopicReceivedLikeCount: 20,
      forumTopicReceivedFavoriteCount: 21,
    })
    userCoreService.getBadgeCount.mockResolvedValue(3)
    userCoreService.getLevelInfo.mockResolvedValue({
      id: 8,
      name: '新手',
      requiredExperience: 300,
    })

    jest.spyOn(service, 'getUserAssetsSummary').mockResolvedValue({
      purchasedWorkCount: 1,
      purchasedChapterCount: 2,
      downloadedWorkCount: 3,
      downloadedChapterCount: 4,
      favoriteCount: 5,
      likeCount: 6,
      viewCount: 7,
      commentCount: 8,
      hiddenAssetCount: 999,
    } as never)
    messageInboxService.getSummary.mockResolvedValue({
      notificationUnreadCount: 9,
      chatUnreadCount: 10,
      totalUnreadCount: 19,
      latestNotification: {
        id: 1,
      },
    })
    taskService.getUserTaskSummary.mockResolvedValue({
      claimableCount: 22,
      claimedCount: 23,
      inProgressCount: 24,
      rewardPendingCount: 25,
      expiredCount: 26,
    })

    const result = await service.getUserCenter(1)

    expect(result).toEqual({
      user: {
        id: 1,
        account: 'user001',
        phoneNumber: '13800138000',
        nickname: '测试用户',
        avatarUrl: 'https://example.com/avatar.png',
        emailAddress: 'user@example.com',
        genderType: GenderEnum.MALE,
        birthDate: '2000-01-01',
      },
      growth: {
        points: 120,
        experience: 350,
        levelId: 8,
        levelName: '新手',
        badgeCount: 3,
      },
      profile: {
        signature: '持续输出，永不停歇。',
        bio: '一段简短的自我介绍。',
        status: UserStatusEnum.NORMAL,
        banReason: '限制原因',
        banUntil,
        counts: {
          commentCount: 11,
          likeCount: 12,
          favoriteCount: 13,
          followingUserCount: 14,
          followingAuthorCount: 15,
          followingSectionCount: 16,
          followersCount: 17,
          forumTopicCount: 18,
          commentReceivedLikeCount: 19,
          forumTopicReceivedLikeCount: 20,
          forumTopicReceivedFavoriteCount: 21,
        },
      },
      assets: {
        purchasedWorkCount: 1,
        purchasedChapterCount: 2,
        downloadedWorkCount: 3,
        downloadedChapterCount: 4,
        favoriteCount: 5,
        likeCount: 6,
        viewCount: 7,
        commentCount: 8,
      },
      message: {
        notificationUnreadCount: 9,
        totalUnreadCount: 19,
      },
      task: {
        claimableCount: 22,
        claimedCount: 23,
        inProgressCount: 24,
        rewardPendingCount: 25,
      },
    })
  })

  it('getMentionCandidates 只透传轻量候选参数并返回最小字段集', async () => {
    const { service, userCoreService } = createService()

    userCoreService.queryMentionCandidates.mockResolvedValue({
      list: [
        {
          id: 7,
          nickname: '测试用户',
          avatarUrl: 'https://example.com/avatar.png',
        },
      ],
      total: 1,
      pageIndex: 1,
      pageSize: 10,
      totalPages: 1,
    } as never)

    const result = await service.getMentionCandidates({
      q: '测试',
      pageIndex: 1,
      pageSize: 10,
    } as never)

    expect(userCoreService.queryMentionCandidates).toHaveBeenCalledWith({
      q: '测试',
      pageIndex: 1,
      pageSize: 10,
    })
    expect(result).toEqual({
      list: [
        {
          id: 7,
          nickname: '测试用户',
          avatarUrl: 'https://example.com/avatar.png',
        },
      ],
      total: 1,
      pageIndex: 1,
      pageSize: 10,
      totalPages: 1,
    })
  })
})
