import 'reflect-metadata'

import { SmsTemplateCodeEnum } from '@libs/platform/modules/sms/sms.constant'
import { DECORATORS } from '@nestjs/swagger'
import { UserService } from './user.service'

describe('UserService user center latest login geo', () => {
  function createService(userOverrides = {}) {
    const user = {
      id: 7,
      nickname: 'reader',
      avatarUrl: undefined,
      profileBackgroundImageUrl: undefined,
      emailAddress: undefined,
      genderType: undefined,
      birthDate: undefined,
      signature: undefined,
      bio: undefined,
      levelId: undefined,
      lastLoginAt: new Date('2026-05-15T08:00:00.000Z'),
      lastLoginIp: '203.0.113.9',
      lastLoginGeoCountry: '中国',
      lastLoginGeoProvince: '广东省',
      lastLoginGeoCity: '深圳市',
      lastLoginGeoIsp: '电信',
      ...userOverrides,
    }
    const userCoreService = {
      ensureUserExists: jest.fn(async () => user),
      getUserGrowthSnapshot: jest.fn(async () => ({
        levelId: undefined,
        levelName: undefined,
        currentLevelPoints: 0,
        nextLevelPoints: 100,
        totalPoints: 0,
        experience: 0,
      })),
      getUserCounts: jest.fn(async () => ({
        following: 1,
        followers: 2,
        favoriteComics: 3,
        likes: 4,
      })),
      getBadgeCount: jest.fn(async () => 5),
      getLevelInfo: jest.fn(),
    }
    const userAssetsService = {
      getUserAssetsSummary: jest.fn(async () => ({
        availableCouponCount: 1,
        commentCount: 11,
        currencyBalance: 10,
        downloadedChapterCount: 4,
        downloadedWorkCount: 3,
        favoriteCount: 7,
        likeCount: 8,
        purchasedChapterCount: 5,
        purchasedWorkCount: 2,
        viewCount: 9,
        vipExpiresAt: null,
      })),
    }
    const userPointService = {
      getUserPointStats: jest.fn(),
      getAppPointRecordPage: jest.fn(async () => ({
        list: [
          {
            bizKey: 'point:biz',
            context: { privateTrace: 'trace-1' },
            id: 1,
            points: 5,
          },
        ],
        pageIndex: 2,
        pageSize: 10,
        total: 1,
      })),
    }
    const userExperienceService = {
      getAppExperienceRecordPage: jest.fn(async () => ({
        list: [
          {
            bizKey: 'experience:biz',
            context: { privateTrace: 'trace-1' },
            experience: 8,
            id: 2,
            updatedAt: new Date('2026-06-01T00:00:00.000Z'),
          },
        ],
        pageIndex: 3,
        pageSize: 20,
        total: 1,
      })),
    }
    const taskService = {
      getUserTaskSummary: jest.fn(async () => ({
        unfinishedCount: 2,
        claimableCount: 1,
      })),
    }
    const messageInboxService = {
      getUnreadSummary: jest.fn(async () => ({
        notificationUnread: {
          total: 3,
          byCategory: {
            comment_reply: 1,
            comment_mention: 0,
            comment_like: 0,
            topic_like: 0,
            topic_favorited: 0,
            topic_commented: 0,
            topic_mentioned: 0,
            user_followed: 0,
            system_announcement: 2,
            task_reminder: 0,
          },
        },
        totalUnreadCount: 6,
      })),
      getSummary: jest.fn(),
    }

    const service = new UserService(
      {} as never,
      userCoreService as never,
      {} as never,
      userAssetsService as never,
      userPointService as never,
      userExperienceService as never,
      taskService as never,
      messageInboxService as never,
    )

    return {
      service,
      userCoreService,
      userAssetsService,
      userExperienceService,
      userPointService,
      messageInboxService,
    }
  }

  it('returns a stable latest login geo object without leaking raw login fields', async () => {
    const { service } = createService()

    const result = await service.getUserCenter(7)

    expect(result.lastLoginGeo).toEqual({
      geoCountry: '中国',
      geoProvince: '广东省',
      geoCity: '深圳市',
      geoIsp: '电信',
    })
    expect(result).not.toHaveProperty('lastLoginAt')
    expect(result).not.toHaveProperty('lastLoginIp')
    expect(result).not.toHaveProperty('geoSource')
  })

  it('keeps latest login geo node stable when no geo snapshot exists', async () => {
    const { service } = createService({
      lastLoginGeoCountry: null,
      lastLoginGeoProvince: null,
      lastLoginGeoCity: null,
      lastLoginGeoIsp: null,
    })

    const result = await service.getUserCenter(7)

    expect(result.lastLoginGeo).toEqual({
      geoCountry: null,
      geoProvince: null,
      geoCity: null,
      geoIsp: null,
    })
  })

  it('does not repeat user existence checks when building the center assets summary', async () => {
    const { service, userCoreService, userAssetsService } = createService()

    const result = await service.getUserCenter(7)

    expect(userCoreService.ensureUserExists).toHaveBeenCalledTimes(1)
    expect(userAssetsService.getUserAssetsSummary).toHaveBeenCalledWith(7)
    expect(result.assets).toMatchObject({
      currencyBalance: 10,
      availableCouponCount: 1,
      vipExpiresAt: null,
    })
  })

  it('uses the lightweight unread summary for the center message block', async () => {
    const { service, messageInboxService } = createService()

    const result = await service.getUserCenter(7)

    expect(messageInboxService.getUnreadSummary).toHaveBeenCalledWith(7)
    expect(messageInboxService.getSummary).not.toHaveBeenCalled()
    expect(result.message).toEqual({
      notificationUnread: {
        total: 3,
        byCategory: {
          comment_reply: 1,
          comment_mention: 0,
          comment_like: 0,
          topic_like: 0,
          topic_favorited: 0,
          topic_commented: 0,
          topic_mentioned: 0,
          user_followed: 0,
          system_announcement: 2,
          task_reminder: 0,
        },
      },
      totalUnreadCount: 6,
    })
  })

  it('keeps growth level presentation fields present as null without a level', async () => {
    const { service } = createService()

    const result = await service.getUserCenter(7)

    expect(result.growth).toMatchObject({
      levelId: null,
      levelName: null,
      levelIcon: null,
      levelColor: null,
    })
    expect(
      Object.prototype.hasOwnProperty.call(result.growth, 'levelName'),
    ).toBe(true)
    expect(
      Object.prototype.hasOwnProperty.call(result.growth, 'levelIcon'),
    ).toBe(true)
    expect(
      Object.prototype.hasOwnProperty.call(result.growth, 'levelColor'),
    ).toBe(true)
  })

  it('documents growth level presentation fields as required nullable output', () => {
    const originalNodeEnv = process.env.NODE_ENV

    jest.isolateModules(() => {
      process.env.NODE_ENV = 'development'
      const { UserCenterGrowthDto } = require('@libs/user/dto/user-self.dto')

      for (const propertyKey of ['levelName', 'levelIcon', 'levelColor']) {
        expect(
          Reflect.getMetadata(
            DECORATORS.API_MODEL_PROPERTIES,
            UserCenterGrowthDto.prototype,
            propertyKey,
          ),
        ).toMatchObject({
          nullable: true,
          required: true,
        })
      }
    })

    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV
    } else {
      process.env.NODE_ENV = originalNodeEnv
    }
  })

  it('delegates point records to the ApiPage app service contract', async () => {
    const { service, userPointService } = createService()

    const page = await service.getUserPointRecords(7, {
      pageIndex: 2,
      pageSize: 10,
    })

    expect(userPointService.getAppPointRecordPage).toHaveBeenCalledWith({
      pageIndex: 2,
      pageSize: 10,
      userId: 7,
    })
    expect(page).toMatchObject({
      list: [{ id: 1, points: 5 }],
      pageIndex: 2,
      pageSize: 10,
      total: 1,
    })
    expect(page.list[0]).not.toHaveProperty('bizKey')
    expect(page.list[0]).not.toHaveProperty('context')
    expect(page).not.toHaveProperty('hasMore')
    expect(page).not.toHaveProperty('nextCursor')
  })

  it('delegates experience records to the ApiPage app service contract', async () => {
    const { service, userExperienceService } = createService()

    const page = await service.getUserExperienceRecords(7, {
      pageIndex: 3,
      pageSize: 20,
    })

    expect(
      userExperienceService.getAppExperienceRecordPage,
    ).toHaveBeenCalledWith({
      pageIndex: 3,
      pageSize: 20,
      userId: 7,
    })
    expect(page).toMatchObject({
      list: [{ experience: 8, id: 2 }],
      pageIndex: 3,
      pageSize: 20,
      total: 1,
    })
    expect(page.list[0]).not.toHaveProperty('bizKey')
    expect(page.list[0]).not.toHaveProperty('context')
    expect(page.list[0]).not.toHaveProperty('updatedAt')
    expect(page).not.toHaveProperty('hasMore')
    expect(page).not.toHaveProperty('nextCursor')
  })

  it('returns an ApiPage-style empty badge page without cursor output', async () => {
    const userCoreService = {
      ensureUserExists: jest.fn(async () => ({ id: 7 })),
    }
    const badgeQuery = {
      from: jest.fn(() => ({
        where: jest.fn(async () => []),
      })),
    }
    const drizzle = {
      buildPageParams: jest.fn(() => ({
        page: {
          limit: 10,
          offset: 10,
          pageIndex: 2,
          pageSize: 10,
        },
        order: {
          orderBySql: ['user_badge_assignment.created_at desc'],
        },
        dateRange: undefined,
      })),
      db: {
        select: jest.fn(() => badgeQuery),
      },
      schema: {
        userBadge: {
          id: 'user_badge.id',
          isEnabled: 'user_badge.is_enabled',
          name: 'user_badge.name',
          type: 'user_badge.type',
        },
        userBadgeAssignment: {
          badgeId: 'user_badge_assignment.badge_id',
          createdAt: 'user_badge_assignment.created_at',
          userId: 'user_badge_assignment.user_id',
        },
      },
    }
    const service = new UserService(
      drizzle as never,
      userCoreService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    )

    const page = await service.getUserBadges(7, {
      pageIndex: 2,
      pageSize: 10,
    })

    expect(userCoreService.ensureUserExists).toHaveBeenCalledWith(7)
    expect(page).toEqual({
      list: [],
      pageIndex: 2,
      pageSize: 10,
      total: 0,
    })
    expect(page).not.toHaveProperty('hasMore')
    expect(page).not.toHaveProperty('nextCursor')
  })

  it('validates phone-change codes with the binding templates', async () => {
    const user = {
      id: 7,
      phoneNumber: '13800000000',
    }
    const drizzle = {
      db: {},
      schema: { appUser: {} },
      withErrorHandling: jest.fn(async () => undefined),
      isUniqueViolation: jest.fn(() => false),
    }
    const userCoreService = {
      ensureUserExists: jest.fn(async () => user),
    }
    const smsService = {
      validateVerifyCode: jest.fn(async () => true),
    }
    const service = new UserService(
      drizzle as never,
      userCoreService as never,
      smsService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    )

    await service.changeMyPhone(7, {
      currentPhone: '13800000000',
      currentCode: '111111',
      newPhone: '13900000000',
      newCode: '222222',
    })

    expect(smsService.validateVerifyCode).toHaveBeenNthCalledWith(1, {
      phone: '13800000000',
      code: '111111',
      templateCode: SmsTemplateCodeEnum.VERIFY_BIND_PHONE,
    })
    expect(smsService.validateVerifyCode).toHaveBeenNthCalledWith(2, {
      phone: '13900000000',
      code: '222222',
      templateCode: SmsTemplateCodeEnum.BIND_NEW_PHONE,
    })
  })
})
