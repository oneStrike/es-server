/**
 * 审核相关常量定义
 * 统一审核状态与审核角色枚举
 */

/**
 * 审核状态枚举
 * 用于评论、主题、回复等内容的审核流程状态
 */
export enum AuditStatusEnum {
  /** 待审核 - 内容已提交，等待审核 */
  PENDING = 0,
  /** 已通过 - 审核通过，内容可见 */
  APPROVED = 1,
  /** 已拒绝 - 审核拒绝，内容不可见 */
  REJECTED = 2,
}

/**
 * 交互目标类型枚举
 * 用于标识用户交互操作的目标对象类型
 */
export enum InteractionTargetTypeEnum {
  /** 漫画 - 漫画作品 */
  COMIC = 1,
  /** 小说 - 小说作品 */
  NOVEL = 2,
  /** 漫画章节 - 漫画作品的章节 */
  COMIC_CHAPTER = 3,
  /** 小说章节 - 小说作品的章节 */
  NOVEL_CHAPTER = 4,
  /** 论坛主题 - 论坛板块中的帖子 */
  FORUM_TOPIC = 5,
}

/**
 * 审核状态名称映射
 */
export const AuditStatusNames: Record<AuditStatusEnum, string> = {
  [AuditStatusEnum.PENDING]: '待审核',
  [AuditStatusEnum.APPROVED]: '已通过',
  [AuditStatusEnum.REJECTED]: '已拒绝',
}

/**
 * 审核角色枚举
 * 用于标识执行审核操作的角色类型
 */
export enum AuditRoleEnum {
  /** 版主 - 论坛版块管理员 */
  MODERATOR = 0,
  /** 管理员 - 系统管理员 */
  ADMIN = 1,
}

/**
 * 审核角色名称映射
 */
export const AuditRoleNames: Record<AuditRoleEnum, string> = {
  [AuditRoleEnum.MODERATOR]: '版主',
  [AuditRoleEnum.ADMIN]: '管理员',
}
