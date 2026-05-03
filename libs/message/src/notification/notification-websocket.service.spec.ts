import type { IncomingMessage } from 'node:http'
import type { Socket } from 'socket.io'
import type { WebSocket } from 'ws'
import type {
  NativeWsRequestEnvelope,
  WsReadPayload,
  WsRequestEnvelope,
  WsSendPayload,
} from './notification-websocket.type'
import { BusinessErrorCode, PlatformErrorCode } from '@libs/platform/constant'
import { AuthErrorMessages } from '@libs/platform/modules/auth/helpers'
import { UserStatusEnum } from '@libs/user/app-user.constant'
import { JwtService } from '@nestjs/jwt'
import { ChatMessageTypeEnum } from '../chat/chat.constant'
import { MessageWsMonitorService } from '../monitor/ws-monitor.service'
import { MessageNativeWebSocketServer } from './notification-native-websocket.server'
import { MessageWebSocketService } from './notification-websocket.service'

interface NativeAuthResult {
  userId: number | null
  code?: number
  message: string
  shouldClose: boolean
}

interface NativeServerHarness {
  handleConnection(client: WebSocket, request: IncomingMessage): Promise<void>
  handleMessage(
    client: WebSocket,
    state: { userId: number | null },
    rawMessage: string,
  ): Promise<void>
}

function buildSocket(token = 'access-token') {
  return {
    handshake: {
      auth: { token },
      headers: {},
    },
  } as unknown as Socket
}

function buildNativeRequest(token?: string) {
  return {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  } as IncomingMessage
}

function buildSendEnvelope(
  overrides: Partial<WsRequestEnvelope<Partial<WsSendPayload>>> = {},
): WsRequestEnvelope<WsSendPayload> {
  const payload = {
    conversationId: 10,
    messageType: ChatMessageTypeEnum.TEXT,
    content: 'hello',
    ...(overrides.payload ?? {}),
  } as WsSendPayload

  return {
    requestId: overrides.requestId ?? 'req-1',
    timestamp: overrides.timestamp,
    payload,
  }
}

function buildReadEnvelope(
  overrides: Partial<WsRequestEnvelope<Partial<WsReadPayload>>> = {},
): WsRequestEnvelope<WsReadPayload> {
  const payload = {
    conversationId: 10,
    messageId: '100',
    ...(overrides.payload ?? {}),
  } as WsReadPayload

  return {
    requestId: overrides.requestId ?? 'req-1',
    timestamp: overrides.timestamp,
    payload,
  }
}

function createService() {
  const jwtService = {
    verifyAsync: jest.fn().mockResolvedValue({
      type: 'access',
      sub: '7',
    }),
  }
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'auth') {
        return { aud: 'audience', iss: 'issuer' }
      }
      if (key === 'rsa.publicKey') {
        return 'public-key'
      }
      return undefined
    }),
  }
  const chatService = {
    sendMessage: jest.fn().mockResolvedValue({
      id: '100',
      conversationId: 10,
      messageId: '100',
      messageSeq: '1',
      createdAt: new Date('2026-05-03T00:00:00.000Z'),
      deduplicated: false,
    }),
    markConversationRead: jest.fn().mockResolvedValue({
      conversationId: 10,
      messageId: '100',
      readUptoMessageId: '100',
    }),
  }
  const moduleRef = {
    get: jest.fn().mockReturnValue(chatService),
  }
  const messageWsMonitorService = {
    recordRequest: jest.fn().mockResolvedValue(undefined),
    recordAck: jest.fn().mockResolvedValue(undefined),
    recordReconnect: jest.fn().mockResolvedValue(undefined),
  }
  const userCoreService = {
    getAppUserAccessCheck: jest.fn().mockResolvedValue({
      allowed: true,
      user: {
        id: 7,
        isEnabled: true,
        status: UserStatusEnum.NORMAL,
        banReason: null,
        banUntil: null,
      },
    }),
  }

  return {
    service: new MessageWebSocketService(
      jwtService as unknown as JwtService,
      configService as never,
      moduleRef as never,
      messageWsMonitorService as unknown as MessageWsMonitorService,
      userCoreService as never,
    ),
    chatService,
    configService,
    jwtService,
    userCoreService,
  }
}

function createNativeClient() {
  return {
    send: jest.fn(),
    close: jest.fn(),
    on: jest.fn(),
    readyState: 1,
  } as unknown as WebSocket
}

