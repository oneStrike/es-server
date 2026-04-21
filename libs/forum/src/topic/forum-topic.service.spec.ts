import { ForumTopicService } from './forum-topic.service'

describe('ForumTopicService sensitive-word detection', () => {
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
