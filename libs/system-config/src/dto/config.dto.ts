import { AuditStatusEnum } from '@libs/base/constant'
import {
  BooleanProperty,
  EnumProperty,
  NestedProperty,
  NumberProperty,
  StringProperty,
} from '@libs/base/decorators'
import { IdDto } from '@libs/base/dto'
import { IntersectionType } from '@nestjs/swagger'

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
  })
  sms?: AliyunSmsConfigDto
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
    description: '审核状态：0=待审核，1=已通过，2=已拒绝',
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
  })
  severeAction?: ContentReviewActionDto

  @NestedProperty({
    description: '一般敏感词处理策略',
    type: ContentReviewActionDto,
    required: false,
  })
  generalAction?: ContentReviewActionDto

  @NestedProperty({
    description: '轻微敏感词处理策略',
    type: ContentReviewActionDto,
    required: false,
  })
  lightAction?: ContentReviewActionDto

  @BooleanProperty({
    description: '是否记录敏感词命中明细',
    example: true,
    default: true,
    required: false,
  })
  recordHits?: boolean
}

// ============================================================================
// 系统配置总入口
// ============================================================================

/**
 * 系统配置 DTO
 * 用于管理端获取和更新系统配置
 */
export class SystemConfigDto {
  @NestedProperty({
    description: '阿里云配置',
    type: AliyunConfigDto,
    required: false,
  })
  aliyunConfig?: AliyunConfigDto

  @NestedProperty({
    description: '站点基础配置',
    type: SiteConfigDto,
    required: false,
  })
  siteConfig?: SiteConfigDto

  @NestedProperty({
    description: '维护模式配置',
    type: MaintenanceConfigDto,
    required: false,
  })
  maintenanceConfig?: MaintenanceConfigDto

  @NestedProperty({
    description: '内容审核策略配置',
    type: ContentReviewPolicyDto,
    required: false,
  })
  contentReviewPolicy?: ContentReviewPolicyDto
}

export class SystemConfigBodyDto extends IntersectionType(
  SystemConfigDto,
  IdDto,
) {}
