import { GrowthRuleTypeEnum } from '@libs/growth/growth'
import { AdminUserRoleEnum } from '@libs/platform/constant'

jest.mock('@db/core', () => ({
  buildILikeCondition: jest.fn((_column: unknown, value?: string) =>
    value ? { type: 'ilike', value } : undefined,
  ),
  buildLikePattern: jest.fn((value?: string) =>
    value?.trim() ? `%${value.trim()}%` : undefined,
  ),
  DrizzleService: class {},
  escapeLikePattern: (value: string) => value,
}))

jest.mock('@libs/growth/badge', () => ({
  UserBadgeService: class {},
}))

jest.mock('@libs/growth/experience', () => ({
  UserExperienceService: class {},
}))

jest.mock('@libs/growth/growth-ledger', () => ({
  GrowthAssetTypeEnum: {
    POINTS: 1,
    EXPERIENCE: 2,
  },
  GrowthLedgerService: class {},
}))

jest.mock('@libs/growth/point', () => ({
  UserPointService: class {},
}))

jest.mock('@libs/platform/modules', () => ({
  RsaService: class {},
  ScryptService: class {},
}))

jest.mock('@libs/user/core', () => ({
  AppUserCountService: class {},
  UserService: class {},
}))

describe('app user service manual operation key', () => {
  it('uses operationKey to build a stable grant bizKey', async () => {
    const { AppUserService } = await import('../app-user.service')

    const addPoints = jest.fn().mockResolvedValue(true)
    const limit = jest.fn().mockResolvedValue([
      { role: AdminUserRoleEnum.SUPER_ADMIN },
    ])
    const where = jest.fn(() => ({ limit }))
    const from = jest.fn(() => ({ where }))
    const select = jest.fn(() => ({ from }))

    const service = new AppUserService(
      {
        db: { select },
        schema: {
          adminUser: {
            id: 'id',
            role: 'role',
          },
        },
      } as any,
      {} as any,
      { addPoints } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    )

    await expect(
      service.addAppUserPoints(9, {
        userId: 18,
        ruleType: GrowthRuleTypeEnum.ADMIN,
        operationKey: 'manual-growth-20260328-001',
        remark: '管理员补发积分',
      } as any),
    ).resolves.toBe(true)

    expect(addPoints).toHaveBeenCalledWith({
      userId: 18,
      ruleType: GrowthRuleTypeEnum.ADMIN,
      operationKey: 'manual-growth-20260328-001',
      remark: '管理员补发积分',
      bizKey:
        'app-user:points:add:admin:9:user:18:operation:manual-growth-20260328-001',
      source: 'admin_app_user_module',
    })
  })

  it('delegates mixed growth ledger page queries', async () => {
    const { AppUserService } = await import('../app-user.service')

    const getGrowthLedgerPage = jest.fn().mockResolvedValue({
      list: [],
      total: 0,
      pageIndex: 1,
      pageSize: 20,
    })
    const ensureUserExists = jest.fn().mockResolvedValue({ id: 18 })

    const service = new AppUserService(
      { db: {}, schema: {} } as any,
      { ensureUserExists } as any,
      {} as any,
      {} as any,
      { getGrowthLedgerPage } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    )

    await expect(
      service.getAppUserGrowthLedgerRecords({
        userId: 18,
        assetType: 1,
        pageIndex: 1,
        pageSize: 20,
      } as any),
    ).resolves.toEqual({
      list: [],
      total: 0,
      pageIndex: 1,
      pageSize: 20,
    })

    expect(ensureUserExists).toHaveBeenCalledWith(18)
    expect(getGrowthLedgerPage).toHaveBeenCalledWith({
      userId: 18,
      assetType: 1,
      pageIndex: 1,
      pageSize: 20,
    })
  })
})
