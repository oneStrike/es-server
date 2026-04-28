/**
 * 版主操作日志目标类型。
 */
export enum ForumModeratorActionTargetTypeEnum {
  /** 论坛主题 */
  TOPIC = 1,
  /** 论坛评论 */
  COMMENT = 2,
}

/**
 * 版主操作日志动作类型。
 * 统一覆盖当前 moderator 已接入的 topic/comment 治理动作。
 */
export enum ForumModeratorActionTypeEnum {
  /** 置顶主题 */
  PIN_TOPIC = 1,
  /** 取消置顶主题 */
  UNPIN_TOPIC = 2,
  /** 加精主题 */
  FEATURE_TOPIC = 3,
  /** 取消加精主题 */
  UNFEATURE_TOPIC = 4,
  /** 锁定主题 */
  LOCK_TOPIC = 5,
  /** 取消锁定主题 */
  UNLOCK_TOPIC = 6,
  /** 删除主题 */
  DELETE_TOPIC = 7,
  /** 移动主题 */
  MOVE_TOPIC = 8,
  /** 审核主题 */
  AUDIT_TOPIC = 9,
  /** 删除评论 */
  DELETE_COMMENT = 10,
  /** 隐藏主题 */
  HIDE_TOPIC = 11,
  /** 取消隐藏主题 */
  UNHIDE_TOPIC = 12,
  /** 审核评论 */
  AUDIT_COMMENT = 13,
  /** 隐藏评论 */
  HIDE_COMMENT = 14,
  /** 取消隐藏评论 */
  UNHIDE_COMMENT = 15,
}
