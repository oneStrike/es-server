import { AuditStatusEnum } from '@libs/platform/constant';
import { BooleanProperty, EnumProperty, NestedProperty, NumberProperty, StringProperty } from '@libs/platform/decorators';
import { BaseDto, IdDto } from '@libs/platform/dto';
import { UploadProviderEnum } from '@libs/platform/modules/upload/upload.types'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'

// ============================================================================
// 阿里云配置
// ============================================================================

/**
 * 阿里云短信服务配置
 */
export class AliyunSmsConfigDto {
  @StringProperty({
    description: '短信服务端点',
    example: 'dypnsapi.aliyuncs.com',
    required: false,
  })
  endpoint?: string

  @StringProperty({
    description: '短信签名名称',
    example: '阿里云',
    required: false,
  })
  signName?: string

  @NumberProperty({
    description: '验证码长度',
    example: 6,
    default: 6,
    required: false,
  })
  verifyCodeLength?: number

  @NumberProperty({
    description: '验证码过期时间（秒）',
    example: 300,
    default: 300,
    required: false,
  })
  verifyCodeExpire?: number
}

/**
 * 阿里云配置
 */
export class AliyunConfigDto {
  @StringProperty({
    description: 'AccessKey ID（敏感字段，前端输入明文或 RSA 加密值）',
    example: 'LTAI...',
    required: false,
  })
  accessKeyId?: string

  @StringProperty({
    description: 'AccessKey Secret（敏感字段，前端输入明文或 RSA 加密值）',
    example: 'secret...',
    required: false,
  })
  accessKeySecret?: string

  @NestedProperty({
    description: '短信服务配置',
    type: AliyunSmsConfigDto,
    required: false,
    nullable: false,
  })
  sms?: AliyunSmsConfigDto | null
}

// ============================================================================
// 站点配置
// ============================================================================

/**
 * 站点基础配置
 */
export class SiteConfigDto {
  @StringProperty({
    description: '站点名称',
    example: '示例站点',
    required: false,
  })
  siteName?: string

  @StringProperty({
    description: '站点描述',
    example: '这是一个示例站点',
    required: false,
  })
  siteDescription?: string

  @StringProperty({
    description: '站点关键词（SEO用）',
    example: '漫画,社区',
    required: false,
  })
  siteKeywords?: string

  @StringProperty({
    description: '站点Logo URL',
    example: 'https://example.com/logo.png',
    required: false,
  })
  siteLogo?: string

  @StringProperty({
    description: '站点图标 URL',
    example: 'https://example.com/favicon.ico',
    required: false,
  })
  siteFavicon?: string

  @StringProperty({
    description: '联系邮箱',
    example: 'support@example.com',
    required: false,
  })
  contactEmail?: string

  @StringProperty({
    description: 'ICP备案号',
    example: '粤ICP备xxxxxx号',
    required: false,
  })
  icpNumber?: string
}

// ============================================================================
// 维护模式配置
// ============================================================================

/**
 * 维护模式配置
 */
export class MaintenanceConfigDto {
  @BooleanProperty({
    description: '是否启用维护模式',
    example: false,
    default: false,
    required: false,
  })
  enableMaintenanceMode?: boolean

  @StringProperty({
    description: '维护模式提示信息',
    example: '系统维护中，请稍后再试',
    required: false,
  })
  maintenanceMessage?: string
}

// ============================================================================
// 内容审核策略配置
// ============================================================================

/**
 * 敏感词处理策略
 */
export class ContentReviewActionDto {
  @EnumProperty({
    description: '审核状态（0=待审核；1=已通过；2=已拒绝）',
    example: AuditStatusEnum.REJECTED,
    enum: AuditStatusEnum,
    required: false,
  })
  auditStatus?: AuditStatusEnum

  @BooleanProperty({
    description: '是否隐藏',
    example: true,
    default: false,
    required: false,
  })
  isHidden?: boolean
}

/**
 * 内容审核策略配置
 */
export class ContentReviewPolicyDto {
  @NestedProperty({
    description: '严重敏感词处理策略',
    type: ContentReviewActionDto,
    required: false,
    nullable: false,
  })
  severeAction?: ContentReviewActionDto | null

  @NestedProperty({
    description: '一般敏感词处理策略',
    type: ContentReviewActionDto,
    required: false,
    nullable: false,
  })
  generalAction?: ContentReviewActionDto | null

  @NestedProperty({
    description: '轻微敏感词处理策略',
    type: ContentReviewActionDto,
    required: false,
    nullable: false,
  })
  lightAction?: ContentReviewActionDto | null

  @BooleanProperty({
    description: '是否记录敏感词命中明细',
    example: true,
    default: true,
    required: false,
  })
  recordHits?: boolean
}

// ============================================================================
// 上传配置
// ============================================================================

export class QiniuUploadConfigDto {
  @StringProperty({
    description: '七牛 AccessKey（敏感字段，前端输入明文或 RSA 加密值）',
    example: 'your-access-key',
    required: false,
  })
  accessKey?: string

  @StringProperty({
    description: '七牛 SecretKey（敏感字段，前端输入明文或 RSA 加密值）',
    example: 'your-secret-key',
    required: false,
  })
  secretKey?: string

  @StringProperty({
    description: '七牛存储空间 bucket',
    example: 'es-public',
    required: false,
  })
  bucket?: string

  @StringProperty({
    description: '七牛公开访问域名',
    example: 'https://cdn.example.com',
    required: false,
  })
  domain?: string

