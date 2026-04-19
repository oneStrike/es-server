import { UserService } from './user.service'

const EXPECTED_NOTIFICATION_UNREAD = {
  total: 3,
  byCategory: {
    comment_reply: 2,
    comment_mention: 0,
    comment_like: 0,
    topic_like: 1,
    topic_favorited: 0,
    topic_commented: 0,
    topic_mentioned: 0,
    user_followed: 0,
    system_announcement: 0,
    task_reminder: 0,
  },
} as const

describe('user service', () => {
  it('maps getUserCenter message summary to notificationUnread without the legacy flat field', async () => {
    const service = new UserService(
      {} as never,
      {
        ensureUserExists: jest.fn().mockResolvedValue({
          id: 7,
          account: 'tester',
          phoneNumber: null,
          nickname: 'tester',
          avatarUrl: null,
          emailAddress: null,
          genderType: 1,
          birthDate: null,
          levelId: null,
          signature: null,
          bio: null,
          status: 1,
          banReason: null,
          banUntil: null,
        }),
        getUserGrowthSnapshot: jest.fn().mockResolvedValue({
          points: 10,
          experience: 20,
        }),
        getUserCounts: jest.fn().mockResolvedValue({}),
        getBadgeCount: jest.fn().mockResolvedValue(0),
      } as never,
      {} as never,
      {
        getUserAssetsSummary: jest.fn(),
      } as never,
      {} as never,
      {} as never,
      {
        getUserTaskSummary: jest.fn().mockResolvedValue({}),
      } as never,
      {
        getSummary: jest.fn().mockResolvedValue({
          notificationUnread: EXPECTED_NOTIFICATION_UNREAD,
          chatUnreadCount: 5,
          totalUnreadCount: 8,
        }),
      } as never,
    )

    const getUserAssetsSummarySpy = jest
      .spyOn(
        service as unknown as {
          getUserAssetsSummary: (userId: number) => Promise<unknown>
        },
        'getUserAssetsSummary',
      )
      .mockResolvedValue({})

    const result = await service.getUserCenter(7)

    expect(result.message).toEqual({
      notificationUnread: EXPECTED_NOTIFICATION_UNREAD,
      totalUnreadCount: 8,
    })
    expect(result.message).not.toHaveProperty('notificationUnreadCount')
    expect(getUserAssetsSummarySpy).toHaveBeenCalledWith(7)
  })
})
