import { EventDefinitionDomainEnum, EventDefinitionGovernanceGateEnum, EventDefinitionImplStatusEnum } from '@libs/growth/event-definition/event-definition.type';
import { TaskTypeEnum } from '@libs/growth/task/task.constant';
import { ArrayProperty } from '@libs/platform/decorators/validate/array-property';
import { BooleanProperty } from '@libs/platform/decorators/validate/boolean-property';
import { EnumProperty } from '@libs/platform/decorators/validate/enum-property';
import { NestedProperty } from '@libs/platform/decorators/validate/nested-property';
import { NumberProperty } from '@libs/platform/decorators/validate/number-property';
import { StringProperty } from '@libs/platform/decorators/validate/string-property';
import { PageDto } from '@libs/platform/dto/page.dto';
import { IntersectionType, PartialType } from '@nestjs/swagger'
import { GrowthRuleTypeEnum } from '../../growth-rule.constant'

export class QueryGrowthRuleEventFilterDto {
  @EnumProperty({
    description: '成长事件编码',
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
    description: '是否只看存在关联任务的事件',
    example: true,
    required: false,
  })
  hasTask?: boolean

  @BooleanProperty({
    description: '是否只看已配置基础奖励的事件（积分或经验任一存在即可）',
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
  @BooleanProperty({
    description: '该资产规则是否存在',
    example: true,
    validation: false,
  })
  exists!: boolean

  @NumberProperty({
    description: '规则 ID',
    example: 12,
    required: false,
    validation: false,
  })
  id?: number

  @BooleanProperty({
    description: '规则是否启用',
    example: true,
    required: false,
    validation: false,
  })
  isEnabled?: boolean

  @NumberProperty({
    description: '奖励值',
    example: 5,
    required: false,
    validation: false,
  })
  amount?: number

  @NumberProperty({
    description: '每日上限（0=无限制）',
    example: 0,
    required: false,
    validation: false,
  })
  dailyLimit?: number

  @NumberProperty({
    description: '总上限（0=无限制）',
    example: 0,
    required: false,
    validation: false,
  })
  totalLimit?: number

  @StringProperty({
    description: '规则备注',
    example: '用户发帖基础奖励',
    required: false,
    validation: false,
  })
  remark?: string
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
    description: '关联任务场景类型列表',
    itemType: 'number',
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
    description: '成长事件编码',
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
    description: '事件所属领域',
    example: EventDefinitionDomainEnum.FORUM,
    enum: EventDefinitionDomainEnum,
    validation: false,
  })
  domain!: EventDefinitionDomainEnum

  @EnumProperty({
    description: '治理闸门类型',
    example: EventDefinitionGovernanceGateEnum.NONE,
    enum: EventDefinitionGovernanceGateEnum,
    validation: false,
  })
  governanceGate!: EventDefinitionGovernanceGateEnum

  @EnumProperty({
    description: '实现状态',
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

  @NestedProperty({
    description: '积分基础奖励规则摘要',
    type: GrowthRuleAssetSummaryDto,
    validation: false,
    nullable: false,
  })
  pointRule!: GrowthRuleAssetSummaryDto

  @NestedProperty({
    description: '经验基础奖励规则摘要',
    type: GrowthRuleAssetSummaryDto,
    validation: false,
    nullable: false,
  })
  experienceRule!: GrowthRuleAssetSummaryDto

  @NestedProperty({
    description: '关联任务摘要',
    type: GrowthRuleTaskBindingSummaryDto,
    validation: false,
    nullable: false,
  })
  taskBinding!: GrowthRuleTaskBindingSummaryDto
}
