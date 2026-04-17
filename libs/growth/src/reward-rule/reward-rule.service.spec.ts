import type { DrizzleService } from '@db/core'
import { GrowthRuleTypeEnum } from '../growth-rule.constant'
import { GrowthRewardRuleAssetTypeEnum } from './reward-rule.constant'
import { GrowthRewardRuleService } from './reward-rule.service'

function createDrizzleStub(
  existingRule: {
    id: number
    type: number
    assetType: number
    assetKey: string
    delta: number
    dailyLimit: number
    totalLimit: number
    isEnabled: boolean
  } = {
    id: 1,
    type: GrowthRuleTypeEnum.TOPIC_LIKED,
    assetType: GrowthRewardRuleAssetTypeEnum.POINTS,
    assetKey: '',
    delta: 10,
    dailyLimit: 0,
    totalLimit: 0,
    isEnabled: true,
  },
) {
  const insertChain = {
    values: jest.fn().mockResolvedValue(undefined),
  }
  const updateChain = {
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockResolvedValue({ rowCount: 1 }),
  }
  const selectChain = {
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue([existingRule]),
  }

  return {
    db: {
      insert: jest.fn().mockReturnValue(insertChain),
      update: jest.fn().mockReturnValue(updateChain),
      select: jest.fn().mockReturnValue(selectChain),
    },
    schema: {
      growthRewardRule: {
        id: 'id',
        type: 'type',
        assetType: 'assetType',
        assetKey: 'assetKey',
        delta: 'delta',
        dailyLimit: 'dailyLimit',
        totalLimit: 'totalLimit',
        isEnabled: 'isEnabled',
      },
    },
    ext: {
      findPagination: jest.fn(),
    },
    withErrorHandling: async <T>(callback: () => Promise<T> | T) => callback(),
  } as unknown as DrizzleService
}

describe('growthRewardRuleService delta validation', () => {
  it('rejects create when delta is zero or negative', async () => {
    const service = new GrowthRewardRuleService(createDrizzleStub())

    await expect(
      service.createRewardRule({
        type: GrowthRuleTypeEnum.TOPIC_LIKED,
        assetType: GrowthRewardRuleAssetTypeEnum.POINTS,
        delta: 0,
        isEnabled: true,
        dailyLimit: 0,
        totalLimit: 0,
      }),
    ).rejects.toThrow('成长奖励规则 delta 必须是正整数')

    await expect(
      service.createRewardRule({
        type: GrowthRuleTypeEnum.TOPIC_LIKED,
        assetType: GrowthRewardRuleAssetTypeEnum.POINTS,
        delta: -10,
        isEnabled: true,
        dailyLimit: 0,
        totalLimit: 0,
      }),
    ).rejects.toThrow('成长奖励规则 delta 必须是正整数')
  })

  it('rejects update when delta is zero or negative', async () => {
    const service = new GrowthRewardRuleService(createDrizzleStub())

    await expect(
      service.updateRewardRule({
        id: 1,
        delta: 0,
      }),
    ).rejects.toThrow('成长奖励规则 delta 必须是正整数')

    await expect(
      service.updateRewardRule({
        id: 1,
        delta: -1,
      }),
    ).rejects.toThrow('成长奖励规则 delta 必须是正整数')
  })

  it('accepts positive delta for create and update', async () => {
    const drizzle = createDrizzleStub()
    const service = new GrowthRewardRuleService(drizzle)

    await expect(
      service.createRewardRule({
        type: GrowthRuleTypeEnum.TOPIC_LIKED,
        assetType: GrowthRewardRuleAssetTypeEnum.POINTS,
        delta: 10,
        isEnabled: true,
        dailyLimit: 0,
        totalLimit: 0,
      }),
    ).resolves.toBe(true)

    await expect(
      service.updateRewardRule({
        id: 1,
        delta: 20,
      }),
    ).resolves.toBe(true)
  })

  it('rejects invalid assetKey for points and experience rules', async () => {
    const service = new GrowthRewardRuleService(createDrizzleStub())

    await expect(
      service.createRewardRule({
        type: GrowthRuleTypeEnum.TOPIC_LIKED,
        assetType: GrowthRewardRuleAssetTypeEnum.POINTS,
        assetKey: 'points-main',
        delta: 10,
        isEnabled: true,
        dailyLimit: 0,
        totalLimit: 0,
      }),
    ).rejects.toThrow('积分/经验成长奖励规则 assetKey 必须为空字符串')

    await expect(
      service.updateRewardRule({
        id: 1,
        assetKey: 'experience-main',
      }),
    ).rejects.toThrow('积分/经验成长奖励规则 assetKey 必须为空字符串')
  })

  it('rejects blank assetKey for extended asset rules', async () => {
    const service = new GrowthRewardRuleService(
      createDrizzleStub({
        id: 1,
        type: GrowthRuleTypeEnum.TOPIC_LIKED,
        assetType: GrowthRewardRuleAssetTypeEnum.ITEM,
        assetKey: 'badge-vip',
        delta: 10,
        dailyLimit: 0,
        totalLimit: 0,
        isEnabled: true,
      }),
    )

    await expect(
      service.createRewardRule({
        type: GrowthRuleTypeEnum.TOPIC_LIKED,
        assetType: GrowthRewardRuleAssetTypeEnum.ITEM,
        assetKey: '   ',
        delta: 10,
        isEnabled: true,
        dailyLimit: 0,
        totalLimit: 0,
      }),
    ).rejects.toThrow('扩展成长奖励规则必须提供非空 assetKey')

    await expect(
      service.updateRewardRule({
        id: 1,
        assetKey: '   ',
      }),
    ).rejects.toThrow('扩展成长奖励规则必须提供非空 assetKey')

    await expect(
      new GrowthRewardRuleService(createDrizzleStub()).updateRewardRule({
        id: 1,
        assetType: GrowthRewardRuleAssetTypeEnum.ITEM,
      }),
    ).rejects.toThrow('扩展成长奖励规则必须提供非空 assetKey')

    await expect(
      service.updateRewardRule({
        id: 1,
        assetType: GrowthRewardRuleAssetTypeEnum.CURRENCY,
        assetKey: '   ',
      }),
    ).rejects.toThrow('扩展成长奖励规则必须提供非空 assetKey')
  })

  it('accepts non-empty assetKey for extended asset rules', async () => {
    const drizzle = createDrizzleStub({
      id: 1,
      type: GrowthRuleTypeEnum.TOPIC_LIKED,
      assetType: GrowthRewardRuleAssetTypeEnum.ITEM,
      assetKey: 'badge-vip',
      delta: 10,
      dailyLimit: 0,
      totalLimit: 0,
      isEnabled: true,
    })
    const service = new GrowthRewardRuleService(drizzle)

    await expect(
      service.createRewardRule({
        type: GrowthRuleTypeEnum.TOPIC_LIKED,
        assetType: GrowthRewardRuleAssetTypeEnum.CURRENCY,
        assetKey: 'coin-gold',
        delta: 10,
        isEnabled: true,
        dailyLimit: 0,
        totalLimit: 0,
      }),
    ).resolves.toBe(true)

    await expect(
      service.updateRewardRule({
        id: 1,
        assetKey: 'badge-gold',
      }),
    ).resolves.toBe(true)
  })
})
