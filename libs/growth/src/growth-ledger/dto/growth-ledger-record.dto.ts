import { EnumProperty } from '@libs/platform/decorators/validate/enum-property'
import { NumberProperty } from '@libs/platform/decorators/validate/number-property'
import { StringProperty } from '@libs/platform/decorators/validate/string-property'
import { PageDto } from '@libs/platform/dto/page.dto'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'
import { BaseGrowthRecordSharedDto } from '../../growth/dto/growth-shared.dto'
import { GrowthAssetTypeEnum } from '../growth-ledger.constant'

export class BaseGrowthLedgerRecordDto extends BaseGrowthRecordSharedDto {
  @EnumProperty({
    description: '资产类型（1=积分；2=经验）',
    example: GrowthAssetTypeEnum.POINTS,
    required: true,
    enum: GrowthAssetTypeEnum,
  })
  assetType!: GrowthAssetTypeEnum

  @NumberProperty({
    description: '变更值（正数为发放，负数为扣减）',
    example: 5,
    required: true,
  })
  delta!: number

  @StringProperty({
    description: '账本来源（如 growth_rule、task_bonus、purchase）',
    example: 'task_bonus',
    required: true,
    maxLength: 40,
  })
  source!: string
}

export class QueryGrowthLedgerPageDto extends IntersectionType(
  PageDto,
  PickType(BaseGrowthLedgerRecordDto, ['userId'] as const),
  PartialType(
    PickType(BaseGrowthLedgerRecordDto, [
      'assetType',
      'ruleId',
      'ruleType',
      'targetType',
      'targetId',
    ] as const),
  ),
) {}