function createNativeServerMock(
  initialAuth: NativeAuthResult,
  authEvent: NativeAuthResult = initialAuth,
) {
  const messageWebSocketService = {
    resolveNativeRequestAuth: jest.fn().mockResolvedValue(initialAuth),
    resolveNativeAuthToken: jest.fn().mockResolvedValue(authEvent),
    createNativeAuthRequiredMessage: jest.fn().mockReturnValue('auth-required'),
    createNativeAuthOkMessage: jest
      .fn()
      .mockImplementation((userId: number) => `auth-ok:${userId}`),
    createNativeAuthErrorMessage: jest
      .fn()
      .mockImplementation((code: number, message: string) =>
        JSON.stringify({ event: 'ws.auth.error', data: { code, message } }),
      ),
    createNativeEventMessage: jest.fn().mockReturnValue('event-message'),
    createNativeErrorMessage: jest.fn().mockReturnValue('error-message'),
    createNativeAckMessage: jest.fn().mockReturnValue('ack-message'),
    handleChatSend: jest.fn(),
    handleChatRead: jest.fn(),
    shouldDisconnectAfterAck: jest.fn().mockReturnValue(false),
    registerNativeClient: jest.fn(),
    unregisterNativeClient: jest.fn(),
  }

  return {
    server: new MessageNativeWebSocketServer(
      messageWebSocketService as never,
    ) as unknown as NativeServerHarness,
    messageWebSocketService,
  }
}

async function flushMicrotasks() {
  await new Promise<void>((resolve) => {
    setImmediate(resolve)
  })
}

describe('MessageWebSocketService auth and access checks', () => {
  it('returns userId for a valid access token and active app user', async () => {
    const { service, userCoreService } = createService()

    await expect(service.resolveSocketIoUserId(buildSocket())).resolves.toBe(7)
    expect(userCoreService.getAppUserAccessCheck).toHaveBeenCalledWith(7)
  })

  it('returns null for an invalid token without checking user state', async () => {
    const { service, jwtService, userCoreService } = createService()
    jwtService.verifyAsync.mockRejectedValue(new Error('invalid token'))

    await expect(
      service.resolveSocketIoUserId(buildSocket()),
    ).resolves.toBeNull()
    expect(userCoreService.getAppUserAccessCheck).not.toHaveBeenCalled()
  })

  it.each([
    ['missing or deleted', { allowed: false, reason: 'not_found' }],
    [
      'disabled',
      {
        allowed: false,
        reason: 'disabled',
        message: '账号已被禁用，请联系管理员',
      },
    ],
    [
      'banned',
      {
        allowed: false,
        reason: 'banned',
        code: BusinessErrorCode.OPERATION_NOT_ALLOWED,
        message: '账号已被封禁，原因：违规发言，解封时间：永久封禁',
      },
    ],
  ])('returns null for %s app users during auth', async (_label, result) => {
    const { service, userCoreService } = createService()
    userCoreService.getAppUserAccessCheck.mockResolvedValue(result)

    await expect(
      service.resolveNativeRequestUserId(buildNativeRequest('access-token')),
    ).resolves.toBeNull()
  })
})

