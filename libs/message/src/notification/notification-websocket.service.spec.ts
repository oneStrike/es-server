import type { WebSocket } from 'ws'
import type {
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
import { MessageWebSocketService } from './notification-websocket.service'

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
    messageWsMonitorService,
    userCoreService,
  }
}

function createNativeClient(readyState = 1) {
  return {
    send: jest.fn(),
    close: jest.fn(),
    readyState,
  } as unknown as WebSocket & {
    send: jest.Mock
    close: jest.Mock
    readyState: number
  }
}

function parseMessage(value: string) {
  return JSON.parse(value) as {
    event: string
    data?: unknown
  }
}

describe('MessageWebSocketService native auth', () => {
  it('binds an active user after auth event with canonical token data', async () => {
    const { service, userCoreService } = createService()
    const client = createNativeClient()
    service.initializeNativeClient(client)

    const result = await service.authenticateNativeClient(client, {
      token: 'access-token',
    })

    expect(result.shouldClose).toBe(false)
    expect(parseMessage(result.message)).toEqual({
      event: 'ws.auth.ok',
      data: { userId: 7 },
    })
    expect(service.getNativeClientUserId(client)).toBe(7)
    expect(userCoreService.getAppUserAccessCheck).toHaveBeenCalledWith(7)
  })

  it('returns auth error for an invalid token without binding the client', async () => {
    const { service, jwtService, userCoreService } = createService()
    jwtService.verifyAsync.mockRejectedValue(new Error('invalid token'))
    const client = createNativeClient()
    service.initializeNativeClient(client)

    const result = await service.authenticateNativeClient(client, {
      token: 'bad-token',
    })

    expect(result.shouldClose).toBe(false)
    expect(parseMessage(result.message)).toEqual({
      event: 'ws.auth.error',
      data: {
        code: 40101,
        message: 'Authentication failed',
      },
    })
    expect(service.getNativeClientUserId(client)).toBeNull()
    expect(userCoreService.getAppUserAccessCheck).not.toHaveBeenCalled()
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
    'returns terminal auth error for %s app users',
    async (_label, result, code) => {
      const { service, userCoreService } = createService()
      userCoreService.getAppUserAccessCheck.mockResolvedValue(result)
      const client = createNativeClient()
      service.initializeNativeClient(client)

      const authResult = await service.authenticateNativeClient(client, {
        token: 'access-token',
      })

      expect(authResult.shouldClose).toBe(true)
      expect(parseMessage(authResult.message)).toMatchObject({
        event: 'ws.auth.error',
        data: { code },
      })
      expect(service.getNativeClientUserId(client)).toBeNull()
    },
  )
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

describe('MessageWebSocketService native broadcasting', () => {
  it('broadcasts events to all open native clients for a user', async () => {
    const { service } = createService()
    const firstClient = createNativeClient()
    const secondClient = createNativeClient()

    service.initializeNativeClient(firstClient)
    service.initializeNativeClient(secondClient)
    await service.authenticateNativeClient(firstClient, { token: 'token-1' })
    await service.authenticateNativeClient(secondClient, { token: 'token-2' })

    service.emitToUser(7, 'notification.created', { id: 1 })

    const expectedMessage = JSON.stringify({
      event: 'notification.created',
      data: { id: 1 },
    })
    expect(firstClient.send).toHaveBeenCalledWith(expectedMessage)
    expect(secondClient.send).toHaveBeenCalledWith(expectedMessage)
  })

  it('removes closed clients before broadcasting', async () => {
    const { service } = createService()
    const closedClient = createNativeClient(3)
    const openClient = createNativeClient()

    service.initializeNativeClient(closedClient)
    service.initializeNativeClient(openClient)
    await service.authenticateNativeClient(closedClient, { token: 'token-1' })
    await service.authenticateNativeClient(openClient, { token: 'token-2' })

    service.emitToUser(7, 'notification.created', { id: 1 })

    expect(closedClient.send).not.toHaveBeenCalled()
    expect(openClient.send).toHaveBeenCalledTimes(1)

    service.emitToUser(7, 'notification.updated', { id: 2 })

    expect(closedClient.send).not.toHaveBeenCalled()
    expect(openClient.send).toHaveBeenCalledTimes(2)
  })

  it('unregisters native clients and stops later broadcasts to that connection', async () => {
    const { service } = createService()
    const client = createNativeClient()

    service.initializeNativeClient(client)
    await service.authenticateNativeClient(client, { token: 'access-token' })

    service.unregisterNativeClient(client)
    service.emitToUser(7, 'notification.created', { id: 1 })

    expect(service.getNativeClientUserId(client)).toBeNull()
    expect(client.send).not.toHaveBeenCalled()
  })

  it('serializes ack and error frames with native event/data envelopes', () => {
    const { service } = createService()

    expect(
      JSON.parse(
        service.createNativeAckMessage({
          requestId: 'req-1',
          code: 0,
          message: 'ok',
        }),
      ),
    ).toEqual({
      event: 'chat.ack',
      data: {
        requestId: 'req-1',
        code: 0,
        message: 'ok',
      },
    })
    expect(
      JSON.parse(service.createNativeErrorMessage(40001, 'Bad input')),
    ).toEqual({
      event: 'ws.error',
      data: {
        requestId: null,
        code: 40001,
        message: 'Bad input',
      },
    })
  })
})
