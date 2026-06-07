import {
  BooleanProperty,
  DateProperty,
  EnumProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { IdDto, OMIT_BASE_FIELDS, PageDto } from '@libs/platform/dto'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
import { BaseGrowthRuleConfigDto } from '../../growth/dto/growth-shared.dto'
import { GrowthRewardRuleAssetTypeEnum } from '../reward-rule.constant'

export enum GrowthRewardRuleArchiveStatusEnum {
  ACTIVE = 1,
  ARCHIVED = 2,
  ALL = 3,
}

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

  @DateProperty({
    description: '归档时间；为空表示当前生效规则',
    example: '2026-06-07T12:00:00.000Z',
    required: false,
    nullable: true,
  })
  archivedAt?: Date | null

  @NumberProperty({
    description: '归档操作者管理员 ID；系统迁移自动归档为空',
    example: 1,
    required: false,
    nullable: true,
  })
  archivedBy?: number | null

  @StringProperty({
    description: '归档原因码',
    example: 'OPERATOR_ARCHIVE',
    required: false,
    nullable: true,
    maxLength: 80,
  })
  archiveReasonCode?: string | null

  @StringProperty({
    description: '归档原因说明',
    example: '运营下线旧规则',
    required: false,
    nullable: true,
    maxLength: 500,
  })
  archiveReason?: string | null
}

export class CreateGrowthRewardRuleDto extends OmitType(
  BaseGrowthRewardRuleDto,
  [
    ...OMIT_BASE_FIELDS,
    'archivedAt',
    'archivedBy',
    'archiveReasonCode',
    'archiveReason',
  ] as const,
) {}

export class UpdateGrowthRewardRuleDto extends IntersectionType(
  IdDto,
  PartialType(CreateGrowthRewardRuleDto),
) {}

export class QueryGrowthRewardRuleFilterDto extends PartialType(
  PickType(BaseGrowthRewardRuleDto, [
    'type',
    'assetType',
    'isEnabled',
  ] as const),
) {
  @EnumProperty({
    description: '规则归档状态筛选：1=当前规则；2=已归档；3=全部',
    example: GrowthRewardRuleArchiveStatusEnum.ACTIVE,
    enum: GrowthRewardRuleArchiveStatusEnum,
    required: false,
  })
  status?: GrowthRewardRuleArchiveStatusEnum

  @BooleanProperty({
    description: '是否包含已归档规则；兼容旧查询，推荐使用 status',
    example: false,
    required: false,
  })
  includeArchived?: boolean
}

export class QueryGrowthRewardRuleDto extends IntersectionType(
  PageDto,
  QueryGrowthRewardRuleFilterDto,
) {}

export class ArchiveGrowthRewardRuleDto extends IdDto {
  @StringProperty({
    description: '归档原因说明',
    example: '运营下线旧规则',
    required: false,
    maxLength: 500,
  })
  archiveReason?: string
}
