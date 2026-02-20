/**
 * 论坛配置常量与枚举定义
 */
import type { ForumConfig } from '@libs/base/database'

/**
 * 论坛默认配置
 */
export const DEFAULT_FORUM_CONFIG: Omit<
  ForumConfig,
  'id' | 'createdAt' | 'updatedAt' | 'updatedById'
> = {
  /** 网站名称 */
  siteName: '我的社区',
  /** 网站描述 */
  siteDescription: '',
  /** 网站关键词 */
  siteKeywords: '',
  /** 网站 Logo 地址 */
  siteLogo: '',
  /** 网站图标地址 */
  siteFavicon: '',
  /** 联系邮箱 */
  contactEmail: '',
  /** ICP 备案号 */
  icpNumber: '',
  /** 主题标题最大长度（单位：字符） */
  topicTitleMaxLength: 200,
  /** 主题内容最大长度（单位：字符） */
  topicContentMaxLength: 10000,
  /** 回复内容最大长度（单位：字符） */
  replyContentMaxLength: 5000,
  /** 审核策略（取值见 ForumReviewPolicyEnum） */
  reviewPolicy: 1,
  /** 允许匿名查看 */
  allowAnonymousView: true,
  /** 允许匿名发帖 */
  allowAnonymousPost: false,
  /** 允许匿名回复 */
  allowAnonymousReply: false,
  /** 允许用户注册 */
  allowUserRegister: true,
  /** 注册需要邮箱验证 */
  registerRequireEmailVerify: true,
  /** 注册需要手机验证 */
  registerRequirePhoneVerify: false,
  /** 用户名最小长度（单位：字符） */
  usernameMinLength: 3,
  /** 用户名最大长度（单位：字符） */
  usernameMaxLength: 20,
  /** 签名最大长度（单位：字符） */
  signatureMaxLength: 200,
  /** 个人简介最大长度（单位：字符） */
  bioMaxLength: 500,
  /** 新用户默认积分（单位：分） */
  defaultPointsForNewUser: 100,
  /** 启用邮件通知 */
  enableEmailNotification: true,
  /** 启用应用内通知 */
  enableInAppNotification: true,
  /** 启用新主题通知 */
  enableNewTopicNotification: true,
  /** 启用新回复通知 */
  enableNewReplyNotification: true,
  /** 启用点赞通知 */
  enableLikeNotification: true,
  /** 启用收藏通知 */
  enableFavoriteNotification: true,
  /** 启用系统通知 */
  enableSystemNotification: true,
  /** 启用维护模式 */
  enableMaintenanceMode: false,
  /** 维护提示文案 */
  maintenanceMessage: '',
} as const

/**
 * 内容审核策略枚举
 */
export enum ForumReviewPolicyEnum {
  /** 不审核 */
  NONE = 0,
  /** 严格敏感词过滤 */
  SEVERE_SENSITIVE_WORD = 1,
  /** 一般敏感词过滤 */
  GENERAL_SENSITIVE_WORD = 2,
  /** 轻度敏感词过滤 */
  MILD_SENSITIVE_WORD = 3,
  /** 人工审核 */
  MANUAL = 4,
}

/**
 * 变更类型枚举
 */
export enum ChangeTypeEnum {
  /** 创建 */
  CREATE = 'create',
  /** 更新 */
  UPDATE = 'update',
  /** 恢复 */
  RESTORE = 'restore',
}
