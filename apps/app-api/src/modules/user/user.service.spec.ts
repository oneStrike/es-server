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
        coinBalance: 10,
        shellBalance: 20,
        couponCount: 1,
      })),
    }
    const taskService = {
      getUserTaskSummary: jest.fn(async () => ({
        unfinishedCount: 2,
        claimableCount: 1,
      })),
    }
    const messageInboxService = {
      getSummary: jest.fn(async () => ({
        unreadCount: 6,
      })),
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

    return { service }
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
      geoCountry: undefined,
      geoProvince: undefined,
      geoCity: undefined,
      geoIsp: undefined,
    })
  })
})
