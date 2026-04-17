import type { GrowthRewardItem } from '../reward-item.type'
import { EnumProperty } from '@libs/platform/decorators/validate/enum-property'
import { NumberProperty } from '@libs/platform/decorators/validate/number-property'
import { StringProperty } from '@libs/platform/decorators/validate/string-property'
import { GrowthRewardRuleAssetTypeEnum } from '../reward-rule.constant'

export class GrowthRewardItemDto implements GrowthRewardItem {
  @EnumProperty({
    description: '奖励资产类型（1=积分；2=经验；3=道具；4=虚拟货币；5=等级）',
    example: GrowthRewardRuleAssetTypeEnum.POINTS,
    enum: GrowthRewardRuleAssetTypeEnum,
  })
  assetType!: GrowthRewardRuleAssetTypeEnum

  @StringProperty({
    description:
      '奖励资产键；积分/经验必须为空字符串，道具/虚拟货币/等级必须提供稳定业务键',
    example: '',
    required: false,
    maxLength: 64,
  })
  assetKey?: string

  @NumberProperty({
    description: '奖励数量；必须为大于 0 的整数',
    example: 10,
    min: 1,
  })
  amount!: number
}
