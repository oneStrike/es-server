/**
 * 积分规则类型枚举
 */
export enum PointRuleTypeEnum {
  /** 签到 */
  SIGN_IN = 1,
  /** 发帖 */
  POST = 2,
  /** 回复 */
  REPLY = 3,
  /** 点赞 */
  LIKE = 4,
  /** 被点赞 */
  BE_LIKED = 5,
  /** 最佳回复 */
  BEST_REPLY = 6,
  /** 主题加精 */
  TOPIC_ESSENCE = 7,
  /** 每日访问 */
  DAILY_VISIT = 8,
}

/**
 * 积分规则类型名称映射
 */
export const PointRuleTypeNameMap: Record<PointRuleTypeEnum, string> = {
  [PointRuleTypeEnum.SIGN_IN]: '签到',
  [PointRuleTypeEnum.POST]: '发帖',
  [PointRuleTypeEnum.REPLY]: '回复',
  [PointRuleTypeEnum.LIKE]: '点赞',
  [PointRuleTypeEnum.BE_LIKED]: '被点赞',
  [PointRuleTypeEnum.BEST_REPLY]: '最佳回复',
  [PointRuleTypeEnum.TOPIC_ESSENCE]: '主题加精',
  [PointRuleTypeEnum.DAILY_VISIT]: '每日访问',
}

/**
 * 等级规则类型枚举
 */
export enum LevelRuleTypeEnum {
  /** 新手 */
  NEWBIE = 1,
  /** 初级 */
  JUNIOR = 2,
  /** 中级 */
  INTERMEDIATE = 3,
  /** 高级 */
  SENIOR = 4,
  /** 专家 */
  EXPERT = 5,
  /** 大师 */
  MASTER = 6,
}

/**
 * 等级规则类型名称映射
 */
export const LevelRuleTypeNameMap: Record<LevelRuleTypeEnum, string> = {
  [LevelRuleTypeEnum.NEWBIE]: '新手',
  [LevelRuleTypeEnum.JUNIOR]: '初级',
  [LevelRuleTypeEnum.INTERMEDIATE]: '中级',
  [LevelRuleTypeEnum.SENIOR]: '高级',
  [LevelRuleTypeEnum.EXPERT]: '专家',
  [LevelRuleTypeEnum.MASTER]: '大师',
}

/**
 * 徽章类型枚举
 */
export enum BadgeTypeEnum {
  /** 活跃 */
  ACTIVE = 1,
  /** 贡献 */
  CONTRIBUTION = 2,
  /** 荣誉 */
  HONOR = 3,
  /** 特殊 */
  SPECIAL = 4,
}

/**
 * 徽章类型名称映射
 */
export const BadgeTypeNameMap: Record<BadgeTypeEnum, string> = {
  [BadgeTypeEnum.ACTIVE]: '活跃',
  [BadgeTypeEnum.CONTRIBUTION]: '贡献',
  [BadgeTypeEnum.HONOR]: '荣誉',
  [BadgeTypeEnum.SPECIAL]: '特殊',
}

/**
 * 系统配置类型枚举
 */
export enum SystemConfigTypeEnum {
  /** 布尔值 */
  BOOLEAN = 'boolean',
  /** 数字 */
  NUMBER = 'number',
  /** 字符串 */
  STRING = 'string',
  /** JSON */
  JSON = 'json',
}

/**
 * 系统配置类型名称映射
 */
export const SystemConfigTypeNameMap: Record<SystemConfigTypeEnum, string> = {
  [SystemConfigTypeEnum.BOOLEAN]: '布尔值',
  [SystemConfigTypeEnum.NUMBER]: '数字',
  [SystemConfigTypeEnum.STRING]: '字符串',
  [SystemConfigTypeEnum.JSON]: 'JSON',
}

/**
 * 系统配置键枚举
 */
