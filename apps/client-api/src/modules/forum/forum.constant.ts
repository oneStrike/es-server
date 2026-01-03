/**
 * 论坛模块常量定义
 */

/// 论坛审核状态枚举
export enum ForumAuditStatusEnum {
  /** 待审核 */
  PENDING = 0,
  /** 已通过 */
  APPROVED = 1,
  /** 已拒绝 */
  REJECTED = 2,
}

/// 论坛积分变化类型枚举
export enum ForumPointObjectTypeEnum {
  /** 主题 */
  TOPIC = 1,
  /** 回复 */
  REPLY = 2,
  /** 签到 */
  CHECK_IN = 3,
  /** 点赞 */
  LIKE = 4,
  /** 收藏 */
  FAVORITE = 5,
  /** 管理员操作 */
  ADMIN = 6,
}

/// 论坛通知类型枚举
export enum ForumNotificationTypeEnum {
  /** 回复通知 */
  REPLY = 1,
  /** 点赞通知 */
  LIKE = 2,
  /** 收藏通知 */
  FAVORITE = 3,
  /** 系统通知 */
  SYSTEM = 4,
  /** 版主通知 */
  MODERATOR = 5,
}
