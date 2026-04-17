import { EnumProperty } from '@libs/platform/decorators/validate/enum-property'
import { NumberProperty } from '@libs/platform/decorators/validate/number-property'
import { StringProperty } from '@libs/platform/decorators/validate/string-property'
import { PageDto } from '@libs/platform/dto/page.dto'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'
import { GrowthAssetTypeEnum } from '../../growth-ledger/growth-ledger.constant'
import {
  BaseGrowthRecordSharedDto,
} from '../../growth/dto/growth-shared.dto'

export class BaseUserPointRecordDto extends BaseGrowthRecordSharedDto {
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
    example: 'growth_rule',
    required: false,
    maxLength: 40,
  })
  source?: string | null
}

export class QueryUserPointRecordDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseUserPointRecordDto, [
      'ruleId',
      'targetType',
      'targetId',
    ] as const),
  ),
) {
  @NumberProperty({
    description: '用户 ID',
    example: 1,
    required: true,
  })
  userId!: number
}

export class ConsumeUserPointsDto {
  @NumberProperty({
    description: '用户 ID',
    example: 1,
    required: true,
  })
  userId!: number

  @NumberProperty({
    description: '扣减积分值',
    example: 20,
    required: true,
    min: 1,
  })
  points!: number

  @NumberProperty({
    description: '目标类型',
    example: 3,
    required: false,
  })
  targetType?: number

  @NumberProperty({
    description: '目标 ID',
    example: 1,
    required: false,
  })
  targetId?: number

  @NumberProperty({
    description: '兑换记录 ID',
    example: 1,
    required: false,
  })
  exchangeId?: number

  @StringProperty({
    description: '备注',
    example: '管理员扣减积分',
    required: false,
    maxLength: 500,
  })
  remark?: string
}
