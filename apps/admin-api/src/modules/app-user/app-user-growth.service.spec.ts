import {
  appUser,
  appUserCount,
  growthLedgerRecord,
  userBadge,
  userBadgeAssignment,
  userLevelRule,
} from '@db/schema'
import { GrowthRuleTypeEnum } from '@libs/growth/growth-rule.constant'
import { AppUserGrowthService } from './app-user-growth.service'

function createService(overrides?: { db?: unknown }) {
  const db = overrides?.db ?? {}
  const drizzle = {
    db,
    schema: {
      appUser,
      appUserCount,
      growthLedgerRecord,
      userBadge,
      userBadgeAssignment,
      userLevelRule,
    },
    buildPage: jest.fn(() => ({
      pageIndex: 1,
      pageSize: 20,
      limit: 20,
      offset: 0,
    })),
    buildOrderBy: jest.fn(() => ({ orderBySql: [] })),
  }
  const userCoreService = {
    ensureUserExists: jest.fn(async () => ({ id: 7 })),
  }
  const userPointService = {
    addPoints: jest.fn(async (payload) => payload),
    consumePoints: jest.fn(async (payload) => payload),
  }
  const userExperienceService = {
    addExperience: jest.fn(async (payload) => payload),
  }
  const service = new AppUserGrowthService(
    drizzle as never,
    userCoreService as never,
    userPointService as never,
    userExperienceService as never,
    {} as never,
    {} as never,
  )
  jest
    .spyOn(
      service as unknown as {
        ensureSuperAdmin: (adminUserId: number) => Promise<void>
      },
      'ensureSuperAdmin',
    )
    .mockResolvedValue(undefined)

  return {
    db,
    drizzle,
    service,
    userCoreService,
    userExperienceService,
    userPointService,
  }
}

describe('AppUserGrowthService manual operation contract', () => {
  it('forwards operationNote when manually adding points and keeps admin as actor only', async () => {
    const { service, userCoreService, userPointService } = createService()

    await service.addAppUserPoints(1, {
      userId: 7,
      ruleType: GrowthRuleTypeEnum.CREATE_TOPIC,
      operationKey: 'manual-growth-20260607-001',
      operationNote: '补发积分，工单 INC-1',
    })

    expect(userCoreService.ensureUserExists).toHaveBeenCalledWith(7)
    expect(userPointService.addPoints).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 7,
        ruleType: GrowthRuleTypeEnum.CREATE_TOPIC,
        operationKey: 'manual-growth-20260607-001',
        operationNote: '补发积分，工单 INC-1',
        source: 'admin_app_user_module',
        bizKey:
          'app-user:points:add:admin:1:user:7:operation:manual-growth-20260607-001',
      }),
    )
    expect(userPointService.addPoints).not.toHaveBeenCalledWith(
      expect.objectContaining({ userId: 1 }),
    )
  })

  it('forwards operationNote when manually consuming points', async () => {
    const { service, userPointService } = createService()

    await service.consumeAppUserPoints(1, {
      userId: 7,
      points: 10,
      targetType: 3,
      targetId: 20,
      exchangeId: 30,
      operationKey: 'manual-growth-20260607-002',
      operationNote: '扣减误发积分',
    })

    expect(userPointService.consumePoints).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 7,
        points: 10,
        targetType: 3,
        targetId: 20,
        exchangeId: 30,
        operationNote: '扣减误发积分',
        source: 'admin_app_user_module',
        bizKey:
          'app-user:points:consume:admin:1:user:7:operation:manual-growth-20260607-002',
      }),
    )
  })

  it('forwards operationNote when manually adding experience', async () => {
    const { service, userExperienceService } = createService()

    await service.addAppUserExperience(1, {
      userId: 7,
      ruleType: GrowthRuleTypeEnum.CREATE_TOPIC,
      operationKey: 'manual-growth-20260607-003',
      operationNote: '补发经验',
    })

    expect(userExperienceService.addExperience).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 7,
        ruleType: GrowthRuleTypeEnum.CREATE_TOPIC,
        operationKey: 'manual-growth-20260607-003',
        operationNote: '补发经验',
        source: 'admin_app_user_module',
        bizKey:
          'app-user:experience:add:admin:1:user:7:operation:manual-growth-20260607-003',
      }),
    )
  })
})

describe('AppUserGrowthService badge query contract', () => {
  it('paginates assigned badges with a badge join instead of preloading all badge ids', async () => {
    const createdAt = new Date('2026-06-07T12:00:00.000Z')
    const badge = {
      id: 5,
      name: '活跃用户',
      type: 1,
      isEnabled: true,
      business: 'forum',
      eventKey: 'forum.topic.create',
    }
    const listInnerJoin = jest.fn(() => ({
      where: jest.fn(() => ({
        orderBy: jest.fn(() => ({
          limit: jest.fn(() => ({
            offset: jest.fn(async () => [
              {
                assignment: { userId: 7, badgeId: 5, createdAt },
                badge,
              },
            ]),
          })),
        })),
      })),
    }))
    const countInnerJoin = jest.fn(() => ({
      where: jest.fn(async () => [{ count: 1 }]),
    }))
    const db = {
      select: jest
        .fn()
        .mockReturnValueOnce({
          from: jest.fn(() => ({ innerJoin: listInnerJoin })),
        })
        .mockReturnValueOnce({
          from: jest.fn(() => ({ innerJoin: countInnerJoin })),
        }),
    }
    const { drizzle, service } = createService({ db })

    const result = await service.getAppUserBadges({
      userId: 7,
      name: '活跃',
      type: 1,
      isEnabled: true,
      business: 'forum',
      eventKey: 'forum.topic.create',
      pageIndex: 1,
      pageSize: 20,
    })

    expect(db.select).toHaveBeenCalledTimes(2)
    expect(db.select).not.toHaveBeenCalledWith({ id: userBadge.id })
    expect(listInnerJoin).toHaveBeenCalledWith(userBadge, expect.anything())
    expect(countInnerJoin).toHaveBeenCalledWith(userBadge, expect.anything())
    expect(drizzle.buildPage).toHaveBeenCalledWith({
      pageIndex: 1,
      pageSize: 20,
    })
    expect(result).toEqual({
      list: [{ createdAt, badge }],
      total: 1,
      pageIndex: 1,
      pageSize: 20,
    })
  })
})
