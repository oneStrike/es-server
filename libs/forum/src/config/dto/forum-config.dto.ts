import {
  BooleanProperty,
  DateProperty,
  EnumProperty,
  JsonProperty,
  NumberProperty,
  StringProperty,
} from '@libs/base/decorators'
import { BaseDto, IdDto, OMIT_BASE_FIELDS } from '@libs/base/dto'
import { IntersectionType, OmitType } from '@nestjs/swagger'
import { ChangeTypeEnum, ForumReviewPolicyEnum } from '../forum-config.constant'

export class BaseForumConfigDto extends BaseDto {
  @StringProperty({
    description: '站点名称',
    example: '我的社区',
    required: true,
    maxLength: 100,
  })
  siteName!: string

  @StringProperty({
    description: '站点描述',
    example: '一个优秀的社区论坛',
    required: false,
    maxLength: 500,
  })
  siteDescription?: string

  @StringProperty({
    description: '站点关键词',
    example: '社区,论坛,交流',
    required: false,
    maxLength: 200,
  })
  siteKeywords?: string

  @StringProperty({
    description: '站点Logo URL',
    example: 'https://example.com/logo.png',
    required: false,
    maxLength: 255,
  })
  siteLogo?: string

  @StringProperty({
    description: '站点Favicon URL',
    example: 'https://example.com/favicon.ico',
    required: false,
    maxLength: 255,
  })
  siteFavicon?: string

  @StringProperty({
    description: '联系邮箱',
    example: 'contact@example.com',
    required: false,
    maxLength: 100,
  })
  contactEmail?: string

  @StringProperty({
    description: '备案号',
    example: '京ICP备12345678号',
    required: false,
    maxLength: 50,
  })
  icpNumber?: string

  @NumberProperty({
    description: '主题标题最大长度',
    example: 200,
    required: true,
    min: 1,
    max: 500,
  })
  topicTitleMaxLength!: number

  @NumberProperty({
    description: '主题内容最大长度',
    example: 10000,
    required: true,
    min: 1,
    max: 50000,
  })
  topicContentMaxLength!: number

  @NumberProperty({
    description: '回复内容最大长度',
    example: 5000,
    required: true,
    min: 1,
    max: 20000,
  })
  replyContentMaxLength!: number

  @NumberProperty({
    description:
      '审核策略（0：无需审核，1：触发严重敏感词时审核，2：触一般敏感词时审核，3：触发轻微敏感词时审核，4：强制人工审核）',
    example: ForumReviewPolicyEnum.SEVERE_SENSITIVE_WORD,
    required: true,
    min: ForumReviewPolicyEnum.NONE,
    max: ForumReviewPolicyEnum.MANUAL,
  })
  reviewPolicy!: ForumReviewPolicyEnum

  @BooleanProperty({
    description: '是否允许匿名浏览',
    example: true,
    required: true,
  })
  allowAnonymousView!: boolean

  @BooleanProperty({
    description: '是否允许匿名发帖',
    example: false,
    required: true,
  })
  allowAnonymousPost!: boolean

  @BooleanProperty({
    description: '是否允许匿名回复',
    example: false,
    required: true,
  })
  allowAnonymousReply!: boolean

  @BooleanProperty({
    description: '是否允许用户注册',
    example: true,
    required: true,
  })
  allowUserRegister!: boolean

  @BooleanProperty({
    description: '注册是否需要邮箱验证',
    example: true,
    required: true,
  })
  registerRequireEmailVerify!: boolean

  @BooleanProperty({
    description: '注册是否需要手机验证',
    example: false,
    required: true,
  })
  registerRequirePhoneVerify!: boolean

  @NumberProperty({
    description: '用户名最小长度',
    example: 3,
    required: true,
    min: 2,
    max: 30,
  })
  usernameMinLength!: number

  @NumberProperty({
    description: '用户名最大长度',
    example: 20,
    required: true,
    min: 5,
    max: 50,
  })
  usernameMaxLength!: number

  @NumberProperty({
    description: '签名最大长度',
    example: 200,
    required: true,
    min: 0,
    max: 500,
  })
  signatureMaxLength!: number

  @NumberProperty({
    description: '个人简介最大长度',
    example: 500,
    required: true,
    min: 0,
    max: 1000,
  })
  bioMaxLength!: number

  @NumberProperty({
    description: '新注册用户默认发放的积分',
    example: 100,
    required: true,
    min: 0,
    max: 10000,
  })
  defaultPointsForNewUser!: number

  @BooleanProperty({
    description: '是否启用邮件通知',
    example: true,
    required: true,
  })
  enableEmailNotification!: boolean

  @BooleanProperty({
    description: '是否启用站内通知',
    example: true,
    required: true,
  })
  enableInAppNotification!: boolean

  @BooleanProperty({
    description: '是否启用新主题通知',
    example: true,
    required: true,
  })
  enableNewTopicNotification!: boolean

  @BooleanProperty({
    description: '是否启用新回复通知',
    example: true,
    required: true,
  })
  enableNewReplyNotification!: boolean

  @BooleanProperty({
    description: '是否启用点赞通知',
    example: true,
    required: true,
  })
  enableLikeNotification!: boolean

  @BooleanProperty({
    description: '是否启用收藏通知',
    example: true,
    required: true,
  })
  enableFavoriteNotification!: boolean

  @BooleanProperty({
    description: '是否启用系统通知',
    example: true,
    required: true,
  })
  enableSystemNotification!: boolean

  @BooleanProperty({
    description: '是否启用站点维护模式',
    example: false,
    required: true,
  })
  enableMaintenanceMode!: boolean

  @StringProperty({
    description: '维护模式提示信息',
    example: '系统维护中，请稍后再来',
    required: false,
    maxLength: 500,
  })
  maintenanceMessage?: string
}

export class CreateForumConfigDto extends OmitType(
  BaseForumConfigDto,
  OMIT_BASE_FIELDS,
) { }

export class UpdateForumConfigDto extends IntersectionType(
  BaseForumConfigDto,
  IdDto,
) {
  @StringProperty({
    description: '变更原因',
    example: '更新论坛配置',
    required: false,
    maxLength: 500,
  })
  reason?: string
}

/**
 * 论坛配置变更历史项
 */
export class ForumConfigHistoryItemDto extends BaseDto {
  @NumberProperty({
    description: '配置ID',
    example: 1,
    required: true,
    validation: false,
  })
  configId!: number

  @EnumProperty({
    description: '变更类型',
    example: ChangeTypeEnum.CREATE,
    required: true,
    enum: ChangeTypeEnum,
    validation: false,
  })
  changeType!: ChangeTypeEnum

  @JsonProperty({
    description: '变更内容',
    example: '{"reviewPolicy": "SEVERE_SENSITIVE_WORD"}',
    required: true,
    validation: false,
  })
  changes!: Record<string, any>

  @StringProperty({
    description: '变更原因',
    example: '更新论坛配置',
    required: false,
    maxLength: 500,
    validation: false,
  })
  reason?: string

  @NumberProperty({
    description: '操作人ID',
    example: 1,
    required: false,
    validation: false,
  })
  operatedById?: number

  @DateProperty({
    description: '操作时间',
    example: '2023-10-01T12:00:00Z',
    required: true,
    validation: false,
  })
  operatedAt!: Date

  @StringProperty({
    description: '操作人IP地址',
    example: '127.0.0.1',
    required: false,
    validation: false,
  })
  ipAddress?: string

  @StringProperty({
    description: '操作人User-Agent',
    example:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
    required: false,
    validation: false,
  })
  userAgent?: string
}
