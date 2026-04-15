import { MessageWebSocketService } from './notification-websocket.service'

describe('MessageWebSocketService', () => {
  function createService() {
    return new MessageWebSocketService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    )
  }

  it('原生 WS 握手不再接受 query token', () => {
    const service = createService()

    const token = (service as any).extractNativeRequestToken({
      headers: {},
      url: '/ws?token=query-token',
    })

    expect(token).toBeNull()
  })

  it('原生 WS 握手仍然接受 Authorization 头', () => {
    const service = createService()

    const token = (service as any).extractNativeRequestToken({
      headers: {
        authorization: 'Bearer header-token',
      },
      url: '/ws?token=query-token',
    })

    expect(token).toBe('header-token')
  })
})
