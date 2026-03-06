/**
 * 配置安全元数据 - 定义每个配置项的敏感字段
 * 用于自动加密存储和脱敏展示
 */
export const CONFIG_SECURITY_META: Record<
  string,
  { sensitiveFields: string[] }
> = {
  // 阿里云配置：包含短信服务密钥等敏感信息
  aliyunConfig: {
    sensitiveFields: ['accessKeyId', 'accessKeySecret'],
  },
  // 站点配置：无敏感字段
  siteConfig: {
    sensitiveFields: [],
  },
  // 维护模式配置：无敏感字段
  maintenanceConfig: {
    sensitiveFields: [],
  },
  // 内容审核策略配置：无敏感字段
  contentReviewPolicy: {
    sensitiveFields: [],
  },
}

/** 缓存键名 */
export const CACHE_KEY = {
  /** 系统配置主缓存键 */
  CONFIG: 'system-config',
}

/** 缓存过期时间（单位：秒） */
export const CACHE_TTL = {
  /** 默认缓存时间：1小时 */
  DEFAULT: 3600,
  /** 短缓存时间：10分钟，用于可能频繁变化的配置 */
  SHORT: 600,
  /** 长缓存时间：2小时，用于相对稳定的配置 */
  LONG: 7200,
  /** 空值缓存时间：5分钟，防止缓存穿透 */
  NULL_VALUE: 300,
}

/**
 * 默认系统配置
 * 当数据库中无配置或配置不完整时使用这些默认值
 */
export const DEFAULT_CONFIG = {
  // 阿里云配置
  aliyunConfig: {
    /** 阿里云 AccessKey ID - API身份标识（敏感字段，会加密存储） */
    accessKeyId: '',
    /** 阿里云 AccessKey Secret - API请求签名密钥（敏感字段，会加密存储） */
    accessKeySecret: '',
    // 短信服务配置
    sms: {
      /** 阿里云短信服务端点（默认：dypnsapi.aliyuncs.com） */
      endpoint: 'dypnsapi.aliyuncs.com',
      /** 短信签名名称（空字符串表示未配置） */
      signName: '',
      /** 默认短信模板编码（用于发送验证码） */
      templateCode: '100001',
      /** 验证码长度（默认6位） */
      verifyCodeLength: 6,
      /** 验证码过期时间（默认300秒=5分钟） */
      verifyCodeExpire: 300,
    },
  },

  // 站点基础配置
  siteConfig: {
    /** 站点名称 */
    siteName: '',
    /** 站点描述 */
    siteDescription: '',
    /** 站点关键词（SEO用） */
    siteKeywords: '',
    /** 站点Logo URL */
    siteLogo: '',
    /** 站点图标 URL */
    siteFavicon: '',
    /** 联系邮箱 */
    contactEmail: '',
    /** ICP备案号 */
    icpNumber: '',
  },

  // 维护模式配置
  maintenanceConfig: {
    /** 是否启用维护模式（默认关闭） */
    enableMaintenanceMode: false,
    /** 维护模式提示信息 */
    maintenanceMessage: '系统维护中，请稍后再试',
  },

  // 内容审核策略配置
  contentReviewPolicy: {
    /** 严重敏感词处理策略 */
    severeAction: {
      /** 审核状态：0=待审核，1=已通过，2=已拒绝（默认：拒绝） */
      auditStatus: 2,
      /** 是否隐藏（默认：隐藏） */
      isHidden: true,
    },
    /** 一般敏感词处理策略 */
    generalAction: {
      /** 审核状态：0=待审核，1=已通过，2=已拒绝（默认：待审核） */
      auditStatus: 0,
      /** 是否隐藏（默认：不隐藏） */
      isHidden: false,
    },
    /** 轻微敏感词处理策略 */
    lightAction: {
      /** 审核状态：0=待审核，1=已通过，2=已拒绝（默认：通过） */
      auditStatus: 1,
      /** 是否隐藏（默认：不隐藏） */
      isHidden: false,
    },
    /** 是否记录敏感词命中明细（默认：记录） */
    recordHits: true,
  },
}