export enum SystemConfigKeyEnum {
  /** 开启注册 */
  ENABLE_REGISTRATION = 'enable_registration',
  /** 开启游客浏览 */
  ENABLE_GUEST_BROWSE = 'enable_guest_browse',
  /** 开启游客发帖 */
  ENABLE_GUEST_POST = 'enable_guest_post',
  /** 开启游客回复 */
  ENABLE_GUEST_REPLY = 'enable_guest_reply',
  /** 开启内容审核 */
  ENABLE_CONTENT_AUDIT = 'enable_content_audit',
  /** 开启敏感词过滤 */
  ENABLE_SENSITIVE_WORD_FILTER = 'enable_sensitive_word_filter',
  /** 每日发帖限制 */
  DAILY_POST_LIMIT = 'daily_post_limit',
  /** 每日回复限制 */
  DAILY_REPLY_LIMIT = 'daily_reply_limit',
  /** 每日点赞限制 */
  DAILY_LIKE_LIMIT = 'daily_like_limit',
  /** 主题最小字数 */
  TOPIC_MIN_LENGTH = 'topic_min_length',
  /** 主题最大字数 */
  TOPIC_MAX_LENGTH = 'topic_max_length',
  /** 回复最小字数 */
  REPLY_MIN_LENGTH = 'reply_min_length',
  /** 回复最大字数 */
  REPLY_MAX_LENGTH = 'reply_max_length',
  /** 文件上传大小限制(MB) */
  FILE_UPLOAD_SIZE_LIMIT = 'file_upload_size_limit',
  /** 允许的文件类型 */
  ALLOWED_FILE_TYPES = 'allowed_file_types',
  /** 图片上传大小限制(MB) */
  IMAGE_UPLOAD_SIZE_LIMIT = 'image_upload_size_limit',
  /** 允许的图片类型 */
  ALLOWED_IMAGE_TYPES = 'allowed_image_types',
  /** 开启积分系统 */
  ENABLE_POINT_SYSTEM = 'enable_point_system',
  /** 开启等级系统 */
  ENABLE_LEVEL_SYSTEM = 'enable_level_system',
  /** 开启徽章系统 */
  ENABLE_BADGE_SYSTEM = 'enable_badge_system',
  /** 开启通知系统 */
  ENABLE_NOTIFICATION_SYSTEM = 'enable_notification_system',
  /** 开启搜索功能 */
  ENABLE_SEARCH_FUNCTION = 'enable_search_function',
  /** 搜索结果每页数量 */
  SEARCH_PAGE_SIZE = 'search_page_size',
}

/**
 * 系统配置键名称映射
 */
export const SystemConfigKeyNameMap: Record<SystemConfigKeyEnum, string> = {
  [SystemConfigKeyEnum.ENABLE_REGISTRATION]: '开启注册',
  [SystemConfigKeyEnum.ENABLE_GUEST_BROWSE]: '开启游客浏览',
  [SystemConfigKeyEnum.ENABLE_GUEST_POST]: '开启游客发帖',
  [SystemConfigKeyEnum.ENABLE_GUEST_REPLY]: '开启游客回复',
  [SystemConfigKeyEnum.ENABLE_CONTENT_AUDIT]: '开启内容审核',
  [SystemConfigKeyEnum.ENABLE_SENSITIVE_WORD_FILTER]: '开启敏感词过滤',
  [SystemConfigKeyEnum.DAILY_POST_LIMIT]: '每日发帖限制',
  [SystemConfigKeyEnum.DAILY_REPLY_LIMIT]: '每日回复限制',
  [SystemConfigKeyEnum.DAILY_LIKE_LIMIT]: '每日点赞限制',
  [SystemConfigKeyEnum.TOPIC_MIN_LENGTH]: '主题最小字数',
  [SystemConfigKeyEnum.TOPIC_MAX_LENGTH]: '主题最大字数',
  [SystemConfigKeyEnum.REPLY_MIN_LENGTH]: '回复最小字数',
  [SystemConfigKeyEnum.REPLY_MAX_LENGTH]: '回复最大字数',
  [SystemConfigKeyEnum.FILE_UPLOAD_SIZE_LIMIT]: '文件上传大小限制(MB)',
  [SystemConfigKeyEnum.ALLOWED_FILE_TYPES]: '允许的文件类型',
  [SystemConfigKeyEnum.IMAGE_UPLOAD_SIZE_LIMIT]: '图片上传大小限制(MB)',
  [SystemConfigKeyEnum.ALLOWED_IMAGE_TYPES]: '允许的图片类型',
  [SystemConfigKeyEnum.ENABLE_POINT_SYSTEM]: '开启积分系统',
  [SystemConfigKeyEnum.ENABLE_LEVEL_SYSTEM]: '开启等级系统',
  [SystemConfigKeyEnum.ENABLE_BADGE_SYSTEM]: '开启徽章系统',
  [SystemConfigKeyEnum.ENABLE_NOTIFICATION_SYSTEM]: '开启通知系统',
  [SystemConfigKeyEnum.ENABLE_SEARCH_FUNCTION]: '开启搜索功能',
  [SystemConfigKeyEnum.SEARCH_PAGE_SIZE]: '搜索结果每页数量',
}

