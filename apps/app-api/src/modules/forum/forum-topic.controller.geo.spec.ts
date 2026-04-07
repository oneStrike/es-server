jest.mock('@libs/forum/profile/profile.service', () => ({
  UserProfileService: class {},
}))

jest.mock('@libs/forum/topic/dto/forum-topic.dto', () =>
  new Proxy({}, { get: () => class {} }))

jest.mock('@libs/forum/topic/forum-topic.service', () => ({
  ForumTopicService: class {},
}))

jest.mock('@libs/interaction/comment/comment.service', () => ({
  CommentService: class {},
}))

jest.mock('@libs/interaction/comment/dto/comment.dto', () =>
  new Proxy({}, { get: () => class {} }))

jest.mock('@libs/platform/decorators/api-doc.decorator', () => ({
  ApiDoc: () => () => undefined,
  ApiPageDoc: () => () => undefined,
}))

jest.mock('@libs/platform/decorators/current-user.decorator', () => ({
  CurrentUser: () => () => undefined,
}))

jest.mock('@libs/platform/decorators/public.decorator', () => ({
  OptionalAuth: () => () => undefined,
}))

jest.mock('@libs/platform/dto/base.dto', () => ({
  IdDto: class {},
}))

jest.mock('@libs/platform/modules/geo', () => ({
  GeoService: class {},
}))

describe('app forum topic controller geo write context', () => {
  it('passes geo context to create, update, and delete write paths', async () => {
    const { ForumTopicController } = await import('./forum-topic.controller')

    const forumTopicService = {
      createForumTopic: jest.fn().mockResolvedValue(true),
      updateUserTopic: jest.fn().mockResolvedValue(true),
      deleteUserTopic: jest.fn().mockResolvedValue(true),
    }
    const geoContext = {
      ip: '1.2.3.4',
      userAgent: 'Mozilla/5.0',
      deviceInfo: {
        device: 'Desktop',
      },
      geoCountry: '中国',
      geoProvince: '广东省',
      geoCity: '深圳市',
      geoIsp: '电信',
      geoSource: 'ip2region',
    }
    const buildClientRequestContext = jest.fn().mockResolvedValue(geoContext)

    const controller = new ForumTopicController(
      forumTopicService as any,
      { getMyTopics: jest.fn() } as any,
      { getTargetComments: jest.fn() } as any,
      {
        buildClientRequestContext,
      } as any,
    )

    await controller.create({ sectionId: 9, title: '标题', content: '内容' } as any, 7, {} as any)
    await controller.update({ id: 12, title: '新标题', content: '新内容' } as any, 7, {} as any)
    await controller.delete({ id: 12 } as any, 7, {} as any)

    expect(buildClientRequestContext).toHaveBeenCalledTimes(3)
    expect(forumTopicService.createForumTopic).toHaveBeenCalledWith(
      { sectionId: 9, title: '标题', content: '内容', userId: 7 },
      expect.objectContaining({
        ipAddress: '1.2.3.4',
        userAgent: 'Mozilla/5.0',
        geoCountry: '中国',
        geoSource: 'ip2region',
      }),
    )
    expect(forumTopicService.updateUserTopic).toHaveBeenCalledWith(
      7,
      { id: 12, title: '新标题', content: '新内容' },
      expect.objectContaining({
        ipAddress: '1.2.3.4',
        userAgent: 'Mozilla/5.0',
        geoCountry: '中国',
        geoSource: 'ip2region',
      }),
    )
    expect(forumTopicService.deleteUserTopic).toHaveBeenCalledWith(
      7,
      12,
      expect.objectContaining({
        ipAddress: '1.2.3.4',
        userAgent: 'Mozilla/5.0',
        geoCountry: '中国',
        geoSource: 'ip2region',
      }),
    )
  })
})
