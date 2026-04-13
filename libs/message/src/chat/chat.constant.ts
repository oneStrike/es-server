/** 聊天会话成员角色枚举 */
export enum ChatConversationMemberRoleEnum {
  /** 所有者 */
  OWNER = 1,
  /** 普通成员 */
  MEMBER = 2,
}

/** 聊天消息类型枚举 */
export enum ChatMessageTypeEnum {
  /** 文本消息 */
  TEXT = 1,
  /** 图片消息 */
  IMAGE = 2,
  /** 系统消息 */
  SYSTEM = 3,
}

/** 聊天消息状态枚举 */
export enum ChatMessageStatusEnum {
  /** 正常 */
  NORMAL = 1,
  /** 已撤回 */
  REVOKED = 2,
  /** 已删除 */
  DELETED = 3,
}

/** 聊天消息分页默认条数 */
export const CHAT_MESSAGE_PAGE_LIMIT_DEFAULT = 20
/** 聊天消息分页最大条数 */
export const CHAT_MESSAGE_PAGE_LIMIT_MAX = 100
/** 聊天服务注入令牌 */
export const MESSAGE_CHAT_SERVICE_TOKEN = 'MESSAGE_CHAT_SERVICE'
