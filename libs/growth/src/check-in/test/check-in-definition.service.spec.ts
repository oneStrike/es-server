import * as schema from '@db/schema'
import { PgDialect } from 'drizzle-orm/pg-core'
import { CheckInDefinitionService } from '../check-in-definition.service'
import {
  CheckInCycleTypeEnum,
  CheckInPatternRewardRuleTypeEnum,
  CheckInPlanStatusEnum,
} from '../check-in.constant'

describe('check-in definition service', () => {
  const dialect = new PgDialect()

  let service: CheckInDefinitionService
  let drizzle: any
  let dbSelectLimitMock: jest.Mock
  let txSelectLimitMock: jest.Mock
  let txExecuteMock: jest.Mock
  let planInsertValuesMock: jest.Mock
  let planInsertReturningMock: jest.Mock
  let planUpdateSetMock: jest.Mock
  let planUpdateWhereMock: jest.Mock

  beforeEach(() => {
    dbSelectLimitMock = jest.fn().mockResolvedValue([])
    txSelectLimitMock = jest.fn().mockResolvedValue([])
    txExecuteMock = jest.fn().mockResolvedValue(undefined)
    planInsertReturningMock = jest.fn().mockResolvedValue([
      {
        id: 11,
      },
    ])
    planInsertValuesMock = jest.fn(() => ({
      returning: planInsertReturningMock,
    }))
    planUpdateWhereMock = jest.fn().mockResolvedValue({ rowCount: 1 })
    planUpdateSetMock = jest.fn(() => ({
      where: planUpdateWhereMock,
    }))

    const tx = {
      execute: txExecuteMock,
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            limit: txSelectLimitMock,
          })),
        })),
      })),
      insert: jest.fn((table: unknown) => {
        if (table === schema.checkInPlan) {
          return {
            values: planInsertValuesMock,
          }
        }

        throw new Error('unexpected insert target')
      }),
      update: jest.fn((table: unknown) => {
        if (table === schema.checkInPlan) {
          return {
            set: planUpdateSetMock,
          }
        }

        throw new Error('unexpected update target')
      }),
    }

    drizzle = {
      db: {
        select: jest.fn(() => ({
          from: jest.fn(() => ({
            where: jest.fn(() => ({
              limit: dbSelectLimitMock,
            })),
          })),
        })),
        update: jest.fn(() => ({
          set: planUpdateSetMock,
        })),
      },
      ext: {
        findPagination: jest.fn(),
      },
      schema,
      withTransaction: jest.fn(
        async (fn: (input: typeof tx) => Promise<unknown>) => fn(tx),
      ),
      withErrorHandling: jest.fn(async (fn: () => Promise<unknown>) => fn()),
      assertAffectedRows: jest.fn(),
    }

    service = new CheckInDefinitionService(drizzle, {} as any)
  })

  it('创建计划时会一并写入奖励配置定义', async () => {
    const result = await service.createPlan(
      {
        planCode: 'growth-check-in',
        planName: '成长签到',
        status: CheckInPlanStatusEnum.DRAFT,
        cycleType: CheckInCycleTypeEnum.MONTHLY,
        startDate: '2026-04-01',
        endDate: '2026-04-30',
        allowMakeupCountPerCycle: 2,
        baseRewardConfig: { points: 5 },
        dateRewardRules: [
          {
            rewardDate: '2026-04-03',
            rewardConfig: { experience: 30 },
          },
          {
            rewardDate: '2026-04-01',
            rewardConfig: { points: 10 },
          },
        ],
      },
      99,
    )

    expect(planInsertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        planCode: 'growth-check-in',
        planName: '成长签到',
        cycleType: CheckInCycleTypeEnum.MONTHLY,
        startDate: '2026-04-01',
        endDate: '2026-04-30',
        allowMakeupCountPerCycle: 2,
        rewardDefinition: {
          baseRewardConfig: { points: 5 },
          dateRewardRules: [
            {
              rewardDate: '2026-04-01',
              rewardConfig: { points: 10 },
            },
            {
              rewardDate: '2026-04-03',
              rewardConfig: { experience: 30 },
            },
          ],
          patternRewardRules: [],
          streakRewardRules: [],
        },
        createdById: 99,
        updatedById: 99,
      }),
    )
    expect(result).toEqual({ id: 11 })
  })

  it('发布计划创建时会在事务内加咨询锁后再校验生效窗口', async () => {
    jest.spyOn(service as any, 'findCurrentActivePlan').mockResolvedValue(null)

    await service.createPlan(
      {
        planCode: 'growth-check-in',
        planName: '成长签到',
        status: CheckInPlanStatusEnum.PUBLISHED,
        cycleType: CheckInCycleTypeEnum.MONTHLY,
        startDate: '2026-04-01',
        endDate: '2026-04-30',
        allowMakeupCountPerCycle: 2,
      },
      99,
    )

    expect(txExecuteMock).toHaveBeenCalledTimes(1)
    const rendered = dialect.sqlToQuery(txExecuteMock.mock.calls[0][0]).sql
    expect(rendered).toContain('pg_advisory_xact_lock')
  })

  it('周计划创建时会拦截未对齐周一的开始日期', async () => {
    await expect(
      service.createPlan(
        {
          planCode: 'growth-check-in',
          planName: '成长签到',
          status: CheckInPlanStatusEnum.DRAFT,
          cycleType: CheckInCycleTypeEnum.WEEKLY,
          startDate: '2026-04-07',
          allowMakeupCountPerCycle: 2,
        },
        99,
      ),
    ).rejects.toThrow('周计划开始日期必须对齐周一')
  })

  it('创建计划时会拦截空白 planCode', async () => {
    await expect(
      service.createPlan(
        {
          planCode: '   ',
          planName: '成长签到',
          status: CheckInPlanStatusEnum.DRAFT,
          cycleType: CheckInCycleTypeEnum.MONTHLY,
          startDate: '2026-04-01',
          endDate: '2026-04-30',
          allowMakeupCountPerCycle: 2,
        },
        99,
      ),
    ).rejects.toThrow('计划编码不能为空')
  })

  it('创建计划时会拦截空白 planName', async () => {
    await expect(
      service.createPlan(
        {
          planCode: 'growth-check-in',
          planName: '   ',
          status: CheckInPlanStatusEnum.DRAFT,
          cycleType: CheckInCycleTypeEnum.MONTHLY,
          startDate: '2026-04-01',
          endDate: '2026-04-30',
          allowMakeupCountPerCycle: 2,
        },
        99,
      ),
    ).rejects.toThrow('计划名称不能为空')
  })

  it('已发布计划创建时会拦截与其他已发布窗口重叠的时间段', async () => {
    txSelectLimitMock.mockResolvedValueOnce([{ id: 99 }])
    jest.spyOn(service as any, 'findCurrentActivePlan').mockResolvedValue(null)

    await expect(
      service.createPlan(
        {
          planCode: 'growth-check-in',
          planName: '成长签到',
          status: CheckInPlanStatusEnum.PUBLISHED,
          cycleType: CheckInCycleTypeEnum.MONTHLY,
          startDate: '2026-04-01',
          endDate: '2026-04-30',
          allowMakeupCountPerCycle: 2,
        },
        99,
      ),
    ).rejects.toThrow('已发布签到计划窗口不能重叠')
  })

  it('已发布计划创建时会拦截当前自然周期内立即切换', async () => {
    jest.spyOn(service as any, 'findCurrentActivePlan').mockResolvedValue({
      id: 77,
      cycleType: CheckInCycleTypeEnum.WEEKLY,
      startDate: '2026-04-07',
    })

    await expect(
      service.createPlan(
        {
          planCode: 'growth-check-in',
          planName: '成长签到',
          status: CheckInPlanStatusEnum.PUBLISHED,
          cycleType: CheckInCycleTypeEnum.WEEKLY,
          startDate: '2026-04-06',
          endDate: '2026-04-12',
          allowMakeupCountPerCycle: 2,
        },
        99,
      ),
    ).rejects.toThrow('当前周期内不允许立即切换签到计划')
  })

  it('更新计划时允许 MONTH_LAST_DAY 与 MONTH_DAY=31 共存', async () => {
    jest.spyOn(service as any, 'getPlanById').mockResolvedValue({
      id: 11,
      planCode: 'growth-check-in',
      planName: '成长签到',
      status: CheckInPlanStatusEnum.DRAFT,
      cycleType: CheckInCycleTypeEnum.MONTHLY,
      startDate: '2026-04-01',
      endDate: '2026-04-30',
      allowMakeupCountPerCycle: 2,
      rewardDefinition: null,
    })
    txSelectLimitMock.mockResolvedValue([])

    await service.updatePlan(
      {
        id: 11,
        patternRewardRules: [
          {
            patternType: CheckInPatternRewardRuleTypeEnum.MONTH_LAST_DAY,
            rewardConfig: { points: 30 },
          },
          {
            patternType: CheckInPatternRewardRuleTypeEnum.MONTH_DAY,
            monthDay: 31,
            rewardConfig: { experience: 31 },
          },
        ],
      },
      99,
    )

    expect(planUpdateSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        rewardDefinition: expect.objectContaining({
          patternRewardRules: expect.arrayContaining([
            {
              patternType: CheckInPatternRewardRuleTypeEnum.MONTH_LAST_DAY,
              weekday: null,
              monthDay: null,
              rewardConfig: { points: 30 },
            },
            {
              patternType: CheckInPatternRewardRuleTypeEnum.MONTH_DAY,
              weekday: null,
              monthDay: 31,
              rewardConfig: { experience: 31 },
            },
          ]),
        }),
        updatedById: 99,
      }),
    )
  })

  it('更新计划时会覆盖当前 rewardDefinition', async () => {
    jest.spyOn(service as any, 'getPlanById').mockResolvedValue({
      id: 11,
      planCode: 'growth-check-in',
      planName: '成长签到',
      status: CheckInPlanStatusEnum.DRAFT,
      cycleType: CheckInCycleTypeEnum.MONTHLY,
      startDate: '2026-04-01',
      endDate: '2026-04-30',
      allowMakeupCountPerCycle: 2,
      rewardDefinition: {
        baseRewardConfig: { points: 5 },
        dateRewardRules: [
          {
            rewardDate: '2026-04-01',
            rewardConfig: { points: 10 },
          },
        ],
        patternRewardRules: [
          {
            patternType: CheckInPatternRewardRuleTypeEnum.MONTH_DAY,
            weekday: null,
            monthDay: 15,
            rewardConfig: { experience: 15 },
          },
        ],
        streakRewardRules: [
          {
            ruleCode: 'streak-3',
            streakDays: 3,
            rewardConfig: { points: 30 },
            repeatable: false,
            status: 1,
          },
        ],
      },
    })
    txSelectLimitMock.mockResolvedValue([])

    await service.updatePlan(
      {
        id: 11,
        baseRewardConfig: { points: 5 },
        dateRewardRules: [
          {
            rewardDate: '2026-04-03',
            rewardConfig: { experience: 30 },
          },
          {
            rewardDate: '2026-04-01',
            rewardConfig: { points: 10 },
          },
        ],
        patternRewardRules: [
          {
            patternType: CheckInPatternRewardRuleTypeEnum.MONTH_LAST_DAY,
            rewardConfig: { points: 30 },
          },
          {
            patternType: CheckInPatternRewardRuleTypeEnum.MONTH_DAY,
            monthDay: 15,
            rewardConfig: { experience: 15 },
          },
        ],
        streakRewardRules: [
          {
            ruleCode: 'streak-7',
            streakDays: 7,
            rewardConfig: { points: 70 },
            repeatable: false,
            status: 1,
          },
        ],
      },
      99,
    )

    expect(planUpdateSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        rewardDefinition: {
          baseRewardConfig: { points: 5 },
          dateRewardRules: [
            {
              rewardDate: '2026-04-01',
              rewardConfig: { points: 10 },
            },
            {
              rewardDate: '2026-04-03',
              rewardConfig: { experience: 30 },
            },
          ],
          patternRewardRules: [
            {
              patternType: CheckInPatternRewardRuleTypeEnum.MONTH_DAY,
              weekday: null,
              monthDay: 15,
              rewardConfig: { experience: 15 },
            },
            {
              patternType: CheckInPatternRewardRuleTypeEnum.MONTH_LAST_DAY,
              weekday: null,
              monthDay: null,
              rewardConfig: { points: 30 },
            },
          ],
          streakRewardRules: [
            {
              ruleCode: 'streak-7',
              streakDays: 7,
              rewardConfig: { points: 70 },
              repeatable: false,
              status: 1,
            },
          ],
        },
        updatedById: 99,
      }),
    )
  })

  it('计划已产生签到记录后不允许更新奖励配置', async () => {
    jest.spyOn(service as any, 'getPlanById').mockResolvedValue({
      id: 11,
      planCode: 'growth-check-in',
      planName: '成长签到',
      status: CheckInPlanStatusEnum.DRAFT,
      cycleType: CheckInCycleTypeEnum.MONTHLY,
      startDate: '2026-04-01',
      endDate: '2026-04-30',
      allowMakeupCountPerCycle: 2,
      rewardDefinition: null,
    })
    txSelectLimitMock.mockResolvedValue([{ id: 201 }])

    await expect(
      service.updatePlan(
        {
          id: 11,
          baseRewardConfig: { points: 5 },
        },
        99,
      ),
    ).rejects.toThrow('计划已产生签到数据，不允许修改奖励配置')
  })

  it('更新计划基础信息且未传奖励字段时保留当前 rewardDefinition', async () => {
    jest.spyOn(service as any, 'getPlanById').mockResolvedValue({
      id: 11,
      planCode: 'growth-check-in',
      planName: '成长签到',
      status: CheckInPlanStatusEnum.DRAFT,
      cycleType: CheckInCycleTypeEnum.MONTHLY,
      startDate: '2026-04-01',
      endDate: '2026-04-30',
      allowMakeupCountPerCycle: 2,
      rewardDefinition: {
        baseRewardConfig: { points: 5 },
        dateRewardRules: [
          {
            rewardDate: '2026-04-01',
            rewardConfig: { points: 10 },
          },
        ],
        patternRewardRules: [],
        streakRewardRules: [],
      },
    })

    await service.updatePlan(
      {
        id: 11,
        allowMakeupCountPerCycle: 3,
      },
      99,
    )

    expect(planUpdateSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        allowMakeupCountPerCycle: 3,
        rewardDefinition: {
          baseRewardConfig: { points: 5 },
          dateRewardRules: [
            {
              rewardDate: '2026-04-01',
              rewardConfig: { points: 10 },
            },
          ],
          patternRewardRules: [],
          streakRewardRules: [],
        },
        updatedById: 99,
      }),
    )
  })

  it('发布计划状态更新时会在事务内加咨询锁', async () => {
    jest.spyOn(service as any, 'getPlanById').mockResolvedValue({
      id: 11,
      status: CheckInPlanStatusEnum.DRAFT,
      startDate: '2026-04-01',
      endDate: '2026-04-30',
    })
    jest.spyOn(service as any, 'findCurrentActivePlan').mockResolvedValue(null)

    await service.updatePlanStatus(
      {
        id: 11,
        status: CheckInPlanStatusEnum.PUBLISHED,
      },
      99,
    )

    expect(drizzle.withTransaction).toHaveBeenCalledTimes(1)
    expect(txExecuteMock).toHaveBeenCalledTimes(1)
    const rendered = dialect.sqlToQuery(txExecuteMock.mock.calls[0][0]).sql
    expect(rendered).toContain('pg_advisory_xact_lock')
  })

  it('更新计划状态时缺少 status 会直接报错', async () => {
    await expect(
      service.updatePlanStatus(
        {
          id: 11,
        } as any,
        99,
      ),
    ).rejects.toThrow('status 不能为空')
  })
})
