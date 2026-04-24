import {
  EventDefinitionDomainEnum,
  EventDefinitionGovernanceGateEnum,
  EventDefinitionImplStatusEnum,
} from '@libs/growth/event-definition/event-definition.constant'
import { GrowthRewardRuleAssetTypeEnum } from '@libs/growth/reward-rule/reward-rule.constant'
import { TaskTypeEnum } from '@libs/growth/task/task.constant'
import { ArrayProperty, BooleanProperty, EnumProperty, NestedProperty, NumberProperty, StringProperty } from '@libs/platform/decorators'

import { PageDto } from '@libs/platform/dto'
import { IntersectionType, PartialType } from '@nestjs/swagger'
import { GrowthRuleTypeEnum } from '../../growth-rule.constant'

export class QueryGrowthRuleEventFilterDto {
  @EnumProperty({
    description:
      '成长事件编码（1=发表主题；2=发表回复；3=主题被点赞；4=回复被点赞；5=主题被收藏；6=每日签到；7=管理员操作；8=主题被浏览；9=主题举报；16=帖子被评论；10=发表评论；11=评论被点赞；12=评论举报；100=漫画作品浏览；101=漫画作品点赞；102=漫画作品收藏；103=漫画作品举报；104=漫画作品评论；200=小说作品浏览；201=小说作品点赞；202=小说作品收藏；203=小说作品举报；204=小说作品评论；300=漫画章节阅读；301=漫画章节点赞；302=漫画章节购买；303=漫画章节下载；304=漫画章节兑换；305=漫画章节举报；306=漫画章节评论；400=小说章节阅读；401=小说章节点赞；402=小说章节购买；403=小说章节下载；404=小说章节兑换；405=小说章节举报；406=小说章节评论；600=获得徽章；601=资料完善；602=头像上传；700=关注用户；701=被关注；702=分享内容；703=邀请用户；800=举报有效；801=举报无效）',
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
    description: '资产键；积分/经验为空字符串，扩展资产使用稳定业务键',
    example: '',
    required: false,
    validation: false,
  })
  assetKey?: string

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
    description:
      '成长事件编码（1=发表主题；2=发表回复；3=主题被点赞；4=回复被点赞；5=主题被收藏；6=每日签到；7=管理员操作；8=主题被浏览；9=主题举报；16=帖子被评论；10=发表评论；11=评论被点赞；12=评论举报；100=漫画作品浏览；101=漫画作品点赞；102=漫画作品收藏；103=漫画作品举报；104=漫画作品评论；200=小说作品浏览；201=小说作品点赞；202=小说作品收藏；203=小说作品举报；204=小说作品评论；300=漫画章节阅读；301=漫画章节点赞；302=漫画章节购买；303=漫画章节下载；304=漫画章节兑换；305=漫画章节举报；306=漫画章节评论；400=小说章节阅读；401=小说章节点赞；402=小说章节购买；403=小说章节下载；404=小说章节兑换；405=小说章节举报；406=小说章节评论；600=获得徽章；601=资料完善；602=头像上传；700=关注用户；701=被关注；702=分享内容；703=邀请用户；800=举报有效；801=举报无效）',
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
      '事件所属领域（forum=论坛；comment=评论；comic_work=漫画作品；novel_work=小说作品；comic_chapter=漫画章节；novel_chapter=小说章节；engagement=互动；badge=徽章；profile=资料；social=社交；report=举报；system=系统）',
    example: EventDefinitionDomainEnum.FORUM,
    enum: EventDefinitionDomainEnum,
    validation: false,
  })
  domain!: EventDefinitionDomainEnum

  @EnumProperty({
    description:
      '治理闸门类型（none=无闸门；topic_approval=主题审核；comment_approval=评论审核；report_judgement=举报裁决）',
    example: EventDefinitionGovernanceGateEnum.NONE,
    enum: EventDefinitionGovernanceGateEnum,
    validation: false,
  })
  governanceGate!: EventDefinitionGovernanceGateEnum

  @EnumProperty({
    description:
      '实现状态（declared=已声明；implemented=已实现；legacy_compat=历史兼容）',
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