describe('MessageWebSocketService event-level status checks', () => {
  it('returns 40101 and avoids chat service when chat.send has no userId', async () => {
    const { service, chatService } = createService()

    const ack = await service.handleChatSend(null, buildSendEnvelope())

    expect(ack).toMatchObject({ requestId: 'req-1', code: 40101 })
    expect(service.shouldDisconnectAfterAck(ack)).toBe(true)
    expect(chatService.sendMessage).not.toHaveBeenCalled()
  })

  it.each([
    ['missing or deleted', { allowed: false, reason: 'not_found' }, 40101],
    [
      'disabled',
      {
        allowed: false,
        reason: 'disabled',
        message: '账号已被禁用，请联系管理员',
      },
      PlatformErrorCode.FORBIDDEN,
    ],
    [
      'banned',
      {
        allowed: false,
        reason: 'banned',
        code: BusinessErrorCode.OPERATION_NOT_ALLOWED,
        message: '账号已被封禁，原因：违规发言，解封时间：永久封禁',
      },
      BusinessErrorCode.OPERATION_NOT_ALLOWED,
    ],
  ])(
    'returns %s status ack before chat.send business handling',
    async (_label, result, code) => {
      const { service, chatService, userCoreService } = createService()
      userCoreService.getAppUserAccessCheck.mockResolvedValue(result)

      const ack = await service.handleChatSend(7, buildSendEnvelope())

      expect(ack).toMatchObject({ requestId: 'req-1', code })
      expect(service.shouldDisconnectAfterAck(ack)).toBe(true)
      expect(chatService.sendMessage).not.toHaveBeenCalled()
    },
  )

  it.each([
    ['missing or deleted', { allowed: false, reason: 'not_found' }, 40101],
    [
      'disabled',
      {
        allowed: false,
        reason: 'disabled',
        message: '账号已被禁用，请联系管理员',
      },
      PlatformErrorCode.FORBIDDEN,
    ],
    [
      'banned',
      {
        allowed: false,
        reason: 'banned',
        code: BusinessErrorCode.OPERATION_NOT_ALLOWED,
        message: '账号已被封禁，原因：违规发言，解封时间：永久封禁',
      },
      BusinessErrorCode.OPERATION_NOT_ALLOWED,
    ],
  ])(
    'returns %s status ack before chat.read business handling',
    async (_label, result, code) => {
      const { service, chatService, userCoreService } = createService()
      userCoreService.getAppUserAccessCheck.mockResolvedValue(result)

      const ack = await service.handleChatRead(7, buildReadEnvelope())

      expect(ack).toMatchObject({ requestId: 'req-1', code })
      expect(service.shouldDisconnectAfterAck(ack)).toBe(true)
      expect(chatService.markConversationRead).not.toHaveBeenCalled()
    },
  )

  it('disconnects only for auth and user-state terminal acks', () => {
    const { service } = createService()

    expect(
      service.shouldDisconnectAfterAck({
        requestId: 'r1',
        code: 40101,
        message: 'Unauthorized',
      }),
    ).toBe(true)
    expect(
      service.shouldDisconnectAfterAck({
        requestId: 'r1',
        code: PlatformErrorCode.FORBIDDEN,
        message: 'Forbidden',
      }),
    ).toBe(true)
    expect(
      service.shouldDisconnectAfterAck({
        requestId: 'r1',
        code: BusinessErrorCode.OPERATION_NOT_ALLOWED,
        message: 'Operation not allowed',
      }),
    ).toBe(true)
    expect(
      service.shouldDisconnectAfterAck({
        requestId: 'r1',
        code: 40001,
        message: 'Bad request',
      }),
    ).toBe(false)
  })
})

describe('MessageWebSocketService send payload boundary', () => {
  it.each([
    ['blank content', { content: '   ' }],
    ['content length 5001', { content: 'a'.repeat(5001) }],
    ['invalid message type', { messageType: 999 }],
    ['blank clientMessageId', { clientMessageId: '   ' }],
    ['clientMessageId length 65', { clientMessageId: 'a'.repeat(65) }],
    ['array payload', { payload: [] }],
    ['null payload', { payload: null }],
    ['scalar payload', { payload: 'bad' }],
    [
      'payload deeper than 6 levels',
      { payload: { a: { b: { c: { d: { e: { f: { g: true } } } } } } } },
    ],
    ['payload larger than 16 KiB', { payload: { text: '好'.repeat(6000) } }],
  ])('returns 40001 for %s', async (_label, payloadOverride) => {
    const { service, chatService } = createService()

    const ack = await service.handleChatSend(
      7,
      buildSendEnvelope({
        payload: {
          conversationId: 10,
          messageType: ChatMessageTypeEnum.TEXT,
          content: 'hello',
          ...payloadOverride,
        },
      }),
    )

    expect(ack).toMatchObject({ requestId: 'req-1', code: 40001 })
    expect(service.shouldDisconnectAfterAck(ack)).toBe(false)
    expect(chatService.sendMessage).not.toHaveBeenCalled()
  })

  it('accepts boundary-sized content and clientMessageId and serializes valid payload once', async () => {
    const { service, chatService } = createService()
    const payloadObject = { trace: 'ok' }

    const ack = await service.handleChatSend(
      7,
      buildSendEnvelope({
        payload: {
          conversationId: 10,
          messageType: ChatMessageTypeEnum.TEXT,
          content: 'a'.repeat(5000),
          clientMessageId: 'b'.repeat(64),
          payload: payloadObject,
        },
      }),
    )

    expect(ack).toMatchObject({ requestId: 'req-1', code: 0 })
    expect(chatService.sendMessage).toHaveBeenCalledWith(7, {
      conversationId: 10,
      messageType: ChatMessageTypeEnum.TEXT,
      content: 'a'.repeat(5000),
      clientMessageId: 'b'.repeat(64),
      payload: JSON.stringify(payloadObject),
    })
  })
})

