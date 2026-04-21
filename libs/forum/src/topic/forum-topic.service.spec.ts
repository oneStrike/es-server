import { ForumTopicService } from './forum-topic.service'

describe('forumTopicService helpers', () => {
  function createService() {
    return new ForumTopicService(
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
  }

  it('uses the explicit title when deriving the create title', () => {
    const service = createService()

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
    const service = createService()

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

  it('derives the title from html rich text content when title is missing', () => {
    const service = createService()
    const content =
      '  <p>欢迎来到<strong>论坛</strong></p><p>&nbsp;一起交流 TypeScript 经验</p>  '

    const title = (
      service as unknown as {
        resolveCreateTopicTitle: (
          title: string | undefined,
          content: string,
        ) => string
      }
    ).resolveCreateTopicTitle(undefined, content)

    expect(title).toBe('欢迎来到论坛 一起交流 TypeScript 经验')
  })

  it('derives the title from json rich text content when title is missing', () => {
    const service = createService()
    const content = JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: '富文本标题回退',
            },
            {
              type: 'text',
              text: '需要提纯正文',
            },
          ],
        },
      ],
    })

    const title = (
      service as unknown as {
        resolveCreateTopicTitle: (
          title: string | undefined,
          content: string,
        ) => string
      }
    ).resolveCreateTopicTitle(undefined, content)

    expect(title).toBe('富文本标题回退需要提纯正文')
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

  it('overwrites videos with the provided json value when normalizing topic media', () => {
    const service = createService()
    const videos = {
      list: [
        {
          url: 'https://cdn.example.com/forum/topic-2.mp4',
          poster: 'https://cdn.example.com/forum/topic-2.jpg',
          duration: 12,
        },
      ],
      layout: 'grid',
    }

    const media = (
      service as unknown as {
        normalizeTopicMedia: (
          media: {
            images?: string[]
            videos?: unknown
          },
          fallback?: {
            images: string[]
            videos: unknown
          },
        ) => {
          images: string[]
          videos: unknown
        }
      }
    ).normalizeTopicMedia(
      { videos },
      {
        images: ['/files/forum/topic-image.png'],
        videos: ['https://cdn.example.com/forum/legacy-topic.mp4'],
      },
    )

    expect(media.images).toEqual(['/files/forum/topic-image.png'])
    expect(media.videos).toEqual(videos)
  })
})
