import {
  ArrayProperty,
  BooleanProperty,
  EnumProperty,
  NestedProperty,
  NumberProperty,
  StringProperty,
} from '@libs/base/decorators'
import { ContentReviewAuditStatusEnum } from '../system-config.constant'

export class AliyunSmsConfigDto {
  @StringProperty({
    description: '短信签名',
    example: '阿里云',
  })
  signName!: string

  @NumberProperty({
    description: '验证码过期时间（秒）',
    example: 300,
  })
  verifyCodeExpire!: number

  @NumberProperty({
    description: '验证码长度',
    example: 6,
    default: 6,
  })
  verifyCodeLength!: number
}

export class AliyunConfigDto {
  @StringProperty({
    description: 'AccessKey ID (前端输入明文，后端加密存储)',
    example: 'LTAI...',
  })
  accessKeyId!: string

  @StringProperty({
    description: 'AccessKey Secret (前端输入明文，后端加密存储)',
    example: 'secret...',
  })
  accessKeySecret!: string

  @NestedProperty({
    description: '短信配置',
    type: AliyunSmsConfigDto,
  })
  sms!: AliyunSmsConfigDto
}

export class GrowthAntifraudLimitDto {
  @NumberProperty({
    description: '冷却时间（秒）',
    example: 60,
    required: false,
  })
  cooldownSeconds?: number

  @NumberProperty({
    description: '每日上限',
    example: 100,
    required: false,
  })
  dailyLimit?: number

  @NumberProperty({
    description: '总上限',
    example: 1000,
    required: false,
  })
  totalLimit?: number
}

export class GrowthAntifraudEventOverrideDto {
  @StringProperty({
    description: '业务域',
    example: 'forum',
  })
  business!: string

  @StringProperty({
    description: '事件键',
    example: 'forum.topic.create',
  })
  eventKey!: string

  @NestedProperty({
    description: '用户维度限制',
    type: GrowthAntifraudLimitDto,
    required: false,
  })
  user?: GrowthAntifraudLimitDto

  @NestedProperty({
    description: 'IP 维度限制',
    type: GrowthAntifraudLimitDto,
    required: false,
  })
  ip?: GrowthAntifraudLimitDto

  @NestedProperty({
    description: '设备维度限制',
    type: GrowthAntifraudLimitDto,
    required: false,
  })
  device?: GrowthAntifraudLimitDto

  @NumberProperty({
    description: '积分高价值阈值',
    example: 100,
    required: false,
  })
  pointsThreshold?: number

  @NumberProperty({
    description: '经验高价值阈值',
    example: 100,
    required: false,
  })
  experienceThreshold?: number

  @NestedProperty({
    description: '高价值用户维度限制',
    type: GrowthAntifraudLimitDto,
    required: false,
  })
  highValueUser?: GrowthAntifraudLimitDto

  @NestedProperty({
    description: '高价值 IP 维度限制',
    type: GrowthAntifraudLimitDto,
    required: false,
  })
  highValueIp?: GrowthAntifraudLimitDto

  @NestedProperty({
    description: '高价值设备维度限制',
    type: GrowthAntifraudLimitDto,
    required: false,
  })
  highValueDevice?: GrowthAntifraudLimitDto
}

export class GrowthAntifraudConfigDto {
  @BooleanProperty({
    description: '是否启用防刷',
    example: true,
    default: true,
    required: false,
  })
  enabled?: boolean

  @NestedProperty({
    description: '用户维度限制',
    type: GrowthAntifraudLimitDto,
    required: false,
  })
  user?: GrowthAntifraudLimitDto

  @NestedProperty({
    description: 'IP 维度限制',
    type: GrowthAntifraudLimitDto,
    required: false,
  })
  ip?: GrowthAntifraudLimitDto

  @NestedProperty({
    description: '设备维度限制',
    type: GrowthAntifraudLimitDto,
    required: false,
  })
  device?: GrowthAntifraudLimitDto

  @NumberProperty({
    description: '积分高价值阈值',
    example: 100,
    required: false,
  })
  pointsThreshold?: number

  @NumberProperty({
    description: '经验高价值阈值',
    example: 100,
    required: false,
  })
  experienceThreshold?: number

  @NestedProperty({
    description: '高价值用户维度限制',
    type: GrowthAntifraudLimitDto,
    required: false,
  })
  highValueUser?: GrowthAntifraudLimitDto

  @NestedProperty({
    description: '高价值 IP 维度限制',
    type: GrowthAntifraudLimitDto,
    required: false,
  })
  highValueIp?: GrowthAntifraudLimitDto

  @NestedProperty({
    description: '高价值设备维度限制',
    type: GrowthAntifraudLimitDto,
    required: false,
  })
  highValueDevice?: GrowthAntifraudLimitDto

