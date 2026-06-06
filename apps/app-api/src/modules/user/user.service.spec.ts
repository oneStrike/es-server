import 'reflect-metadata'

import { DECORATORS } from '@nestjs/swagger/dist/constants'
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
      {} as never,
      {} as never,
      taskService as never,
      messageInboxService as never,
    )

    return { service, userCoreService, userAssetsService, messageInboxService }
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
      levelId: undefined,
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
})
