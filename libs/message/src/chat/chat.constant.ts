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
  /** 语音消息 */
  VOICE = 3,
  /** 视频消息 */
  VIDEO = 4,
  /** 系统消息 */
  SYSTEM = 99,
}

/** 客户端可发送的聊天消息类型枚举 */
export enum ChatSendMessageTypeEnum {
  /** 文本消息 */
  TEXT = 1,
  /** 图片消息 */
  IMAGE = 2,
  /** 语音消息 */
  VOICE = 3,
  /** 视频消息 */
  VIDEO = 4,
}

/** 客户端可发送的聊天消息类型集合 */
export const CHAT_SENDABLE_MESSAGE_TYPES = [1, 2, 3, 4] as const

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
/** 聊天消息正文最大字符数 */
export const CHAT_MESSAGE_CONTENT_MAX_LENGTH = 5000
/** 聊天客户端幂等键最大字符数 */
export const CHAT_MESSAGE_CLIENT_MESSAGE_ID_MAX_LENGTH = 64
/** 聊天消息扩展载荷最大序列化字节数 */
export const CHAT_MESSAGE_PAYLOAD_MAX_BYTES = 16 * 1024
/** 聊天消息扩展载荷最大嵌套深度 */
export const CHAT_MESSAGE_PAYLOAD_MAX_DEPTH = 6
/** 聊天服务注入令牌 */
export const MESSAGE_CHAT_SERVICE_TOKEN = 'MESSAGE_CHAT_SERVICE'
