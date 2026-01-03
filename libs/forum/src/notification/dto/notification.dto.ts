import { ValidateEnum, ValidateNumber, ValidateString } from '@app/base'
import {
  IsOptional,
} from 'class-validator'
import {
  NotificationObjectTypeEnum,
  NotificationTypeEnum,
} from '../notification.constant'

/**
 * 创建通知DTO
 */
export class CreateNotificationDto {
  @ValidateNumber({
    description: '用户ID',
    example: 1,
    required: true,
  })
  userId!: number

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
  })
  content!: string

  @ValidateEnum({
    description: '关联对象类型',
    example: NotificationObjectTypeEnum.TOPIC,
    required: true,
    enum: NotificationObjectTypeEnum,
  })
  objectType!: NotificationObjectTypeEnum

  @ValidateNumber({
    description: '关联对象ID',
    example: 1,
    required: true,
  })
  objectId!: number
}

/**
 * 查询通知列表DTO
 */
export class QueryNotificationListDto {
  @ValidateNumber({
    description: '页码',
    example: 1,
    required: false,
    min: 1,
  })
  @IsOptional()
  page?: number = 1

  @ValidateNumber({
    description: '每页数量',
    example: 20,
    required: false,
    min: 1,
    max: 100,
  })
  @IsOptional()
  pageSize?: number = 20

  @ValidateEnum({
    description: '通知类型',
    example: NotificationTypeEnum.REPLY,
    required: false,
    enum: NotificationTypeEnum,
  })
  @IsOptional()
  type?: NotificationTypeEnum

  @ValidateNumber({
    description: '是否已读（0=未读, 1=已读）',
    example: 0,
    required: false,
    min: 0,
    max: 1,
  })
  @IsOptional()
  isRead?: number
}

/**
 * 标记通知已读DTO
 */
export class MarkNotificationReadDto {
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
export class BatchMarkNotificationReadDto {
  @ValidateNumber({
    description: '通知ID列表',
    example: [1, 2, 3],
    required: true,
    isArray: true,
  })
  notificationIds!: number[]
}

/**
 * 标记所有通知已读DTO
 */
export class MarkAllNotificationReadDto {
  @ValidateNumber({
    description: '用户ID',
    example: 1,
    required: true,
  })
  userId!: number
}

/**
 * 删除通知DTO
 */
export class DeleteNotificationDto {
  @ValidateNumber({
    description: '通知ID',
    example: 1,
    required: true,
  })
  notificationId!: number
}

/**
 * 批量删除通知DTO
 */
export class BatchDeleteNotificationDto {
  @ValidateNumber({
    description: '通知ID列表',
    example: [1, 2, 3],
    required: true,
    isArray: true,
  })
  notificationIds!: number[]
}

/**
 * 获取未读通知数量DTO
 */
export class GetUnreadCountDto {
  @ValidateNumber({
    description: '用户ID',
    example: 1,
    required: true,
  })
  userId!: number
}