describe('MessageNativeWebSocketServer auth routing', () => {
  it('sends auth required and keeps the socket open for an initial request without token', async () => {
    const { server, messageWebSocketService } = createNativeServerMock({
      userId: null,
      message: 'Authentication required',
      shouldClose: false,
    })
    const client = createNativeClient()

    await server.handleConnection(client, buildNativeRequest())
    await flushMicrotasks()

    expect(client.send).toHaveBeenCalledWith('auth-required')
    expect(client.close).not.toHaveBeenCalled()
    expect(messageWebSocketService.registerNativeClient).not.toHaveBeenCalled()
  })

  it('sends auth ok and binds the initial active request user', async () => {
    const { server, messageWebSocketService } = createNativeServerMock({
      userId: 7,
      message: 'ok',
      shouldClose: false,
    })
    const client = createNativeClient()

    await server.handleConnection(client, buildNativeRequest('access-token'))
    await flushMicrotasks()

    expect(client.send).toHaveBeenCalledWith('auth-ok:7')
    expect(messageWebSocketService.registerNativeClient).toHaveBeenCalledWith(
      7,
      client,
    )
    expect(client.close).not.toHaveBeenCalled()
  })

  it.each([
    ['deleted or missing', 40101, AuthErrorMessages.LOGIN_INVALID],
    ['disabled', PlatformErrorCode.FORBIDDEN, '账号已被禁用，请联系管理员'],
    [
      'banned',
      BusinessErrorCode.OPERATION_NOT_ALLOWED,
      '账号已被封禁，原因：违规发言，解封时间：永久封禁',
    ],
  ])(
    'sends auth error and closes initial %s users',
    async (_label, code, message) => {
      const { server, messageWebSocketService } = createNativeServerMock({
        userId: null,
        code,
        message,
        shouldClose: true,
      })
      const client = createNativeClient()

      await server.handleConnection(client, buildNativeRequest('access-token'))
      await flushMicrotasks()

      expect(
        messageWebSocketService.createNativeAuthErrorMessage,
      ).toHaveBeenCalledWith(code, message)
      expect(client.close).toHaveBeenCalled()
    },
  )

  it('handles invalid auth events without binding or closing', async () => {
    const { server, messageWebSocketService } = createNativeServerMock(
      {
        userId: null,
        message: 'Authentication required',
        shouldClose: false,
      },
      {
        userId: null,
        code: 40101,
        message: 'Authentication failed',
        shouldClose: false,
      },
    )
    const client = createNativeClient()
    const state = { userId: null }

    await server.handleMessage(
      client,
      state,
      JSON.stringify({ event: 'auth', token: 'bad-token' }),
    )

    expect(messageWebSocketService.resolveNativeAuthToken).toHaveBeenCalledWith(
      'bad-token',
    )
    expect(
      messageWebSocketService.createNativeAuthErrorMessage,
    ).toHaveBeenCalledWith(40101, 'Authentication failed')
    expect(state.userId).toBeNull()
    expect(client.close).not.toHaveBeenCalled()
  })

  it.each([
    ['deleted or missing', 40101, AuthErrorMessages.LOGIN_INVALID],
    ['disabled', PlatformErrorCode.FORBIDDEN, '账号已被禁用，请联系管理员'],
    [
      'banned',
      BusinessErrorCode.OPERATION_NOT_ALLOWED,
      '账号已被封禁，原因：违规发言，解封时间：永久封禁',
    ],
  ])(
    'unregisters and closes auth event for %s users',
    async (_label, code, message) => {
      const { server, messageWebSocketService } = createNativeServerMock(
        {
          userId: null,
          message: 'Authentication required',
          shouldClose: false,
        },
        {
          userId: null,
          code,
          message,
          shouldClose: true,
        },
      )
      const client = createNativeClient()
      const state = { userId: 7 }

      await server.handleMessage(
        client,
        state,
        JSON.stringify({ event: 'auth', token: 'access-token' }),
      )

      expect(
        messageWebSocketService.unregisterNativeClient,
      ).toHaveBeenCalledWith(7, client)
      expect(
        messageWebSocketService.createNativeAuthErrorMessage,
      ).toHaveBeenCalledWith(code, message)
      expect(state.userId).toBeNull()
      expect(client.close).toHaveBeenCalled()
    },
  )
})
