import type { WebSocket } from 'ws'
import { GATEWAY_OPTIONS } from '@nestjs/websockets/constants'
import { MessageGateway } from './notification.gateway'

interface GatewayHarness {
  handleConnection(client: WebSocket): void | Promise<void>
  handleDisconnect(client: WebSocket): void | Promise<void>
  handleAuth(client: WebSocket, body: { token?: string }): void | Promise<void>
  handlePing(client: WebSocket): void | Promise<void>
  handleChatSend(
    client: WebSocket,
    body: {
      requestId?: string
      payload?: object
    },
  ): void | Promise<void>
  handleChatRead(
    client: WebSocket,
    body: {
      requestId?: string
      payload?: object
    },
  ): void | Promise<void>
}

function createClient() {
  return {
    send: jest.fn(),
    close: jest.fn(),
    readyState: 1,
  } as unknown as WebSocket & {
    send: jest.Mock
    close: jest.Mock
  }
}

function createGateway() {
  const messageWebSocketService = {
    initializeNativeClient: jest.fn(),
    unregisterNativeClient: jest.fn(),
    createNativeAuthRequiredMessage: jest.fn().mockReturnValue('auth-required'),
    authenticateNativeClient: jest.fn().mockResolvedValue({
      message: 'auth-ok',
      shouldClose: false,
    }),
    createNativeEventMessage: jest
      .fn()
      .mockImplementation((event: string) => `event:${event}`),
    getNativeClientUserId: jest.fn().mockReturnValue(7),
    handleChatSend: jest.fn().mockResolvedValue({
      requestId: 'req-1',
      code: 0,
      message: 'ok',
    }),
    handleChatRead: jest.fn().mockResolvedValue({
      requestId: 'read-1',
      code: 0,
      message: 'ok',
    }),
    createNativeAckMessage: jest.fn().mockReturnValue('ack-message'),
    shouldDisconnectAfterAck: jest.fn().mockReturnValue(false),
  }

  return {
    gateway: new MessageGateway(
      messageWebSocketService as never,
    ) as unknown as GatewayHarness,
    messageWebSocketService,
  }
}

describe('MessageGateway native ws contract', () => {
  const originalNodeEnv = process.env.NODE_ENV
  const originalMessageWsCorsOrigins = process.env.MESSAGE_WS_CORS_ORIGINS

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV
    } else {
      process.env.NODE_ENV = originalNodeEnv
    }

    if (originalMessageWsCorsOrigins === undefined) {
      delete process.env.MESSAGE_WS_CORS_ORIGINS
    } else {
      process.env.MESSAGE_WS_CORS_ORIGINS = originalMessageWsCorsOrigins
    }
  })

  it('allows only configured origins during native ws handshake', () => {
    process.env.NODE_ENV = 'production'
    process.env.MESSAGE_WS_CORS_ORIGINS =
      'https://app.example.com, https://admin.example.com'
    const gatewayOptions = Reflect.getMetadata(
      GATEWAY_OPTIONS,
      MessageGateway,
    ) as {
      verifyClient?: (info: { origin?: string }) => boolean
    }

    expect(gatewayOptions.verifyClient).toEqual(expect.any(Function))
    expect(
      gatewayOptions.verifyClient?.({ origin: 'https://app.example.com' }),
    ).toBe(true)
    expect(
      gatewayOptions.verifyClient?.({ origin: 'https://evil.example.com' }),
    ).toBe(false)
  })

  it('initializes native clients and requests auth on connection', async () => {
    const { gateway, messageWebSocketService } = createGateway()
    const client = createClient()

    await gateway.handleConnection(client)

    expect(messageWebSocketService.initializeNativeClient).toHaveBeenCalledWith(
      client,
    )
    expect(client.send).toHaveBeenCalledWith('auth-required')
  })

  it('authenticates with the canonical auth data token', async () => {
    const { gateway, messageWebSocketService } = createGateway()
    const client = createClient()

    await gateway.handleAuth(client, { token: 'access-token' })

    expect(
      messageWebSocketService.authenticateNativeClient,
    ).toHaveBeenCalledWith(client, { token: 'access-token' })
    expect(client.send).toHaveBeenCalledWith('auth-ok')
    expect(client.close).not.toHaveBeenCalled()
  })

  it('sends pong through native ws frames', async () => {
    const { gateway, messageWebSocketService } = createGateway()
    const client = createClient()

    await gateway.handlePing(client)

    expect(
      messageWebSocketService.createNativeEventMessage,
    ).toHaveBeenCalledWith('pong')
    expect(client.send).toHaveBeenCalledWith('event:pong')
  })

  it('sends chat ack through native ws frames', async () => {
    const { gateway, messageWebSocketService } = createGateway()
    const client = createClient()

    await gateway.handleChatSend(client, {
      requestId: 'req-1',
      payload: { conversationId: 10 },
    })

    expect(messageWebSocketService.getNativeClientUserId).toHaveBeenCalledWith(
      client,
    )
    expect(messageWebSocketService.handleChatSend).toHaveBeenCalledWith(7, {
      requestId: 'req-1',
      payload: { conversationId: 10 },
    })
    expect(client.send).toHaveBeenCalledWith('ack-message')
  })

  it('sends chat.read ack through native ws frames', async () => {
    const { gateway, messageWebSocketService } = createGateway()
    const client = createClient()

    await gateway.handleChatRead(client, {
      requestId: 'read-1',
      payload: { conversationId: 10, messageId: '100' },
    })

    expect(messageWebSocketService.getNativeClientUserId).toHaveBeenCalledWith(
      client,
    )
    expect(messageWebSocketService.handleChatRead).toHaveBeenCalledWith(7, {
      requestId: 'read-1',
      payload: { conversationId: 10, messageId: '100' },
    })
    expect(client.send).toHaveBeenCalledWith('ack-message')
  })

  it('closes the client after terminal chat.read ack', async () => {
    const { gateway, messageWebSocketService } = createGateway()
    const client = createClient()
    messageWebSocketService.handleChatRead.mockResolvedValue({
      requestId: 'read-1',
      code: 40101,
      message: 'Unauthorized',
    })
    messageWebSocketService.shouldDisconnectAfterAck.mockReturnValue(true)

    await gateway.handleChatRead(client, {
      requestId: 'read-1',
      payload: { conversationId: 10, messageId: '100' },
    })

    expect(client.send).toHaveBeenCalledWith('ack-message')
    expect(client.close).toHaveBeenCalled()
  })

  it('unregisters native clients on disconnect', async () => {
    const { gateway, messageWebSocketService } = createGateway()
    const client = createClient()

    await gateway.handleDisconnect(client)

    expect(messageWebSocketService.unregisterNativeClient).toHaveBeenCalledWith(
      client,
    )
  })
})