  @ArrayProperty({
    description: '事件级覆盖规则',
    itemType: 'object',
    required: false,
  })
  overrides?: GrowthAntifraudEventOverrideDto[]
}

export class ContentReviewActionDto {
  @EnumProperty({
    description: '审核状态',
    example: ContentReviewAuditStatusEnum.PENDING,
    enum: ContentReviewAuditStatusEnum,
  })
  auditStatus!: ContentReviewAuditStatusEnum

  @BooleanProperty({
    description: '是否隐藏',
    example: false,
    required: false,
    default: false,
  })
  isHidden?: boolean
}

export class ContentReviewPolicyDto {
  @NestedProperty({
    description: '严重敏感词处理策略',
    type: ContentReviewActionDto,
  })
  severeAction!: ContentReviewActionDto

  @NestedProperty({
    description: '一般敏感词处理策略',
    type: ContentReviewActionDto,
  })
  generalAction!: ContentReviewActionDto

  @NestedProperty({
    description: '轻微敏感词处理策略',
    type: ContentReviewActionDto,
  })
  lightAction!: ContentReviewActionDto

  @BooleanProperty({
    description: '是否记录命中明细',
    example: true,
    required: false,
  })
  recordHits?: boolean
}

export class CommentRateLimitConfigDto {
  @BooleanProperty({
    description: '是否启用评论限流',
    example: true,
    required: false,
  })
  enabled?: boolean

  @NumberProperty({
    description: '每分钟评论上限',
    example: 5,
    required: false,
    min: 1,
  })
  perMinute?: number

  @NumberProperty({
    description: '每小时评论上限',
    example: 30,
    required: false,
    min: 1,
  })
  perHour?: number

  @NumberProperty({
    description: '每日评论上限',
    example: 200,
    required: false,
    min: 1,
  })
  perDay?: number

  @NumberProperty({
    description: '冷却时间（秒）',
    example: 30,
    required: false,
    min: 1,
  })
  cooldownSeconds?: number
}

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
    description: '站点关键词',
    example: '漫画,社区',
    required: false,
  })
  siteKeywords?: string

  @StringProperty({
    description: '站点Logo',
    example: 'https://example.com/logo.png',
    required: false,
  })
  siteLogo?: string

  @StringProperty({
    description: '站点图标',
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
    description: '备案号',
    example: '粤ICP备xxxxxx号',
    required: false,
  })
  icpNumber?: string
}

export class MaintenanceConfigDto {
  @BooleanProperty({
    description: '是否启用维护模式',
    example: false,
    required: false,
  })
  enableMaintenanceMode?: boolean

  @StringProperty({
    description: '维护提示信息',
    example: '系统维护中，请稍后再试',
    required: false,
  })
  maintenanceMessage?: string
}

export class RegisterConfigDto {
  @BooleanProperty({
    description: '是否允许注册',
    example: true,
    required: false,
  })
  registerEnable?: boolean

  @BooleanProperty({
    description: '注册邮箱验证',
    example: true,
    required: false,
  })
  registerEmailVerify?: boolean

  @BooleanProperty({
    description: '注册手机验证',
    example: false,
    required: false,
  })
  registerPhoneVerify?: boolean
}

export class NotifyConfigDto {
  @BooleanProperty({
    description: '邮件通知总开关',
    example: true,
    required: false,
  })
  notifyEmail?: boolean

  @BooleanProperty({
    description: '站内通知总开关',
    example: true,
    required: false,
  })
  notifyInApp?: boolean

  @BooleanProperty({
    description: '系统通知总开关',
    example: true,
    required: false,
  })
  notifySystem?: boolean
}

export class SystemConfigDto {
  @NestedProperty({
    description: '阿里云配置',
    type: AliyunConfigDto,
    required: false,
  })
  aliyunConfig?: AliyunConfigDto

  @NestedProperty({
    description: '成长防刷配置',
    type: GrowthAntifraudConfigDto,
    required: false,
  })
  growthAntifraudConfig?: GrowthAntifraudConfigDto

  @NestedProperty({
    description: '内容审核策略配置',
    type: ContentReviewPolicyDto,
    required: false,
  })
  contentReviewPolicy?: ContentReviewPolicyDto

  @NestedProperty({
    description: '评论频率限制配置',
    type: CommentRateLimitConfigDto,
    required: false,
  })
  commentRateLimitConfig?: CommentRateLimitConfigDto

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
    description: '注册策略配置',
    type: RegisterConfigDto,
    required: false,
  })
  registerConfig?: RegisterConfigDto

  @NestedProperty({
    description: '通知策略配置',
    type: NotifyConfigDto,
    required: false,
  })
  notifyConfig?: NotifyConfigDto
}
