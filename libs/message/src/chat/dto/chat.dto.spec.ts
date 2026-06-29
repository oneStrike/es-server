import 'reflect-metadata'

const SWAGGER_API_EXTRA_MODELS = 'swagger/apiExtraModels'
const SWAGGER_API_MODEL_PROPERTIES = 'swagger/apiModelProperties'

function swaggerPropertyMetadata(target: object, propertyKey: string) {
  return Reflect.getMetadata(
    SWAGGER_API_MODEL_PROPERTIES,
    target,
    propertyKey,
  ) as Record<string, unknown>
}

function swaggerExtraModels(target: Function) {
  return Reflect.getMetadata(SWAGGER_API_EXTRA_MODELS, target) as Function[]
}

describe('BaseChatMessageDto swagger contract', () => {
  const originalNodeEnv = process.env.NODE_ENV

  beforeAll(() => {
    process.env.NODE_ENV = 'development'
  })

  afterAll(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV
    } else {
      process.env.NODE_ENV = originalNodeEnv
    }
  })

  it('documents payload as nullable anyOf over JSON and media payload DTOs', () => {
    jest.isolateModules(() => {
      const {
        BaseChatMessageDto,
        ImageChatMessagePayloadDto,
        VideoChatMessagePayloadDto,
        VoiceChatMessagePayloadDto,
      } = require('./chat.dto')

      expect(
        swaggerPropertyMetadata(BaseChatMessageDto.prototype, 'payload'),
      ).toMatchObject({
        required: true,
        nullable: true,
        anyOf: [
          { type: 'object', additionalProperties: true },
          { $ref: '#/components/schemas/ImageChatMessagePayloadDto' },
          { $ref: '#/components/schemas/VoiceChatMessagePayloadDto' },
          { $ref: '#/components/schemas/VideoChatMessagePayloadDto' },
        ],
      })

      expect(swaggerExtraModels(BaseChatMessageDto)).toEqual(
        expect.arrayContaining([
          ImageChatMessagePayloadDto,
          VoiceChatMessagePayloadDto,
          VideoChatMessagePayloadDto,
        ]),
      )
    })
  })

  it('documents bodyTokens as a nullable array whose items are a token oneOf', () => {
    jest.isolateModules(() => {
      const {
        BaseChatMessageDto,
        ChatMessageBodyEmojiCustomTokenDto,
        ChatMessageBodyEmojiUnicodeTokenDto,
        ChatMessageBodyTextTokenDto,
      } = require('./chat.dto')

      expect(
        swaggerPropertyMetadata(BaseChatMessageDto.prototype, 'bodyTokens'),
      ).toMatchObject({
        type: 'array',
        required: true,
        nullable: true,
        items: {
          oneOf: [
            { $ref: '#/components/schemas/ChatMessageBodyTextTokenDto' },
            {
              $ref: '#/components/schemas/ChatMessageBodyEmojiUnicodeTokenDto',
            },
            { $ref: '#/components/schemas/ChatMessageBodyEmojiCustomTokenDto' },
          ],
        },
      })

      expect(swaggerExtraModels(BaseChatMessageDto)).toEqual(
        expect.arrayContaining([
          ChatMessageBodyTextTokenDto,
          ChatMessageBodyEmojiUnicodeTokenDto,
          ChatMessageBodyEmojiCustomTokenDto,
        ]),
      )
    })
  })
})
