import {
  isAnnouncementPublishedNow,
  shouldAnnouncementEnterNotificationCenter,
} from './announcement.constant'

describe('announcement notification decision', () => {
  const now = new Date('2026-05-18T12:00:00.000Z')

  it('uses isRealtime as the explicit notification-center switch', () => {
    expect(
      shouldAnnouncementEnterNotificationCenter({ isRealtime: true }),
    ).toBe(true)
    expect(
      shouldAnnouncementEnterNotificationCenter({ isRealtime: false }),
    ).toBe(false)
  })

  it('requires published status and an active publish window', () => {
    expect(
      isAnnouncementPublishedNow(
        {
          isPublished: true,
          publishStartTime: new Date('2026-05-18T11:00:00.000Z'),
          publishEndTime: new Date('2026-05-18T13:00:00.000Z'),
        },
        now,
      ),
    ).toBe(true)

    expect(
      isAnnouncementPublishedNow(
        {
          isPublished: false,
          publishStartTime: new Date('2026-05-18T11:00:00.000Z'),
          publishEndTime: new Date('2026-05-18T13:00:00.000Z'),
        },
        now,
      ),
    ).toBe(false)

    expect(
      isAnnouncementPublishedNow(
        {
          isPublished: true,
          publishStartTime: new Date('2026-05-18T13:00:00.000Z'),
          publishEndTime: new Date('2026-05-18T14:00:00.000Z'),
        },
        now,
      ),
    ).toBe(false)

    expect(
      isAnnouncementPublishedNow(
        {
          isPublished: true,
          publishStartTime: new Date('2026-05-18T10:00:00.000Z'),
          publishEndTime: new Date('2026-05-18T11:00:00.000Z'),
        },
        now,
      ),
    ).toBe(false)
  })

  it('treats empty publish bounds as an open-ended window', () => {
    expect(
      isAnnouncementPublishedNow(
        {
          isPublished: true,
          publishStartTime: null,
          publishEndTime: null,
        },
        now,
      ),
    ).toBe(true)
  })
})