  @StringProperty({
    description: '七牛区域 ID，留空时自动查询',
    example: 'z0',
    required: false,
  })
  region?: string

  @StringProperty({
    description: '七牛对象前缀',
    example: 'uploads',
    required: false,
  })
  pathPrefix?: string

  @BooleanProperty({
    description: '是否使用 HTTPS',
    example: true,
    default: true,
    required: false,
  })
  useHttps?: boolean

  @NumberProperty({
    description: '上传凭证有效期（秒）',
    example: 3600,
    default: 3600,
    required: false,
  })
  tokenExpires?: number
}

export class SuperbedUploadConfigDto {
  @StringProperty({
    description: 'Superbed token（敏感字段，前端输入明文或 RSA 加密值）',
    example: 'your-superbed-token',
    required: false,
  })
  token?: string

  @StringProperty({
    description: 'Superbed 相册分类，多个使用英文逗号分隔',
    example: 'cover,chapter',
    required: false,
  })
  categories?: string

  @BooleanProperty({
    description: '是否开启水印',
    example: false,
    required: false,
  })
  watermark?: boolean

  @BooleanProperty({
    description: '是否开启压缩',
    example: true,
    required: false,
  })
  compress?: boolean

  @BooleanProperty({
    description: '是否强制转 webp',
    example: false,
    required: false,
  })
  webp?: boolean
}

export class UploadConfigDto {
  @EnumProperty({
    description: '上传提供方（local=本地存储；qiniu=七牛云存储；superbed=Superbed图床）',
    enum: UploadProviderEnum,
    example: UploadProviderEnum.LOCAL,
    required: false,
  })
  provider?: UploadProviderEnum

  @BooleanProperty({
    description: '当 provider 为 superbed 时，非图片文件是否自动回落本地',
    example: true,
    default: true,
    required: false,
  })
  superbedNonImageFallbackToLocal?: boolean

  @NestedProperty({
    description: '七牛上传配置',
    type: QiniuUploadConfigDto,
    required: false,
    nullable: false,
  })
  qiniu?: QiniuUploadConfigDto | null

  @NestedProperty({
    description: 'Superbed 上传配置',
    type: SuperbedUploadConfigDto,
    required: false,
    nullable: false,
  })
  superbed?: SuperbedUploadConfigDto | null
}

// ============================================================================
// 系统配置总入口
// ============================================================================

/**
 * 系统配置 DTO
 * 用于管理端获取和更新系统配置
 */
export class BaseSystemConfigDto extends BaseDto {
  @NumberProperty({
    description: '最后修改人 ID',
    example: 1,
    required: false,
  })
  updatedById?: number | null

  @NestedProperty({
    description: '阿里云配置',
    type: AliyunConfigDto,
    example: {
      accessKeyId: 'LTAI...',
      accessKeySecret: 'secret...',
      sms: {
        endpoint: 'dypnsapi.aliyuncs.com',
        signName: '阿里云',
        verifyCodeLength: 6,
        verifyCodeExpire: 300,
      },
    },
    required: false,
    nullable: false,
  })
  aliyunConfig?: AliyunConfigDto | null

  @NestedProperty({
    description: '站点配置',
    type: SiteConfigDto,
    example: {
      siteName: '示例站点',
      siteDescription: '这是一个示例站点',
      siteKeywords: '漫画,社区',
      siteLogo: 'https://example.com/logo.png',
      siteFavicon: 'https://example.com/favicon.ico',
      contactEmail: 'support@example.com',
      icpNumber: '粤ICP备xxxxxx号',
    },
    required: false,
    nullable: false,
  })
  siteConfig?: SiteConfigDto | null

  @NestedProperty({
    description: '维护配置',
    type: MaintenanceConfigDto,
    example: {
      enableMaintenanceMode: false,
      maintenanceMessage: '系统维护中，请稍后再试',
    },
    required: false,
    nullable: false,
  })
  maintenanceConfig?: MaintenanceConfigDto | null

  @NestedProperty({
    description: '内容审核策略',
    type: ContentReviewPolicyDto,
    example: {
      severeAction: {
        auditStatus: AuditStatusEnum.REJECTED,
        isHidden: true,
      },
      generalAction: {
        auditStatus: AuditStatusEnum.PENDING,
        isHidden: false,
      },
      lightAction: {
        auditStatus: AuditStatusEnum.APPROVED,
        isHidden: false,
      },
      recordHits: true,
    },
    required: false,
    nullable: false,
  })
  contentReviewPolicy?: ContentReviewPolicyDto | null

  @NestedProperty({
    description: '上传配置',
    type: UploadConfigDto,
    example: {
      provider: UploadProviderEnum.LOCAL,
      superbedNonImageFallbackToLocal: true,
      qiniu: {
        accessKey: 'your-access-key',
        secretKey: 'your-secret-key',
        bucket: 'es-public',
        domain: 'https://cdn.example.com',
        region: 'z0',
        pathPrefix: 'uploads',
        useHttps: true,
        tokenExpires: 3600,
      },
      superbed: {
        token: 'your-superbed-token',
        categories: 'cover,chapter',
        watermark: false,
        compress: true,
        webp: false,
      },
    },
    required: false,
    nullable: false,
  })
  uploadConfig?: UploadConfigDto | null
}

export class UpdateSystemConfigDto extends IntersectionType(
  IdDto,
  PartialType(
    PickType(BaseSystemConfigDto, [
      'aliyunConfig',
      'siteConfig',
      'maintenanceConfig',
      'contentReviewPolicy',
      'uploadConfig',
    ] as const),
  ),
) {}
