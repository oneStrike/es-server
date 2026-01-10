import {
  ValidateBoolean,
  ValidateNumber,
  ValidateString,
} from '@libs/base/decorators'
import { BaseDto, IdDto, OMIT_BASE_FIELDS } from '@libs/base/dto'
import { ApiProperty, IntersectionType, OmitType } from '@nestjs/swagger'
import { ReviewPolicyEnum } from '../forum-config.constants'

export class BaseForumConfigDto extends BaseDto {
  @ValidateString({
    description: '站点名称',
    example: '我的社区',
    required: true,
    maxLength: 100,
  })
  siteName!: string

  @ValidateString({
    description: '站点描述',
    example: '一个优秀的社区论坛',
    required: false,
    maxLength: 500,
  })
  siteDescription?: string

  @ValidateString({
    description: '站点关键词',
    example: '社区,论坛,交流',
    required: false,
    maxLength: 200,
  })
  siteKeywords?: string

  @ValidateString({
    description: '站点Logo URL',
    example: 'https://example.com/logo.png',
    required: false,
    maxLength: 255,
  })
  siteLogo?: string

  @ValidateString({
    description: '站点Favicon URL',
    example: 'https://example.com/favicon.ico',
    required: false,
    maxLength: 255,
  })
  siteFavicon?: string

  @ValidateString({
    description: '联系邮箱',
    example: 'contact@example.com',
    required: false,
    maxLength: 100,
  })
  contactEmail?: string

  @ValidateString({
    description: '备案号',
    example: '京ICP备12345678号',
    required: false,
    maxLength: 50,
  })
  icpNumber?: string

  @ValidateNumber({
    description: '主题标题最大长度',
    example: 200,
    required: true,
    min: 1,
    max: 500,
  })
  topicTitleMaxLength!: number

  @ValidateNumber({
    description: '主题内容最大长度',
    example: 10000,
    required: true,
    min: 1,
    max: 50000,
  })
  topicContentMaxLength!: number

  @ValidateNumber({
    description: '回复内容最大长度',
    example: 5000,
    required: true,
    min: 1,
    max: 20000,
  })
  replyContentMaxLength!: number

  @ValidateNumber({
    description:
      '审核策略（0：无需审核，1：触发严重敏感词时审核，2：触一般敏感词时审核，3：触发轻微敏感词时审核，4：强制人工审核）',
    example: ReviewPolicyEnum.SEVERE_SENSITIVE_WORD,
    required: true,
    min: ReviewPolicyEnum.NONE,
    max: ReviewPolicyEnum.MANUAL,
  })
  reviewPolicy!: ReviewPolicyEnum

  @ValidateBoolean({
    description: '是否允许匿名浏览',
    example: true,
    required: true,
  })
  allowAnonymousView!: boolean

  @ValidateBoolean({
    description: '是否允许匿名发帖',
    example: false,
    required: true,
  })
  allowAnonymousPost!: boolean

  @ValidateBoolean({
    description: '是否允许匿名回复',
    example: false,
    required: true,
  })
  allowAnonymousReply!: boolean

  @ValidateBoolean({
    description: '是否允许用户注册',
    example: true,
    required: true,
  })
  allowUserRegister!: boolean

  @ValidateBoolean({
    description: '注册是否需要邮箱验证',
    example: true,
    required: true,
  })
  registerRequireEmailVerify!: boolean

  @ValidateBoolean({
    description: '注册是否需要手机验证',
    example: false,
    required: true,
  })
  registerRequirePhoneVerify!: boolean

  @ValidateNumber({
    description: '用户名最小长度',
    example: 3,
    required: true,
    min: 2,
    max: 30,
  })
  usernameMinLength!: number

  @ValidateNumber({
    description: '用户名最大长度',
    example: 20,
    required: true,
    min: 5,
    max: 50,
  })
  usernameMaxLength!: number

  @ValidateNumber({
    description: '签名最大长度',
    example: 200,
    required: true,
    min: 0,
    max: 500,
  })
  signatureMaxLength!: number

  @ValidateNumber({
    description: '个人简介最大长度',
    example: 500,
    required: true,
    min: 0,
    max: 1000,
  })
  bioMaxLength!: number

  @ValidateNumber({
    description: '新注册用户默认发放的积分',
    example: 100,
    required: true,
    min: 0,
    max: 10000,
  })
  defaultPointsForNewUser!: number

  @ValidateBoolean({
    description: '是否启用邮件通知',
    example: true,
    required: true,
  })
  enableEmailNotification!: boolean

  @ValidateBoolean({
    description: '是否启用站内通知',
    example: true,
    required: true,
  })
  enableInAppNotification!: boolean

  @ValidateBoolean({
    description: '是否启用新主题通知',
    example: true,
    required: true,
  })
  enableNewTopicNotification!: boolean

  @ValidateBoolean({
    description: '是否启用新回复通知',
    example: true,
    required: true,
  })
  enableNewReplyNotification!: boolean

  @ValidateBoolean({
    description: '是否启用点赞通知',
    example: true,
    required: true,
  })
  enableLikeNotification!: boolean

  @ValidateBoolean({
    description: '是否启用收藏通知',
    example: true,
    required: true,
  })
  enableFavoriteNotification!: boolean

  @ValidateBoolean({
    description: '是否启用系统通知',
    example: true,
    required: true,
  })
  enableSystemNotification!: boolean

  @ValidateBoolean({
    description: '是否启用站点维护模式',
    example: false,
    required: true,
  })
  enableMaintenanceMode!: boolean

  @ValidateString({
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
) {}

export class UpdateForumConfigDto extends IntersectionType(
  BaseForumConfigDto,
  IdDto,
) {
  @ValidateString({
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
  @ApiProperty({
    description: '配置ID',
    example: 1,
    required: true,
  })
  configId!: number

  @ApiProperty({
    description: '变更时间',
    example: '2023-10-01T12:00:00Z',
    required: true,
  })
  changeType!: Date

  @ApiProperty({
    description: '变更原因',
    example: '更新论坛配置',
    required: false,
    maxLength: 500,
  })
  reason?: string
}
