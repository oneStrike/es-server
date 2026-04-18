import type { MessageNotificationData } from '../notification-contract.type'
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
import { BaseDto, PageDto } from '@libs/platform/dto'
import { IntersectionType, PartialType } from '@nestjs/swagger'
import { ValidateBy } from 'class-validator'
import {
  isValidMessageNotificationCategoryKeysFilter,
  serializeMessageNotificationCategoryKeysFilter,
} from '../notification-category-key-filter.util'
import {
  getMessageNotificationCategoryLabel,
  MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM,
  MessageNotificationCategoryKey,
  MessageNotificationDispatchStatusEnum,
  MessageNotificationPreferenceSourceEnum,
} from '../notification.constant'
import { NotificationDeliveryLookupFilterDto } from './notification-delivery-filter.dto'

function IsValidNotificationCategoryKeysFilter(): PropertyDecorator {
  return ValidateBy({
    name: 'isValidNotificationCategoryKeysFilter',
    validator: {
      validate: (value: string | undefined) =>
        isValidMessageNotificationCategoryKeysFilter(value),
      defaultMessage: () => 'categoryKeys 中存在非法的通知分类键',
    },
  })
}

export class NotificationMessageDto {
  @StringProperty({
    description: '通知标题',
    example: '有人回复了你的评论',
    validation: false,
  })
  title!: string

  @StringProperty({
    description: '通知正文',
    example: '回复内容',
    validation: false,
  })
  body!: string
}

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

export class BaseUserNotificationDto extends BaseDto {
  @EnumProperty({
    description: '通知类型键',
    example: MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.COMMENT_REPLY,
    enum: MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM,
  })
  type!: MessageNotificationCategoryKey

  @NestedProperty({
    description: '通知文案',
    type: NotificationMessageDto,
    validation: false,
  })
  message!: NotificationMessageDto

  @ObjectProperty({
    description:
      '结构化通知数据；评论类返回 object/container/parentContainer，任务类返回 object/reminder/reward',
    example: {
      object: {
        kind: 'comment',
        id: 101,
        snippet: '这条评论很关键',
      },
      container: {
        kind: 'chapter',
        id: 17,
        title: '第 17 话',
        subtitle: '暴雨将至',
        cover: 'https://example.com/chapter-cover.png',
        workId: 8,
        workType: 1,
      },
      parentContainer: {
        kind: 'work',
        id: 8,
        title: '作品标题',
        cover: 'https://example.com/work-cover.png',
        workType: 1,
      },
      reminder: {
        kind: 'reward_granted',
        assignmentId: 10,
      },
      reward: {
        items: [
          {
            assetType: 1,
            amount: 5,
          },
        ],
        ledgerRecordIds: [101],
      },
    },
    required: true,
    nullable: true,
  })
  data!: MessageNotificationData | null

  @NestedProperty({
    description: '触发用户信息',
    type: NotificationActorDto,
    required: false,
    validation: false,
    nullable: false,
  })
  actor?: NotificationActorDto

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
}

export class QueryUserNotificationListDto extends PageDto {
  @BooleanProperty({
    description: '是否已读',
    required: false,
    example: false,
  })
  isRead?: boolean

  @IsValidNotificationCategoryKeysFilter()
  @StringProperty({
    description: '通知分类键列表，使用逗号、中文逗号、分号或竖线分隔',
    required: false,
    example: `${MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.COMMENT_REPLY},${MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.COMMENT_LIKE}`,
    transform: ({ value }) => {
      return serializeMessageNotificationCategoryKeysFilter(value)
    },
  })
  categoryKeys?: string
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

export class UserNotificationDto extends BaseUserNotificationDto {}

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
