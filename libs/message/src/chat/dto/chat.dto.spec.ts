import 'reflect-metadata'
import { DECORATORS } from '@nestjs/swagger/dist/constants'

describe('chat dto body token contract', () => {
  it('documents message bodyTokens as an explicit token union', () => {
    const originalNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    jest.resetModules()

    const { BaseChatMessageDto } = require('./chat.dto')
    const metadata = Reflect.getMetadata(
      DECORATORS.API_MODEL_PROPERTIES,
      BaseChatMessageDto.prototype,
      'bodyTokens',
    ) as
      | {
          description?: string
          items?: {
            oneOf?: Array<{ $ref?: string }>
          }
          required?: boolean
          type?: string
        }
      | undefined

    process.env.NODE_ENV = originalNodeEnv

    expect(metadata?.required).toBe(false)
    expect(metadata?.type).toBe('array')
    expect(metadata?.description).toContain('消息正文语义 token')
    expect(metadata?.items?.oneOf?.map((item) => item.$ref)).toEqual([
      '#/components/schemas/ChatMessageBodyTextTokenDto',
      '#/components/schemas/ChatMessageBodyMentionUserTokenDto',
      '#/components/schemas/ChatMessageBodyEmojiUnicodeTokenDto',
      '#/components/schemas/ChatMessageBodyEmojiCustomTokenDto',
      '#/components/schemas/ChatMessageBodyForumHashtagTokenDto',
    ])
  })
})
