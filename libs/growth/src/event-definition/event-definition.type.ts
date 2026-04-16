import type {
  GrowthRuleTypeEnum,
  GrowthRuleTypeKey,
} from '../growth-rule.constant'

/**
 * 事件定义所属业务域。
 * 用于统一标识事件的主业务归属，便于 DTO、任务、成长和治理按域筛选。
 */
export enum EventDefinitionDomainEnum {
  FORUM = 'forum',
  COMMENT = 'comment',
  COMIC_WORK = 'comic_work',
  NOVEL_WORK = 'novel_work',
  COMIC_CHAPTER = 'comic_chapter',
  NOVEL_CHAPTER = 'novel_chapter',
  ENGAGEMENT = 'engagement',
  BADGE = 'badge',
  PROFILE = 'profile',
  SOCIAL = 'social',
  REPORT = 'report',
  SYSTEM = 'system',
}

/**
 * 事件涉及的标准实体类型。
 * 这里只表达统一语义，不复用各业务表自己的 targetType 数值枚举。
 */
export enum EventDefinitionEntityTypeEnum {
  USER = 'user',
  TASK = 'task',
  TASK_ASSIGNMENT = 'task_assignment',
  FORUM_TOPIC = 'forum_topic',
  FORUM_REPLY = 'forum_reply',
  COMMENT = 'comment',
  COMIC_WORK = 'comic_work',
  NOVEL_WORK = 'novel_work',
  COMIC_CHAPTER = 'comic_chapter',
  NOVEL_CHAPTER = 'novel_chapter',
  CHECK_IN = 'check_in',
  BADGE = 'badge',
  USER_PROFILE = 'user_profile',
  CONTENT = 'content',
  REPORT = 'report',
  REPORTED_TARGET = 'reported_target',
  ADMIN_OPERATION = 'admin_operation',
}

/**
 * 事件是否需要经过治理闸门后才算正式成立。
 * 当前覆盖主题审核、评论审核与举报裁决三类正式门控场景。
 */
export enum EventDefinitionGovernanceGateEnum {
  NONE = 'none',
  TOPIC_APPROVAL = 'topic_approval',
  COMMENT_APPROVAL = 'comment_approval',
  REPORT_JUDGEMENT = 'report_judgement',
}

/**
 * 理论上可以消费该事件定义的下游模块。
 * 它表达复用边界，不代表当前已经全部完成接线。
 */
export enum EventDefinitionConsumerEnum {
  GROWTH = 'growth',
  TASK = 'task',
  NOTIFICATION = 'notification',
  GOVERNANCE = 'governance',
}

/**
 * 事件定义当前的实现状态。
 * - declared: 已声明稳定编码，但当前仓没有正式 producer
 * - implemented: 已有正式 producer 接入
 * - legacy_compat: 仅保留历史兼容语义，不建议继续作为新口径扩散
 */
export enum EventDefinitionImplStatusEnum {
  DECLARED = 'declared',
  IMPLEMENTED = 'implemented',
  LEGACY_COMPAT = 'legacy_compat',
}

/**
 * 单条事件定义。
 * 作为任务、成长、通知与治理共享的统一元数据事实源。
 */
/** 稳定领域类型 `EventDefinition`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface EventDefinition {
  code: GrowthRuleTypeEnum
  key: GrowthRuleTypeKey
  label: string
  domain: EventDefinitionDomainEnum
  subjectType: EventDefinitionEntityTypeEnum
  targetType: EventDefinitionEntityTypeEnum
  governanceGate: EventDefinitionGovernanceGateEnum
  consumers: ReadonlyArray<EventDefinitionConsumerEnum>
  implStatus: EventDefinitionImplStatusEnum
  isRuleConfigurable: boolean
}

/**
 * 事件定义映射表。
 * 使用稳定数值编码作为唯一索引键。
 */
/** 稳定领域类型 `EventDefinitionMap`。仅供内部领域/服务链路复用，避免重复定义。 */
export type EventDefinitionMap = Record<GrowthRuleTypeEnum, EventDefinition>

/**
 * 事件定义列表查询条件。
 * 当前重点支持已实现、可配置与下游复用筛选。
 */
/** 稳定领域类型 `ListEventDefinitionFilters`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface ListEventDefinitionFilters {
  domain?: EventDefinitionDomainEnum
  governanceGate?: EventDefinitionGovernanceGateEnum
  consumer?: EventDefinitionConsumerEnum
  implStatus?: EventDefinitionImplStatusEnum
  isImplemented?: boolean
  isRuleConfigurable?: boolean
}
