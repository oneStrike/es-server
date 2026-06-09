import {
  AnnouncementPublishStatusEnum,
  isAnnouncementPublishedNow,
  resolveAnnouncementPublishStatus,
  shouldAnnouncementEnterNotificationCenter,
} from './announcement.constant'

describe('announcement notification decision', () => {
  const now = new Date('2026-05-18T12:00:00.000Z')

  it('requires isRealtime and APP platform for notification-center fanout', () => {
    expect(
      shouldAnnouncementEnterNotificationCenter({
        enablePlatform: [2],
        isRealtime: true,
      }),
    ).toBe(true)
    expect(
      shouldAnnouncementEnterNotificationCenter({
        enablePlatform: [2],
        isRealtime: false,
      }),
    ).toBe(false)
    expect(
      shouldAnnouncementEnterNotificationCenter({
        enablePlatform: [1, 3],
        isRealtime: true,
      }),
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

  it('treats publishEndTime as an exclusive boundary', () => {
    expect(
      isAnnouncementPublishedNow(
        {
          isPublished: true,
          publishStartTime: new Date('2026-05-18T11:00:00.000Z'),
          publishEndTime: now,
        },
        now,
      ),
    ).toBe(false)

    expect(
      resolveAnnouncementPublishStatus(
        {
          isPublished: true,
          publishStartTime: new Date('2026-05-18T11:00:00.000Z'),
          publishEndTime: now,
        },
        now,
      ),
    ).toBe(AnnouncementPublishStatusEnum.EXPIRED)
  })

  it('resolves the admin-facing derived publish status', () => {
    expect(
      resolveAnnouncementPublishStatus(
        {
          isPublished: false,
          publishStartTime: new Date('2026-05-18T11:00:00.000Z'),
          publishEndTime: new Date('2026-05-18T13:00:00.000Z'),
        },
        now,
      ),
    ).toBe(AnnouncementPublishStatusEnum.UNPUBLISHED)

    expect(
      resolveAnnouncementPublishStatus(
        {
          isPublished: true,
          publishStartTime: new Date('2026-05-18T13:00:00.000Z'),
          publishEndTime: new Date('2026-05-18T14:00:00.000Z'),
        },
        now,
      ),
    ).toBe(AnnouncementPublishStatusEnum.SCHEDULED)

    expect(
      resolveAnnouncementPublishStatus(
        {
          isPublished: true,
          publishStartTime: new Date('2026-05-18T11:00:00.000Z'),
          publishEndTime: new Date('2026-05-18T13:00:00.000Z'),
        },
        now,
      ),
    ).toBe(AnnouncementPublishStatusEnum.ACTIVE)

    expect(
      resolveAnnouncementPublishStatus(
        {
          isPublished: true,
          publishStartTime: new Date('2026-05-18T10:00:00.000Z'),
          publishEndTime: new Date('2026-05-18T11:00:00.000Z'),
        },
        now,
      ),
    ).toBe(AnnouncementPublishStatusEnum.EXPIRED)
  })
})
