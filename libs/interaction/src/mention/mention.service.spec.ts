import { BadRequestException } from '@nestjs/common'
import { EmojiSceneEnum } from '../emoji/emoji.constant'
import { MentionService } from './mention.service'

describe('mentionService', () => {
  function createService() {
    const drizzle = {
      db: {},
      schema: {
        userMention: {},
        appUser: {},
      },
    }

    const emojiParserService = {
      parse: jest.fn(async ({ body }: { body: string }) => {
        if (body === '欢迎 ') {
          return [{ type: 'text', text: '欢迎 ' }]
        }
        if (body === ' 一起😀') {
          return [
            { type: 'text', text: ' 一起' },
            { type: 'emojiUnicode', unicodeSequence: '😀' },
          ]
        }
        return body ? [{ type: 'text', text: body }] : []
      }),
    }

    const userService = {
      findAvailableUsersByIds: jest.fn(),
    }

    const messageDomainEventPublisher = {
      publishInTx: jest.fn(),
    }

    const messageDomainEventFactoryService = {
      buildCommentMentionEvent: jest.fn(),
      buildTopicMentionEvent: jest.fn(),
    }

    const service = new MentionService(
      drizzle as never,
      emojiParserService as never,
      userService as never,
      messageDomainEventPublisher as never,
      messageDomainEventFactoryService as never,
    )

    return {
      service,
      emojiParserService,
    }
  }

  it('buildBodyTokens 会把提及片段构造成 mentionUser token', async () => {
    const { service, emojiParserService } = createService()

    const tokens = await service.buildBodyTokens({
      content: '欢迎 @测试 一起😀',
      mentions: [
        {
          userId: 9,
          nickname: '测试',
          start: 3,
          end: 6,
        },
      ],
      scene: EmojiSceneEnum.FORUM,
    })

    expect(emojiParserService.parse).toHaveBeenNthCalledWith(1, {
      body: '欢迎 ',
      scene: EmojiSceneEnum.FORUM,
    })
    expect(emojiParserService.parse).toHaveBeenNthCalledWith(2, {
      body: ' 一起😀',
      scene: EmojiSceneEnum.FORUM,
    })
    expect(tokens).toEqual([
      { type: 'text', text: '欢迎 ' },
      {
        type: 'mentionUser',
        userId: 9,
        nickname: '测试',
        text: '@测试',
      },
      { type: 'text', text: ' 一起' },
      { type: 'emojiUnicode', unicodeSequence: '😀' },
    ])
  })

  it('buildBodyTokens 会拒绝与正文切片不一致的提及范围', async () => {
    const { service } = createService()

    await expect(
      service.buildBodyTokens({
        content: '欢迎 @测试',
        mentions: [
          {
            userId: 9,
            nickname: '其他人',
            start: 3,
            end: 6,
          },
        ],
        scene: EmojiSceneEnum.FORUM,
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })
})
