import { ForumTopicService } from './forum-topic.service'

describe('ForumTopicService helpers', () => {
  it('uses the explicit title when deriving the create title', () => {
    const service = new ForumTopicService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    )

    const title = (
      service as unknown as {
        resolveCreateTopicTitle: (
          title: string | undefined,
          content: string,
        ) => string
      }
    ).resolveCreateTopicTitle('  自定义标题  ', '这里是正文')

    expect(title).toBe('自定义标题')
  })

  it('falls back to the first 30 characters of content when title is missing', () => {
    const service = new ForumTopicService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    )

    const content =
      '  这是一个没有单独标题时用于自动生成标题的正文内容示例，用来验证只截取前三十个字符  '
    const title = (
      service as unknown as {
        resolveCreateTopicTitle: (
          title: string | undefined,
          content: string,
        ) => string
      }
    ).resolveCreateTopicTitle(undefined, content)

    expect(title).toBe(content.trim().slice(0, 30))
  })

  it('splits title and content detection instead of concatenating them', () => {
    const sensitiveWordDetectService = {
      getMatchedWordsWithMetadataBySegments: jest.fn().mockReturnValue({
        hits: [],
        publicHits: [],
      }),
    }
    const service = new ForumTopicService(
      {} as never,
      {} as never,
      {} as never,
      sensitiveWordDetectService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    )

    ;(
      service as unknown as {
        detectTopicSensitiveWords: (
          title: string,
          content: string,
        ) => { publicHits: unknown[] }
      }
    ).detectTopicSensitiveWords('标题', '正文')

    expect(
      sensitiveWordDetectService.getMatchedWordsWithMetadataBySegments,
    ).toHaveBeenCalledWith([
      { field: 'title', content: '标题' },
      { field: 'content', content: '正文' },
    ])
  })
})
