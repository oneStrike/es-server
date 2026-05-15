import { UploadProviderEnum } from '@libs/platform/modules/upload/upload.type'

/**
 * 配置安全元数据 - 定义每个配置项的敏感字段
 * 用于自动加密存储和脱敏展示
 */
export const CONFIG_SECURITY_META: Record<
  string,
  { sensitivePaths: string[] }
> = {
  // 阿里云配置：包含短信服务密钥等敏感信息
  aliyunConfig: {
    sensitivePaths: ['accessKeyId', 'accessKeySecret'],
  },
  // 站点配置：无敏感字段
  siteConfig: {
    sensitivePaths: [],
  },
  // 维护模式配置：无敏感字段
  maintenanceConfig: {
    sensitivePaths: [],
  },
  // 内容审核策略配置：无敏感字段
  contentReviewPolicy: {
    sensitivePaths: [],
  },
  // 运营配置：无敏感字段
  operationConfig: {
    sensitivePaths: [],
  },
  // 安全配置：无敏感字段
  securityConfig: {
    sensitivePaths: [],
  },
  // 三方资源解析配置：无敏感字段
  thirdPartyResourceParseConfig: {
    sensitivePaths: [],
  },
  // 上传配置：包含七牛和 Superbed 密钥等敏感字段
  uploadConfig: {
    sensitivePaths: ['qiniu.accessKey', 'qiniu.secretKey', 'superbed.token'],
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

  // 运营配置
  operationConfig: {
    /** forum 话题（hashtag）配置 */
    forumHashtagConfig: {
      /** 话题创建模式（1=仅引用已存在且可用话题，2=正文中允许自动创建话题） */
      creationMode: 2,
    },
  },

  // 安全配置
  securityConfig: {
    /** 远程图片导入安全配置 */
    remoteImageImport: {
      /** 是否启用 DNS 不安全地址防护（默认开启） */
      enableAddressGuard: true,
    },
  },

  // 三方资源解析配置
  thirdPartyResourceParseConfig: {
    /** 是否启用三方资源解析节流（默认开启） */
    enabled: true,
    /** CopyManga API 请求最小间隔（毫秒） */
    apiIntervalMs: 3000,
    /** 三方远程图片下载最小间隔（毫秒） */
    imageIntervalMs: 3000,
    /** CopyManga host discovery 缓存 TTL（秒） */
    hostCacheTtlSeconds: 60,
    /** 每个资源解析通道允许排队的最大请求数 */
    maxQueueSize: 1000,
  },

  // 上传配置
  uploadConfig: {
    /** 默认上传提供方 */
    provider: UploadProviderEnum.LOCAL,
    /** Superbed 对非图片文件自动回落到本地 */
    superbedNonImageFallbackToLocal: true,
    qiniu: {
      /** 七牛 AccessKey（敏感字段，会加密存储） */
      accessKey: '',
      /** 七牛 SecretKey（敏感字段，会加密存储） */
      secretKey: '',
      /** 存储空间 bucket */
      bucket: '',
      /** 公开访问域名 */
      domain: '',
      /** 区域 ID，例如 z0；留空时自动查询 */
      region: '',
      /** 对象前缀 */
      pathPrefix: '',
      /** 是否使用 HTTPS */
      useHttps: true,
      /** 上传凭证有效期（秒） */
      tokenExpires: 3600,
    },
    superbed: {
      /** Superbed token（敏感字段，会加密存储） */
      token: '',
      /** 相册分类 */
      categories: '',
      /** 是否开启水印 */
      watermark: undefined as boolean | undefined,
      /** 是否开启压缩 */
      compress: undefined as boolean | undefined,
      /** 是否强制 webp */
      webp: undefined as boolean | undefined,
    },
  },
}