/**
 * 系统配置默认值映射
 */
export const SystemConfigDefaultValueMap: Record<SystemConfigKeyEnum, { value: string; type: SystemConfigTypeEnum }> = {
  [SystemConfigKeyEnum.ENABLE_REGISTRATION]: { value: 'true', type: SystemConfigTypeEnum.BOOLEAN },
  [SystemConfigKeyEnum.ENABLE_GUEST_BROWSE]: { value: 'true', type: SystemConfigTypeEnum.BOOLEAN },
  [SystemConfigKeyEnum.ENABLE_GUEST_POST]: { value: 'false', type: SystemConfigTypeEnum.BOOLEAN },
  [SystemConfigKeyEnum.ENABLE_GUEST_REPLY]: { value: 'false', type: SystemConfigTypeEnum.BOOLEAN },
  [SystemConfigKeyEnum.ENABLE_CONTENT_AUDIT]: { value: 'true', type: SystemConfigTypeEnum.BOOLEAN },
  [SystemConfigKeyEnum.ENABLE_SENSITIVE_WORD_FILTER]: { value: 'true', type: SystemConfigTypeEnum.BOOLEAN },
  [SystemConfigKeyEnum.DAILY_POST_LIMIT]: { value: '10', type: SystemConfigTypeEnum.NUMBER },
  [SystemConfigKeyEnum.DAILY_REPLY_LIMIT]: { value: '50', type: SystemConfigTypeEnum.NUMBER },
  [SystemConfigKeyEnum.DAILY_LIKE_LIMIT]: { value: '100', type: SystemConfigTypeEnum.NUMBER },
  [SystemConfigKeyEnum.TOPIC_MIN_LENGTH]: { value: '10', type: SystemConfigTypeEnum.NUMBER },
  [SystemConfigKeyEnum.TOPIC_MAX_LENGTH]: { value: '10000', type: SystemConfigTypeEnum.NUMBER },
  [SystemConfigKeyEnum.REPLY_MIN_LENGTH]: { value: '5', type: SystemConfigTypeEnum.NUMBER },
  [SystemConfigKeyEnum.REPLY_MAX_LENGTH]: { value: '5000', type: SystemConfigTypeEnum.NUMBER },
  [SystemConfigKeyEnum.FILE_UPLOAD_SIZE_LIMIT]: { value: '10', type: SystemConfigTypeEnum.NUMBER },
  [SystemConfigKeyEnum.ALLOWED_FILE_TYPES]: { value: '["pdf","doc","docx","xls","xlsx"]', type: SystemConfigTypeEnum.JSON },
  [SystemConfigKeyEnum.IMAGE_UPLOAD_SIZE_LIMIT]: { value: '5', type: SystemConfigTypeEnum.NUMBER },
  [SystemConfigKeyEnum.ALLOWED_IMAGE_TYPES]: { value: '["jpg","jpeg","png","gif","webp"]', type: SystemConfigTypeEnum.JSON },
  [SystemConfigKeyEnum.ENABLE_POINT_SYSTEM]: { value: 'true', type: SystemConfigTypeEnum.BOOLEAN },
  [SystemConfigKeyEnum.ENABLE_LEVEL_SYSTEM]: { value: 'true', type: SystemConfigTypeEnum.BOOLEAN },
  [SystemConfigKeyEnum.ENABLE_BADGE_SYSTEM]: { value: 'true', type: SystemConfigTypeEnum.BOOLEAN },
  [SystemConfigKeyEnum.ENABLE_NOTIFICATION_SYSTEM]: { value: 'true', type: SystemConfigTypeEnum.BOOLEAN },
  [SystemConfigKeyEnum.ENABLE_SEARCH_FUNCTION]: { value: 'true', type: SystemConfigTypeEnum.BOOLEAN },
  [SystemConfigKeyEnum.SEARCH_PAGE_SIZE]: { value: '20', type: SystemConfigTypeEnum.NUMBER },
}
