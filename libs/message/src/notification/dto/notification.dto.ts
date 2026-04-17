import {
  ArrayProperty,
  BooleanProperty,
  DateProperty,
  EnumProperty,
  NestedProperty,
  NumberProperty,
  ObjectProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { PageDto } from '@libs/platform/dto'
import { IntersectionType, PartialType } from '@nestjs/swagger'
import {
  getMessageNotificationCategoryLabel,
  MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM,
  MessageNotificationCategoryKey,
  MessageNotificationDispatchStatusEnum,
  MessageNotificationPreferenceSourceEnum,
} from '../notification.constant'
import { NotificationDeliveryLookupFilterDto } from './notification-delivery-filter.dto'

export class BaseUserNotificationDto {
  @NumberProperty({
    description: '通知 ID',
    example: 1,
  })
  id!: number

  @NumberProperty({
    description: '接收用户 ID',
    example: 10001,
  })
  receiverUserId!: number

  @EnumProperty({
    description: '通知分类键',
    example: MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.COMMENT_REPLY,
    enum: MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM,
  })
  categoryKey!: MessageNotificationCategoryKey

  @StringProperty({
    description: '通知分类中文标签',
    example: getMessageNotificationCategoryLabel('comment_reply'),
  })
  categoryLabel!: string

  @NumberProperty({
    description: '触发用户 ID',
    example: 10002,
    required: false,
  })
  actorUserId?: number

  @StringProperty({
    description: '通知标题',
    example: '有人回复了你的评论',
    maxLength: 200,
  })
  title!: string

  @StringProperty({
    description: '通知正文',
    example: '回复内容',
    maxLength: 1000,
  })
  content!: string

  @ObjectProperty({
    description:
      '扩展载荷；主体统一收敛到 payload.subject，章节额外通过 payload.parentSubject 返回所属作品',
    example: {
      actorNickname: '张三',
      commentId: 101,
      subject: {
        kind: 'chapter',
        id: 17,
        title: '第 17 话',
        subtitle: '暴雨将至',
        cover: 'https://example.com/chapter-cover.png',
        extra: {
          workId: 8,
          workType: 1,
        },
      },
      parentSubject: {
        kind: 'work',
        id: 8,
        title: '作品标题',
        cover: 'https://example.com/work-cover.png',
        extra: {
          type: 1,
        },
      },
    },
    required: false,
    nullable: true,
  })
  payload?: Record<string, unknown> | null

  @BooleanProperty({
    description: '是否已读',
    example: false,
  })
  isRead!: boolean

  @DateProperty({
    description: '已读时间',
    example: '2026-04-13T12:00:00.000Z',
    required: false,
  })
  readAt?: Date

  @DateProperty({
    description: '过期时间',
    example: '2026-04-14T12:00:00.000Z',
    required: false,
  })
  expiresAt?: Date

  @DateProperty({
    description: '创建时间',
    example: '2026-04-13T12:00:00.000Z',
  })
  createdAt!: Date

  @DateProperty({
    description: '更新时间',
    example: '2026-04-13T12:30:00.000Z',
  })
  updatedAt!: Date
}

export class QueryUserNotificationListDto extends PageDto {
  @BooleanProperty({
    description: '是否已读',
    required: false,
    example: false,
  })
  isRead?: boolean

  @ArrayProperty({
    description: '通知分类键列表',
    required: false,
    example: [
      MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.COMMENT_REPLY,
      MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.COMMENT_LIKE,
    ],
    itemEnum: MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM,
    transform: ({ value }) => {
      if (value === undefined || value === null || value === '') {
        return undefined
      }
      return Array.isArray(value) ? value : [value]
    },
  })
  categoryKeys?: MessageNotificationCategoryKey[]
}

export class UpdateUserNotificationPreferenceItemDto {
  @EnumProperty({
    description: '通知分类键',
    example: MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.COMMENT_REPLY,
    enum: MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM,
  })
  categoryKey!: MessageNotificationCategoryKey

  @BooleanProperty({
    description: '是否启用该分类通知',
    example: false,
  })
  isEnabled!: boolean
}

export class UpdateUserNotificationPreferencesDto {
  @ArrayProperty({
    description: '通知偏好更新项列表',
    itemClass: UpdateUserNotificationPreferenceItemDto,
    required: true,
    minLength: 1,
  })
  preferences!: UpdateUserNotificationPreferenceItemDto[]
}

class BaseNotificationDeliveryQueryDto extends NotificationDeliveryLookupFilterDto {
  @EnumProperty({
    description:
      '业务投递状态（1=已投递；2=投递失败；3=重试中；4=因偏好关闭而跳过）',
    example: MessageNotificationDispatchStatusEnum.FAILED,
    required: false,
    enum: MessageNotificationDispatchStatusEnum,
  })
  status?: MessageNotificationDispatchStatusEnum

  @EnumProperty({
    description: '通知分类键',
    example: MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.TASK_REMINDER,
    required: false,
    enum: MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM,
  })
  categoryKey?: MessageNotificationCategoryKey
}

export class QueryNotificationDeliveryPageDto extends IntersectionType(
  PageDto,
  PartialType(BaseNotificationDeliveryQueryDto),
) {}

export class NotificationActorDto {
  @NumberProperty({ description: '用户 ID', example: 1, validation: false })
  id!: number

  @StringProperty({
    description: '昵称',
    example: '测试用户',
    required: false,
    validation: false,
  })
  nickname?: string

  @StringProperty({
    description: '头像地址',
    example: 'https://example.com/avatar.png',
    required: false,
    validation: false,
  })
  avatarUrl?: string
}

export class UserNotificationDto extends BaseUserNotificationDto {
  @NestedProperty({
    description: '触发用户信息',
    type: NotificationActorDto,
    required: false,
    validation: false,
    nullable: false,
  })
  actorUser?: NotificationActorDto
}

export class NotificationUnreadCountDto {
  @NumberProperty({
    description: '未读通知数量',
    example: 3,
    validation: false,
  })
  count!: number
}

export class UserNotificationPreferenceItemDto {
  @EnumProperty({
    description: '通知分类键',
    example: MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.COMMENT_REPLY,
    enum: MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM,
  })
  categoryKey!: MessageNotificationCategoryKey

  @StringProperty({
    description: '通知分类中文标签',
    example: getMessageNotificationCategoryLabel('comment_reply'),
  })
  categoryLabel!: string

  @BooleanProperty({
    description: '当前是否启用',
    example: true,
  })
  isEnabled!: boolean

  @BooleanProperty({
    description: '该通知分类的默认启用状态',
    example: true,
  })
  defaultEnabled!: boolean

  @EnumProperty({
    description: '状态来源（默认策略；用户显式覆盖）',
    example: MessageNotificationPreferenceSourceEnum.DEFAULT,
    enum: MessageNotificationPreferenceSourceEnum,
  })
  source!: MessageNotificationPreferenceSourceEnum

  @DateProperty({
    description: '最近一次显式覆盖更新时间',
    example: '2026-04-13T12:30:00.000Z',
    required: false,
  })
  updatedAt?: Date
}

export class UserNotificationPreferenceListDto {
  @ArrayProperty({
    description: '通知偏好列表',
    itemClass: UserNotificationPreferenceItemDto,
    validation: false,
  })
  list!: UserNotificationPreferenceItemDto[]
}
