import {
  EventDefinitionDomainEnum,
  EventDefinitionGovernanceGateEnum,
  EventDefinitionImplStatusEnum,
  GROWTH_RULE_TYPE_RULE_DTO_DESCRIPTION,
} from '@libs/growth/event-definition/event-definition.constant'
import { GrowthRewardRuleAssetTypeEnum } from '@libs/growth/reward-rule/reward-rule.constant'
import { TaskTypeEnum } from '@libs/growth/task/task.constant'
import {
  ArrayProperty,
  BooleanProperty,
  EnumProperty,
  NestedProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'

import { PageDto } from '@libs/platform/dto'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'
import { GrowthRuleTypeEnum } from '../../growth-rule.constant'

export class QueryGrowthRuleEventFilterDto {
  @EnumProperty({
    description: GROWTH_RULE_TYPE_RULE_DTO_DESCRIPTION,
    example: GrowthRuleTypeEnum.CREATE_TOPIC,
    enum: GrowthRuleTypeEnum,
    required: false,
  })
  type?: GrowthRuleTypeEnum

  @BooleanProperty({
    description: '是否只看已正式接入 producer 的事件',
    example: true,
    required: false,
  })
  isImplemented?: boolean

  @BooleanProperty({
    description: '是否只看允许配置基础奖励规则的事件',
    example: true,
    required: false,
  })
  isRuleConfigurable?: boolean

  @BooleanProperty({
    description: '是否只看存在关联任务的事件',
    example: true,
    required: false,
  })
  hasTask?: boolean

  @BooleanProperty({
    description: '是否只看已配置任一基础奖励资产的事件',
    example: true,
    required: false,
  })
  hasBaseReward?: boolean
}

export class QueryGrowthRuleEventPageDto extends IntersectionType(
  PageDto,
  PartialType(QueryGrowthRuleEventFilterDto),
) {}

export class GrowthRuleAssetSummaryDto {
  @EnumProperty({
    description: '资产类型（1=积分；2=经验；3=道具；4=虚拟货币；5=等级）',
    example: GrowthRewardRuleAssetTypeEnum.POINTS,
    enum: GrowthRewardRuleAssetTypeEnum,
    validation: false,
  })
  assetType!: GrowthRewardRuleAssetTypeEnum

  @StringProperty({
    description: '资产键；积分/经验为 null，扩展资产使用稳定业务键',
    example: null,
    nullable: true,
    validation: false,
  })
  assetKey!: string | null

  @BooleanProperty({
    description: '该资产规则是否存在',
    example: true,
    validation: false,
  })
  exists!: boolean

  @NumberProperty({
    description: '规则 ID',
    example: 12,
    validation: false,
  })
  id!: number

  @BooleanProperty({
    description: '规则是否启用',
    example: true,
    validation: false,
  })
  isEnabled!: boolean

  @NumberProperty({
    description: '奖励值',
    example: 5,
    validation: false,
  })
  amount!: number

  @NumberProperty({
    description: '每日上限（0=无限制）',
    example: 0,
    validation: false,
  })
  dailyLimit!: number

  @NumberProperty({
    description: '总上限（0=无限制）',
    example: 0,
    validation: false,
  })
  totalLimit!: number

  @StringProperty({
    description: '规则备注',
    example: null,
    nullable: true,
    validation: false,
  })
  remark!: string | null
}

export class GrowthRuleTaskBindingSummaryDto {
  @BooleanProperty({
    description: '是否存在关联任务',
    example: true,
    validation: false,
  })
  exists!: boolean

  @NumberProperty({
    description: '关联任务总数',
    example: 2,
    validation: false,
  })
  relatedTaskCount!: number

  @NumberProperty({
    description: '已发布任务数',
    example: 1,
    validation: false,
  })
  publishedTaskCount!: number

  @NumberProperty({
    description: '启用中的任务数',
    example: 1,
    validation: false,
  })
  enabledTaskCount!: number

  @ArrayProperty({
    description:
      '关联任务场景类型列表（1=新手引导任务；2=日常任务；4=活动任务）',
    itemEnum: TaskTypeEnum,
    required: true,
    validation: false,
    example: [TaskTypeEnum.DAILY, TaskTypeEnum.CAMPAIGN],
  })
  sceneTypes!: TaskTypeEnum[]

  @ArrayProperty({
    description: '关联任务 ID 列表',
    itemType: 'number',
    required: true,
    validation: false,
    example: [101, 202],
  })
  taskIds!: number[]
}

export class GrowthRuleEventPageItemDto {
  @EnumProperty({
    description: GROWTH_RULE_TYPE_RULE_DTO_DESCRIPTION,
    example: GrowthRuleTypeEnum.CREATE_TOPIC,
    enum: GrowthRuleTypeEnum,
    validation: false,
  })
  ruleType!: GrowthRuleTypeEnum

  @StringProperty({
    description: '成长事件英文 key',
    example: 'CREATE_TOPIC',
    validation: false,
  })
  ruleKey!: string

  @StringProperty({
    description: '成长事件名称',
    example: '发表主题',
    validation: false,
  })
  eventName!: string

  @EnumProperty({
    description:
      '事件所属领域（论坛；评论；漫画作品；小说作品；漫画章节；小说章节；互动；徽章；资料；社交；举报；系统）',
    example: EventDefinitionDomainEnum.FORUM,
    enum: EventDefinitionDomainEnum,
    validation: false,
  })
  domain!: EventDefinitionDomainEnum

  @EnumProperty({
    description: '治理闸门类型（无闸门；主题审核；评论审核；举报裁决）',
    example: EventDefinitionGovernanceGateEnum.NONE,
    enum: EventDefinitionGovernanceGateEnum,
    validation: false,
  })
  governanceGate!: EventDefinitionGovernanceGateEnum

  @EnumProperty({
    description: '实现状态（已声明；已实现）',
    example: EventDefinitionImplStatusEnum.IMPLEMENTED,
    enum: EventDefinitionImplStatusEnum,
    validation: false,
  })
  implStatus!: EventDefinitionImplStatusEnum

  @BooleanProperty({
    description: '是否已正式接入 producer',
    example: true,
    validation: false,
  })
  isImplemented!: boolean

  @BooleanProperty({
    description: '是否允许配置基础奖励规则',
    example: true,
    validation: false,
  })
  isRuleConfigurable!: boolean

  @BooleanProperty({
    description: '是否支持配置经验奖励规则',
    example: true,
    validation: false,
  })
  supportsExperienceRule!: boolean

  @StringProperty({
    description: '不可配置原因；可配置时为 null',
    example: null,
    nullable: true,
    validation: false,
  })
  disabledReason!: string | null

  @BooleanProperty({
    description: '是否支持任务消费',
    example: true,
    validation: false,
  })
  supportsTaskObjective!: boolean

  @StringProperty({
    description: '基础奖励与任务 bonus 的默认叠加策略说明',
    example: '基础奖励与任务 bonus 默认可叠加；任务奖励属于额外 bonus。',
    validation: false,
  })
  rewardPolicy!: string

  @BooleanProperty({
    description: '是否已配置任一基础奖励',
    example: true,
    validation: false,
  })
  hasBaseReward!: boolean

  @BooleanProperty({
    description: '是否存在关联任务',
    example: true,
    validation: false,
  })
  hasTask!: boolean

  @ArrayProperty({
    description: '基础奖励资产规则摘要列表',
    itemClass: GrowthRuleAssetSummaryDto,
    validation: false,
  })
  assetRules!: GrowthRuleAssetSummaryDto[]

  @NestedProperty({
    description: '关联任务摘要',
    type: GrowthRuleTaskBindingSummaryDto,
    validation: false,
    nullable: false,
  })
  taskBinding!: GrowthRuleTaskBindingSummaryDto
}

export class GrowthConfigurableRewardEventOptionDto extends PickType(
  GrowthRuleEventPageItemDto,
  [
    'ruleType',
    'ruleKey',
    'eventName',
    'domain',
    'governanceGate',
    'implStatus',
    'isImplemented',
    'isRuleConfigurable',
    'supportsExperienceRule',
  ] as const,
) {}
