/**
 * 事件定义所属业务域。
 *
 * 用于统一标识事件的主业务归属，便于 DTO、任务、成长和治理按域筛选。
 */
export enum EventDefinitionDomainEnum {
  /** 论坛域事件。 */
  FORUM = 'forum',
  /** 评论域事件。 */
  COMMENT = 'comment',
  /** 漫画作品域事件。 */
  COMIC_WORK = 'comic_work',
  /** 小说作品域事件。 */
  NOVEL_WORK = 'novel_work',
  /** 漫画章节域事件。 */
  COMIC_CHAPTER = 'comic_chapter',
  /** 小说章节域事件。 */
  NOVEL_CHAPTER = 'novel_chapter',
  /** 互动/活跃域事件。 */
  ENGAGEMENT = 'engagement',
  /** 徽章域事件。 */
  BADGE = 'badge',
  /** 用户资料域事件。 */
  PROFILE = 'profile',
  /** 社交域事件。 */
  SOCIAL = 'social',
  /** 举报域事件。 */
  REPORT = 'report',
  /** 系统运维域事件。 */
  SYSTEM = 'system',
}

/**
 * 事件涉及的标准实体类型。
 *
 * 这里只表达统一语义，不复用各业务表自己的 targetType 数值枚举。
 */
export enum EventDefinitionEntityTypeEnum {
  /** 用户实体。 */
  USER = 'user',
  /** 任务头实体。 */
  TASK = 'task',
  /** 任务实例实体。 */
  TASK_INSTANCE = 'task_instance',
  /** 论坛主题实体。 */
  FORUM_TOPIC = 'forum_topic',
  /** 论坛回复实体。 */
  FORUM_REPLY = 'forum_reply',
  /** 评论实体。 */
  COMMENT = 'comment',
  /** 漫画作品实体。 */
  COMIC_WORK = 'comic_work',
  /** 小说作品实体。 */
  NOVEL_WORK = 'novel_work',
  /** 漫画章节实体。 */
  COMIC_CHAPTER = 'comic_chapter',
  /** 小说章节实体。 */
  NOVEL_CHAPTER = 'novel_chapter',
  /** 签到记录实体。 */
  CHECK_IN = 'check_in',
  /** 徽章实体。 */
  BADGE = 'badge',
  /** 用户资料实体。 */
  USER_PROFILE = 'user_profile',
  /** 通用内容实体。 */
  CONTENT = 'content',
  /** 举报实体。 */
  REPORT = 'report',
  /** 被举报目标实体。 */
  REPORTED_TARGET = 'reported_target',
  /** 管理端操作实体。 */
  ADMIN_OPERATION = 'admin_operation',
}

/**
 * 事件是否需要经过治理闸门后才算正式成立。
 *
 * 当前覆盖主题审核、评论审核与举报裁决三类正式门控场景。
 */
export enum EventDefinitionGovernanceGateEnum {
  /** 无治理闸门。 */
  NONE = 'none',
  /** 主题审核闸门。 */
  TOPIC_APPROVAL = 'topic_approval',
  /** 评论审核闸门。 */
  COMMENT_APPROVAL = 'comment_approval',
  /** 举报裁决闸门。 */
  REPORT_JUDGEMENT = 'report_judgement',
}

/**
 * 理论上可以消费该事件定义的下游模块。
 *
 * 它表达复用边界，不代表当前已经全部完成接线。
 */
export enum EventDefinitionConsumerEnum {
  /** 成长奖励链路。 */
  GROWTH = 'growth',
  /** 任务链路。 */
  TASK = 'task',
  /** 通知链路。 */
  NOTIFICATION = 'notification',
  /** 治理链路。 */
  GOVERNANCE = 'governance',
}

/**
 * 事件定义当前的实现状态。
 *
 * - declared: 已声明稳定编码，但当前仓没有正式 producer
 * - implemented: 已有正式 producer 接入
 * - legacy_compat: 仅保留历史兼容语义，不建议继续作为新口径扩散
 */
export enum EventDefinitionImplStatusEnum {
  /** 已声明稳定编码，但当前没有正式 producer。 */
  DECLARED = 'declared',
  /** 已有正式 producer 接入。 */
  IMPLEMENTED = 'implemented',
  /** 仅保留历史兼容语义。 */
  LEGACY_COMPAT = 'legacy_compat',
}

/** 成长规则配置 DTO 中的事件编码字段说明。 */
export const GROWTH_RULE_TYPE_RULE_DTO_DESCRIPTION =
  '成长规则类型，直接复用统一事件定义编码。'

/** 成长记录 DTO 中的事件编码字段说明。 */
export const GROWTH_RULE_TYPE_RECORD_DTO_DESCRIPTION =
  '成长记录关联的事件编码，直接复用统一事件定义编码。'

/** 管理端人工操作 DTO 中的事件编码字段说明。 */
export const GROWTH_RULE_TYPE_ADMIN_ACTION_DTO_DESCRIPTION =
  '人工操作目标规则类型，直接复用统一事件定义编码。'
