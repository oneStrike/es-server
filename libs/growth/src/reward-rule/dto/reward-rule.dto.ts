import { EnumProperty, NumberProperty, StringProperty } from '@libs/platform/decorators'
import { IdDto, OMIT_BASE_FIELDS, PageDto } from '@libs/platform/dto'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
import { BaseGrowthRuleConfigDto } from '../../growth/dto/growth-shared.dto'
import { GrowthRewardRuleAssetTypeEnum } from '../reward-rule.constant'

export class BaseGrowthRewardRuleDto extends BaseGrowthRuleConfigDto {
  @EnumProperty({
    description: '资产类型（1=积分；2=经验；3=道具；4=虚拟货币；5=等级）',
    example: GrowthRewardRuleAssetTypeEnum.POINTS,
    enum: GrowthRewardRuleAssetTypeEnum,
  })
  assetType!: GrowthRewardRuleAssetTypeEnum

  @StringProperty({
    description:
      '资产键；积分/经验必须为空字符串，道具/虚拟货币/等级必须提供稳定业务键',
    example: '',
    required: false,
    maxLength: 64,
  })
  assetKey?: string

  @NumberProperty({
    description: '规则变动值；必须为正整数',
    example: 20,
    required: true,
    min: 1,
  })
  delta!: number
}

export class CreateGrowthRewardRuleDto extends OmitType(
  BaseGrowthRewardRuleDto,
  OMIT_BASE_FIELDS,
) {}

export class UpdateGrowthRewardRuleDto extends IntersectionType(
  IdDto,
  PartialType(CreateGrowthRewardRuleDto),
) {}

export class QueryGrowthRewardRuleDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseGrowthRewardRuleDto, [
      'type',
      'assetType',
      'isEnabled',
    ] as const),
  ),
) {}
