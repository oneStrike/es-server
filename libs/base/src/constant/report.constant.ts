/**
 * 举报状态枚举。
 *
 * 说明：
 * - 与数据库中的 `user_report.status` 小整数字段一一对应
 * - 不再使用字符串状态，避免查询与统计时类型漂移
 */
export enum ReportStatusEnum {
  /** 待处理 */
  PENDING = 1,
  /** 处理中 */
  PROCESSING = 2,
  /** 已处理 */
  RESOLVED = 3,
  /** 已驳回 */
  REJECTED = 4,
}

/**
 * 举报状态中文名称映射。
 */
export const ReportStatusNames: Record<ReportStatusEnum, string> = {
  [ReportStatusEnum.PENDING]: '待处理',
  [ReportStatusEnum.PROCESSING]: '处理中',
  [ReportStatusEnum.RESOLVED]: '已处理',
  [ReportStatusEnum.REJECTED]: '已驳回',
}

/**
 * 举报原因类型枚举。
 *
 * 说明：
 * - 与数据库中的 `user_report.reason_type` 小整数字段一一对应
 * - `OTHER` 预留为兜底原因，便于后续扩展自定义描述
 */
export enum ReportReasonEnum {
  /** 垃圾信息 */
  SPAM = 1,
  /** 不当内容 */
  INAPPROPRIATE_CONTENT = 2,
  /** 骚扰行为 */
  HARASSMENT = 3,
  /** 版权问题 */
  COPYRIGHT = 4,
  /** 其他原因 */
  OTHER = 99,
}

/**
 * 举报原因中文名称映射。
 */
export const ReportReasonNames: Record<ReportReasonEnum, string> = {
  [ReportReasonEnum.SPAM]: '垃圾信息',
  [ReportReasonEnum.INAPPROPRIATE_CONTENT]: '不当内容',
  [ReportReasonEnum.HARASSMENT]: '骚扰行为',
  [ReportReasonEnum.COPYRIGHT]: '版权问题',
  [ReportReasonEnum.OTHER]: '其他',
}

/**
 * 举报目标类型枚举。
 *
 * 说明：
 * - 与数据库中的 `user_report.target_type` 小整数字段一一对应
 * - 作品与章节直接区分漫画、小说，避免统计时还要回查业务表
 * - 论坛回复统一并入 `COMMENT`，通过 `sceneType + commentLevel` 判断
 */
export enum ReportTargetTypeEnum {
  /** 漫画作品 */
  COMIC = 1,
  /** 小说作品 */
  NOVEL = 2,
  /** 漫画章节 */
  COMIC_CHAPTER = 3,
  /** 小说章节 */
  NOVEL_CHAPTER = 4,
  /** 论坛主题 */
  FORUM_TOPIC = 5,
  /** 评论 */
  COMMENT = 6,
  /** 用户 */
  USER = 7,
}

/**
 * 举报目标中文名称映射。
 */
export const ReportTargetTypeNames: Record<ReportTargetTypeEnum, string> = {
  [ReportTargetTypeEnum.COMIC]: '漫画作品',
  [ReportTargetTypeEnum.NOVEL]: '小说作品',
  [ReportTargetTypeEnum.COMIC_CHAPTER]: '漫画章节',
  [ReportTargetTypeEnum.NOVEL_CHAPTER]: '小说章节',
  [ReportTargetTypeEnum.FORUM_TOPIC]: '论坛主题',
  [ReportTargetTypeEnum.COMMENT]: '评论',
  [ReportTargetTypeEnum.USER]: '用户',
}
