import {
  BaseUserExperienceRecordDto,
  QueryUserExperienceRecordFilterDto,
} from '@libs/growth/experience/dto/experience-record.dto'
import { BaseUserLevelRuleDto } from '@libs/growth/level-rule/dto/level-rule.dto'
import { BaseUserPointRecordDto } from '@libs/growth/point/dto/point-record.dto'
import {
  NestedProperty,
  NumberProperty,
} from '@libs/platform/decorators'
import { PageDto } from '@libs/platform/dto'
import { IntersectionType, OmitType, PartialType, PickType } from '@nestjs/swagger'
import {
  UserExperienceDeltaFieldsDto,
  UserGrowthRemarkFieldDto,
  UserPointDeltaFieldsDto,
} from '../../dto/app-user-growth-shared.dto'

export {
  QueryUserBadgePublicDto as QueryMyBadgeDto,
  UserBadgePublicItemDto as UserBadgeItemDto,
} from '@libs/growth/badge/dto/user-badge-management.dto'

/** 查询本人积分记录。 */
export class QueryMyPointRecordDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseUserPointRecordDto, ['ruleId', 'targetType', 'targetId'] as const),
  ),
) {}

/** 本人积分记录。 */
export class UserPointRecordDto extends IntersectionType(
  OmitType(BaseUserPointRecordDto, [
    'assetType',
    'delta',
    'beforeValue',
    'afterValue',
    'bizKey',
    'context',
    'remark',
    'updatedAt',
  ] as const),
  UserGrowthRemarkFieldDto,
  UserPointDeltaFieldsDto,
) {}

/** 查询本人经验记录。 */
export class QueryMyExperienceRecordDto extends IntersectionType(
  PageDto,
  QueryUserExperienceRecordFilterDto,
) {}

/** 本人经验记录。 */
export class UserExperienceRecordDto extends IntersectionType(
  OmitType(BaseUserExperienceRecordDto, [
    'assetType',
    'delta',
    'beforeValue',
    'afterValue',
    'bizKey',
    'context',
    'remark',
    'updatedAt',
  ] as const),
  UserGrowthRemarkFieldDto,
  UserExperienceDeltaFieldsDto,
) {}

/** 用户等级摘要。 */
export class UserLevelSummaryDto extends PickType(BaseUserLevelRuleDto, [
  'id',
  'name',
  'icon',
  'color',
  'requiredExperience',
] as const) {}

/** 用户经验统计。 */
export class UserExperienceStatsDto {
  @NumberProperty({ description: '当前经验值', example: 350, validation: false })
  currentExperience!: number

  @NumberProperty({ description: '今日获得经验值', example: 20, validation: false })
  todayEarned!: number

  @NestedProperty({ description: '当前等级信息', type: UserLevelSummaryDto, validation: false, nullable: true })
  level!: UserLevelSummaryDto | null

  @NestedProperty({ description: '下一等级信息', type: UserLevelSummaryDto, validation: false, nullable: true })
  nextLevel!: UserLevelSummaryDto | null

  @NumberProperty({ description: '距离下一等级的经验值差距', example: 50, nullable: true, validation: false })
  gapToNextLevel!: number | null
}
