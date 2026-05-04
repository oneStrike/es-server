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
    const tokenSchemaRefs = metadata?.items?.oneOf?.map((item) => item.$ref)
    expect(tokenSchemaRefs).toEqual([
      '#/components/schemas/ChatMessageBodyTextTokenDto',
      '#/components/schemas/ChatMessageBodyEmojiUnicodeTokenDto',
      '#/components/schemas/ChatMessageBodyEmojiCustomTokenDto',
    ])
    expect(tokenSchemaRefs).not.toContain(
      '#/components/schemas/ChatMessageBodyMentionUserTokenDto',
    )
    expect(tokenSchemaRefs).not.toContain(
      '#/components/schemas/ChatMessageBodyForumHashtagTokenDto',
    )
  })

  it('documents send messageType as client-sendable subset only', () => {
    const originalNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    jest.resetModules()

    const { SendChatMessageDto, BaseChatMessageDto } = require('./chat.dto')
    const sendMetadata = Reflect.getMetadata(
      DECORATORS.API_MODEL_PROPERTIES,
      SendChatMessageDto.prototype,
      'messageType',
    ) as { enum?: Record<string, number | string> } | undefined
    const baseMetadata = Reflect.getMetadata(
      DECORATORS.API_MODEL_PROPERTIES,
      BaseChatMessageDto.prototype,
      'messageType',
    ) as { enum?: Record<string, number | string> } | undefined

    process.env.NODE_ENV = originalNodeEnv

    const sendValues = Object.values(sendMetadata?.enum ?? {}).filter(
      (item): item is number => typeof item === 'number',
    )
    const baseValues = Object.values(baseMetadata?.enum ?? {}).filter(
      (item): item is number => typeof item === 'number',
    )
    expect(sendValues).toEqual([1, 2, 3, 4])
    expect(sendValues).not.toContain(99)
    expect(baseValues).toEqual([1, 2, 3, 4, 99])
  })

  it('documents send and output payloads as media DTO anyOf plus text object fallback', () => {
    const originalNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    jest.resetModules()

    const { SendChatMessageDto, BaseChatMessageDto } = require('./chat.dto')
    const sendMetadata = Reflect.getMetadata(
      DECORATORS.API_MODEL_PROPERTIES,
      SendChatMessageDto.prototype,
      'payload',
    ) as
      | {
          description?: string
          anyOf?: Array<{ $ref?: string; type?: string }>
          required?: boolean
        }
      | undefined
    const baseMetadata = Reflect.getMetadata(
      DECORATORS.API_MODEL_PROPERTIES,
      BaseChatMessageDto.prototype,
      'payload',
    ) as
      | {
          description?: string
          anyOf?: Array<{ $ref?: string; type?: string }>
          required?: boolean
        }
      | undefined
    const sendExtraModels = Reflect.getMetadata(
      DECORATORS.API_EXTRA_MODELS,
      SendChatMessageDto,
    ) as Function[] | undefined
    const baseExtraModels = Reflect.getMetadata(
      DECORATORS.API_EXTRA_MODELS,
      BaseChatMessageDto,
    ) as Function[] | undefined

    process.env.NODE_ENV = originalNodeEnv

    const expectedRefs = [
      '#/components/schemas/ImageChatMessagePayloadDto',
      '#/components/schemas/VoiceChatMessagePayloadDto',
      '#/components/schemas/VideoChatMessagePayloadDto',
    ]
    expect(sendMetadata?.required).toBe(false)
    expect(sendMetadata?.description).toContain('scene=chat')
    expect(sendMetadata?.anyOf?.[0]).toMatchObject({ type: 'object' })
    expect(sendMetadata?.anyOf?.slice(1).map((item) => item.$ref)).toEqual(
      expectedRefs,
    )
    expect(baseMetadata?.required).toBe(false)
    expect(baseMetadata?.description).toContain('文本/系统消息')
    expect(baseMetadata?.anyOf?.[0]).toMatchObject({ type: 'object' })
    expect(baseMetadata?.anyOf?.slice(1).map((item) => item.$ref)).toEqual(
      expectedRefs,
    )
    expect(sendExtraModels?.map((item) => item.name)).toEqual([
      'ImageChatMessagePayloadDto',
      'VoiceChatMessagePayloadDto',
      'VideoChatMessagePayloadDto',
    ])
    expect(baseExtraModels?.map((item) => item.name)).toEqual(
      expect.arrayContaining([
        'ImageChatMessagePayloadDto',
        'VoiceChatMessagePayloadDto',
        'VideoChatMessagePayloadDto',
      ]),
    )
  })
})
