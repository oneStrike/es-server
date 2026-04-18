import { getNotificationEventPayload } from './notification-event.consumer'

describe('notification event consumer payload helper', () => {
  it('keeps null payloads for follow notifications', () => {
    expect(
      getNotificationEventPayload({
        eventKey: 'user.followed',
        context: {
          payload: null,
        },
      } as never),
    ).toBeNull()
  })

  it('falls back to eventKey only when payload is absent', () => {
    expect(
      getNotificationEventPayload({
        eventKey: 'user.followed',
        context: {},
      } as never),
    ).toEqual({
      eventKey: 'user.followed',
    })
  })
})
