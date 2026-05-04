import { BadRequestException } from '@nestjs/common'
import { UploadConfig } from '@libs/platform/config'
import { UploadProviderEnum } from '@libs/platform/modules/upload/upload.type'
import {
  assertChatMessageSendInput,
  normalizeChatMessageSendInput,
} from './chat-message-boundary'
import { buildChatMediaOriginPolicy } from './chat-media-origin-policy'
import { ChatMessageTypeEnum, ChatSendMessageTypeEnum } from './chat.constant'

const originPolicy = buildChatMediaOriginPolicy({
  uploadConfig: UploadConfig,
  systemUploadConfig: {
    provider: UploadProviderEnum.QINIU,
    superbedNonImageFallbackToLocal: true,
    qiniu: {
      accessKey: 'ak',
      secretKey: 'sk',
      bucket: 'bucket',
      domain: 'cdn.example.com',
      region: 'z0',
      pathPrefix: 'uploads',
      useHttps: true,
      tokenExpires: 3600,
    },
    superbed: {
      token: '',
      categories: '',
    },
  },
})

const validImagePayload = {
  filePath: '/files/chat/image/2026-05-04/photo.png',
  fileCategory: 'image',
  mimeType: 'image/png',
  fileSize: 1024,
  width: 1200,
  height: 800,
  originalName: 'photo.png',
}

const validVoicePayload = {
  filePath: '/files/chat/audio/2026-05-04/voice.mp3',
  fileCategory: 'audio',
  mimeType: 'audio/mpeg',
  fileSize: 2048,
  durationSeconds: 12.5,
  originalName: 'voice.mp3',
}

const validVideoPayload = {
  filePath: '/files/chat/video/2026-05-04/clip.mp4',
  fileCategory: 'video',
  mimeType: 'video/mp4',
  fileSize: 4096,
  durationSeconds: 30,
  width: 1920,
  height: 1080,
  originalName: 'clip.mp4',
}

describe('chat message send boundary', () => {
  it('accepts text content and object-only payloads', () => {
    const result = assertChatMessageSendInput(
      {
        conversationId: 10,
        messageType: ChatSendMessageTypeEnum.TEXT,
        content: '  hello  ',
        payload: { trace: 'ok' },
      },
      originPolicy,
    )

    expect(result).toEqual({
      conversationId: 10,
      messageType: ChatSendMessageTypeEnum.TEXT,
      content: 'hello',
      payload: { trace: 'ok' },
    })
  })

  it.each([
    ['missing content', { content: undefined }],
    ['blank content', { content: '   ' }],
    ['string payload', { payload: '{"trace":"ok"}' }],
    ['array payload', { payload: [] }],
    ['scalar payload', { payload: 1 }],
    ['null payload', { payload: null }],
    ['Date payload', { payload: new Date('2026-05-04T00:00:00.000Z') }],
  ])('rejects invalid text %s', (_label, override) => {
    expect(() =>
      assertChatMessageSendInput(
        {
          conversationId: 10,
          messageType: ChatSendMessageTypeEnum.TEXT,
          content: 'hello',
          ...override,
        },
        originPolicy,
      ),
    ).toThrow(BadRequestException)
  })

  it.each([
    [ChatSendMessageTypeEnum.IMAGE, validImagePayload],
    [ChatSendMessageTypeEnum.VOICE, validVoicePayload],
    [ChatSendMessageTypeEnum.VIDEO, validVideoPayload],
  ])(
    'accepts media messageType=%s and normalizes missing content',
    (messageType, payload) => {
      const result = assertChatMessageSendInput(
        {
          conversationId: 10,
          messageType,
          payload,
        },
        originPolicy,
      )

      expect(result).toMatchObject({
        conversationId: 10,
        messageType,
        content: '',
        payload,
      })
    },
  )

  it('accepts qiniu provider URLs only when domain and pathPrefix match', () => {
    const result = assertChatMessageSendInput(
      {
        conversationId: 10,
        messageType: ChatSendMessageTypeEnum.IMAGE,
        payload: {
          ...validImagePayload,
          filePath:
            'https://cdn.example.com/uploads/chat/image/2026-05-04/a.png',
        },
      },
      originPolicy,
    )

    expect(result.payload).toMatchObject({
      filePath: 'https://cdn.example.com/uploads/chat/image/2026-05-04/a.png',
    })
  })

  it.each([
    ['SYSTEM messageType', { messageType: ChatMessageTypeEnum.SYSTEM }],
    [
      'stringified media payload',
      { payload: JSON.stringify(validImagePayload) },
    ],
    ['unknown field', { payload: { ...validImagePayload, foo: 'bar' } }],
    [
      'clientMessageId inside payload',
      { payload: { ...validImagePayload, clientMessageId: 'c1' } },
    ],
    [
      'shared scene',
      {
        payload: {
          ...validImagePayload,
          filePath: '/files/shared/image/2026-05-04/a.png',
        },
      },
    ],
    [
      'other scene',
      {
        payload: {
          ...validImagePayload,
          filePath: '/files/forum/image/2026-05-04/a.png',
        },
      },
    ],
    [
      'provider missing pathPrefix',
      {
        payload: {
          ...validImagePayload,
          filePath: 'https://cdn.example.com/chat/image/2026-05-04/a.png',
        },
      },
    ],
    [
      'external URL',
      {
        payload: {
          ...validImagePayload,
          filePath: 'https://evil.example.com/uploads/chat/image/a.png',
        },
      },
    ],
    [
      'external URL with local prefix path',
      {
        payload: {
          ...validImagePayload,
          filePath:
            'https://evil.example.com/files/chat/image/2026-05-04/a.png',
        },
      },
    ],
    [
      'data URL',
      {
        payload: {
          ...validImagePayload,
          filePath: 'data:image/png;base64,abc',
        },
      },
    ],
    [
      'traversal path',
      {
        payload: {
          ...validImagePayload,
          filePath: '/files/chat/image/../a.png',
        },
      },
    ],
    [
      'encoded traversal path',
      {
        payload: {
          ...validImagePayload,
          filePath: '/files/chat/image/%2e%2e/a.png',
        },
      },
    ],
    [
      'category mismatch',
      {
        payload: {
          ...validImagePayload,
          filePath: '/files/chat/audio/2026-05-04/a.png',
        },
      },
    ],
    [
      'extension mismatch',
      {
        payload: {
          ...validImagePayload,
          filePath: '/files/chat/image/2026-05-04/a.mp3',
        },
      },
    ],
    [
      'mime mismatch',
      { payload: { ...validImagePayload, mimeType: 'audio/mpeg' } },
    ],
    [
      'missing voice duration',
      {
        messageType: ChatSendMessageTypeEnum.VOICE,
        payload: { ...validVoicePayload, durationSeconds: undefined },
      },
    ],
  ])('rejects invalid media %s', (_label, override) => {
    const result = normalizeChatMessageSendInput(
      {
        conversationId: 10,
        messageType: ChatSendMessageTypeEnum.IMAGE,
        content: null,
        payload: validImagePayload,
        ...override,
      },
      originPolicy,
    )

    expect(result.ok).toBe(false)
  })
})
