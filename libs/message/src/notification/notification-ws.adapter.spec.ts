import { EventEmitter } from 'node:events'
import { of } from 'rxjs'
import { MessageWsAdapter } from './notification-ws.adapter'

function createClient() {
  const client = new EventEmitter() as EventEmitter & {
    readyState: number
    send: jest.Mock
  }
  client.readyState = 1
  client.send = jest.fn()
  return client
}

function parseFrame(value: string) {
  return JSON.parse(value) as {
    event: string
    data?: {
      code?: number
      message?: string
      requestId?: string | null
    }
  }
}

describe('MessageWsAdapter protocol errors', () => {
  it('dispatches canonical event data to the mapped handler', () => {
    const adapter = new MessageWsAdapter({})
    const client = createClient()
    const callback = jest.fn().mockReturnValue({ handled: true })

    adapter.bindMessageHandlers(
      client,
      [{ message: 'chat.send', callback } as never],
      (result) => of({ event: 'handled', data: result }),
    )
    client.emit(
      'message',
      JSON.stringify({ event: 'chat.send', data: { requestId: 'req-1' } }),
      false,
    )

    expect(callback).toHaveBeenCalledWith({ requestId: 'req-1' }, 'chat.send')
    expect(parseFrame(client.send.mock.calls[0][0])).toEqual({
      event: 'handled',
      data: { handled: true },
    })
  })

  it('returns ws.error when a client sends malformed JSON', () => {
    const adapter = new MessageWsAdapter({})
    const client = createClient()

    adapter.bindMessageHandlers(client, [], (result) => of(result))
    client.emit('message', '{"event":', false)

    expect(parseFrame(client.send.mock.calls[0][0])).toEqual({
      event: 'ws.error',
      data: {
        requestId: null,
        code: 40001,
        message: 'Message must be valid JSON',
      },
    })
  })

  it('returns ws.error when a client sends a binary frame', () => {
    const adapter = new MessageWsAdapter({})
    const client = createClient()

    adapter.bindMessageHandlers(client, [], (result) => of(result))
    client.emit('message', Buffer.from([1, 2, 3]), true)

    expect(parseFrame(client.send.mock.calls[0][0])).toEqual({
      event: 'ws.error',
      data: {
        requestId: null,
        code: 40001,
        message: 'Binary frames are not supported',
      },
    })
  })

  it('returns ws.error when a client sends an unsupported event', () => {
    const adapter = new MessageWsAdapter({})
    const client = createClient()

    adapter.bindMessageHandlers(client, [], (result) => of(result))
    client.emit(
      'message',
      JSON.stringify({ event: 'unknown.event', data: { requestId: 'req-1' } }),
      false,
    )

    expect(parseFrame(client.send.mock.calls[0][0])).toEqual({
      event: 'ws.error',
      data: {
        requestId: 'req-1',
        code: 40004,
        message: 'Unsupported event: unknown.event',
      },
    })
  })
})
