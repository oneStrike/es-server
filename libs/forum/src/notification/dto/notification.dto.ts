import {
  ValidateArray,
  ValidateBoolean,
  ValidateEnum,
  ValidateNumber,
  ValidateString,
} from '@libs/base/decorators'
import { BaseDto, OMIT_BASE_FIELDS, PageDto } from '@libs/base/dto'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
import {
  NotificationPriorityEnum,
  NotificationTypeEnum,
} from '../notification.constant'

/**
 * 通知基础DTO
 * 包含论坛通知的所有基础字段定义
 */
export class BaseNotificationDto extends BaseDto {
  @ValidateNumber({
    description: '关联的论坛用户ID',
    example: 1,
    required: true,
  })
  profileId!: number

  @ValidateEnum({
    description: '通知类型',
    example: NotificationTypeEnum.REPLY,
    required: true,
    enum: NotificationTypeEnum,
  })
  type!: NotificationTypeEnum

  @ValidateString({
    description: '通知标题',
    example: '有人回复了你的主题',
    required: true,
    maxLength: 200,
  })
  title!: string

  @ValidateString({
    description: '通知内容',
    example: '张三 回复了你的主题《测试主题》',
    required: true,
    maxLength: 1000,
  })
  content!: string

  @ValidateBoolean({
    description: '是否已读（0=未读, 1=已读）',
    example: true,
    required: true,
  })
  isRead: boolean

  @ValidateNumber({
    description: '关联的主题ID（可选）',
    example: 1,
    required: false,
  })
  topicId?: number

  @ValidateNumber({
    description: '关联的回复ID（可选）',
    example: 1,
    required: false,
  })
  replyId?: number

  @ValidateEnum({
    description: '通知优先级',
    example: NotificationPriorityEnum.NORMAL,
    required: false,
    enum: NotificationPriorityEnum,
  })
  priority!: NotificationPriorityEnum
}

/**
 * 创建通知DTO
 */
export class CreateNotificationDto extends OmitType(
  BaseNotificationDto,
  OMIT_BASE_FIELDS,
) {}

/**
 * 便捷创建通知DTO
 */
export class CreateNotificationShortDto extends OmitType(
  CreateNotificationDto,
  ['type', 'priority'],
) {}

/**
 * 查询通知列表DTO
 */
export class QueryNotificationListDto extends IntersectionType(
  PageDto,
  PartialType(PickType(BaseNotificationDto, ['type', 'isRead', 'profileId'])),
) {}

/**
 * 标记通知已读DTO
 */
export class NotificationIdDto {
  @ValidateNumber({
    description: '通知ID',
    example: 1,
    required: true,
  })
  notificationId!: number
}

/**
 * 批量标记通知已读DTO
 */
export class NotificationIdsDto {
  @ValidateArray({
    description: '通知ID列表',
    example: [1, 2, 3],
    required: true,
    itemType: 'number',
  })
  notificationIds!: number[]
}

/**
 * 标记所有通知已读DTO
 */
export class ProfileIdDto {
  @ValidateNumber({
    description: '用户ID',
    example: 1,
    required: true,
  })
  profileId!: number
}
