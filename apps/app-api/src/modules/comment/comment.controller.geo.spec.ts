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

jest.mock('@libs/platform/dto/base.dto', () => ({
  IdDto: class {},
}))

jest.mock('@libs/platform/modules/geo', () => ({
  GeoService: class {},
}))

describe('comment controller geo write context', () => {
  it('passes geo context to post and reply write paths', async () => {
    const { CommentController } = await import('./comment.controller')

    const commentService = {
      createComment: jest.fn().mockResolvedValue({ id: 31 }),
      replyComment: jest.fn().mockResolvedValue({ id: 32 }),
    }
    const geoContext = {
      ip: '1.2.3.4',
      userAgent: 'Mozilla/5.0',
      geoCountry: '中国',
      geoProvince: '广东省',
      geoCity: '深圳市',
      geoIsp: '电信',
      geoSource: 'ip2region',
    }
    const buildClientRequestContext = jest.fn().mockResolvedValue(geoContext)

    const controller = new CommentController(
      commentService as any,
      {
        buildClientRequestContext,
      } as any,
    )

    await controller.postComment(
      {
        targetType: 1,
        targetId: 901,
        content: '评论内容',
      } as any,
      7,
      {} as any,
    )
    await controller.replyComment(
      {
        replyToId: 31,
        content: '回复内容',
      } as any,
      7,
      {} as any,
    )

    expect(buildClientRequestContext).toHaveBeenCalledTimes(2)
    expect(commentService.createComment).toHaveBeenCalledWith(
      {
        targetType: 1,
        targetId: 901,
        content: '评论内容',
        userId: 7,
      },
      geoContext,
    )
    expect(commentService.replyComment).toHaveBeenCalledWith(
      {
        replyToId: 31,
        content: '回复内容',
        userId: 7,
      },
      geoContext,
    )
  })
})
