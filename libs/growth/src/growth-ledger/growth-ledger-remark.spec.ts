import { GROWTH_RULE_TYPE_VALUES, GrowthRuleTypeEnum } from '../growth-rule.constant'
import { EVENT_DEFINITION_MAP } from '../event-definition/event-definition.map'
import {
  GrowthAssetTypeEnum,
  GrowthLedgerActionEnum,
  GrowthLedgerSourceEnum,
} from './growth-ledger.constant'
import {
  resolveGrowthLedgerRemark,
  resolveStoredGrowthLedgerRemark,
} from './growth-ledger-remark'

describe('growth ledger remark resolver', () => {
  it('uses event definition ledgerRemark for rule-based records', () => {
    expect(
      resolveGrowthLedgerRemark({
        assetType: GrowthAssetTypeEnum.POINTS,
        source: GrowthLedgerSourceEnum.GROWTH_RULE,
        action: GrowthLedgerActionEnum.GRANT,
        ruleType: GrowthRuleTypeEnum.COMIC_WORK_VIEW,
      }),
    ).toBe('浏览漫画作品')
  })

  it('uses direct source policy for task bonus records', () => {
    expect(
      resolveGrowthLedgerRemark({
        assetType: GrowthAssetTypeEnum.EXPERIENCE,
        source: GrowthLedgerSourceEnum.TASK_BONUS,
        action: GrowthLedgerActionEnum.GRANT,
      }),
    ).toBe('任务奖励（经验）')
  })

  it('derives purchase consume remark for stored history rows', () => {
    expect(
      resolveStoredGrowthLedgerRemark({
        assetType: GrowthAssetTypeEnum.POINTS,
        source: 'purchase',
        delta: -30,
      }),
    ).toBe('购买章节')
  })

  it('ensures every event definition provides a non-empty ledgerRemark', () => {
    for (const code of GROWTH_RULE_TYPE_VALUES) {
      expect(EVENT_DEFINITION_MAP[code].ledgerRemark.trim()).not.toBe('')
    }
  })
})
