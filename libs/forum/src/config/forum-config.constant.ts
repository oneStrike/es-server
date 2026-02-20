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
  siteName: '我的社区', // 网站名称
  siteDescription: '', // 网站描述
  siteKeywords: '', // 网站关键词
  siteLogo: '', // 网站Logo
  siteFavicon: '', // 网站图标
  contactEmail: '', // 联系邮箱
  icpNumber: '', // ICP备案号
  topicTitleMaxLength: 200, // 主题标题最大长度
  topicContentMaxLength: 10000, // 主题内容最大长度
  replyContentMaxLength: 5000, // 回复内容最大长度
  reviewPolicy: 1, // 审核策略
  allowAnonymousView: true, // 允许匿名查看
  allowAnonymousPost: false, // 允许匿名发帖
  allowAnonymousReply: false, // 允许匿名回复
  allowUserRegister: true, // 允许用户注册
  registerRequireEmailVerify: true, // 注册需要邮箱验证
  registerRequirePhoneVerify: false, // 注册需要手机验证
  usernameMinLength: 3, // 用户名最小长度
  usernameMaxLength: 20, // 用户名最大长度
  signatureMaxLength: 200, // 签名最大长度
  bioMaxLength: 500, // 个人简介最大长度
  defaultPointsForNewUser: 100, // 新用户默认积分
  enableEmailNotification: true, // 启用邮件通知
  enableInAppNotification: true, // 启用应用内通知
  enableNewTopicNotification: true, // 启用新主题通知
  enableNewReplyNotification: true, // 启用新回复通知
  enableLikeNotification: true, // 启用点赞通知
  enableFavoriteNotification: true, // 启用收藏通知
  enableSystemNotification: true, // 启用系统通知
  enableMaintenanceMode: false, // 启用维护模式
  maintenanceMessage: '', // 维护消息
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
