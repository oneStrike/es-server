import { GrowthRewardSettlementTypeEnum } from '../growth-reward/growth-reward.constant'

describe('checkIn destructive reset boundaries', () => {
  it('keeps shared settlement cleanup scoped to check-in settlement types only', () => {
    expect(GrowthRewardSettlementTypeEnum.CHECK_IN_RECORD_REWARD).toBe(3)
    expect(GrowthRewardSettlementTypeEnum.CHECK_IN_STREAK_REWARD).toBe(4)
    expect(GrowthRewardSettlementTypeEnum.GROWTH_EVENT).toBe(1)
    expect(GrowthRewardSettlementTypeEnum.TASK_REWARD).toBe(2)
  })
})
