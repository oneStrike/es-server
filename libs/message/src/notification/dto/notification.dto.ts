import type { MessageNotificationData } from '../notification-contract.type'
import { GrowthRewardRuleAssetTypeEnum } from '@libs/growth/reward-rule/reward-rule.constant'
import {
  ArrayProperty,
  BooleanProperty,
  DateProperty,
  EnumProperty,
  NestedProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseDto, PageDto } from '@libs/platform/dto'
import {
  ApiExtraModels,
  ApiProperty,
  getSchemaPath,
  IntersectionType,
  PartialType,
} from '@nestjs/swagger'
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
    required: true,
    nullable: true,
    validation: false,
  })
  avatarUrl!: string | null
}

export class NotificationCommentSnapshotDto {
  @StringProperty({
    description: '对象类型，固定为 comment',
    example: 'comment',
    validation: false,
  })
  kind!: 'comment'

  @NumberProperty({
    description: '评论 ID',
    example: 101,
    validation: false,
  })
  id!: number

  @StringProperty({
    description: '评论摘要',
    example: '这条评论很关键',
    required: false,
    validation: false,
  })
  snippet?: string
}

export class NotificationTopicSnapshotDto {
  @StringProperty({
    description: '对象类型，固定为 topic',
    example: 'topic',
    validation: false,
  })
  kind!: 'topic'

  @NumberProperty({
    description: '主题 ID',
    example: 8,
    validation: false,
  })
  id!: number

  @StringProperty({
    description: '主题标题',
    example: '帖子标题',
    required: false,
    validation: false,
  })
  title?: string

  @StringProperty({
    description: '主题封面',
    example: 'https://example.com/topic-cover.png',
    required: false,
    validation: false,
  })
  cover?: string

  @NumberProperty({
    description: '所属分区 ID',
    example: 12,
    required: false,
    validation: false,
  })
  sectionId?: number
}

export class NotificationWorkSnapshotDto {
  @StringProperty({
    description: '对象类型，固定为 work',
    example: 'work',
    validation: false,
  })
  kind!: 'work'

  @NumberProperty({
    description: '作品 ID',
    example: 5,
    validation: false,
  })
  id!: number

  @StringProperty({
    description: '作品标题',
    example: '鬼灭之刃',
    required: false,
    validation: false,
  })
  title?: string

  @StringProperty({
    description: '作品封面',
    example: 'https://example.com/work-cover.png',
    required: false,
    validation: false,
  })
  cover?: string

  @NumberProperty({
    description: '作品类型',
    example: 1,
    required: false,
    validation: false,
  })
  workType?: number
}

export class NotificationChapterSnapshotDto {
  @StringProperty({
    description: '对象类型，固定为 chapter',
    example: 'chapter',
    validation: false,
  })
  kind!: 'chapter'

  @NumberProperty({
    description: '章节 ID',
    example: 17,
    validation: false,
  })
  id!: number

  @StringProperty({
    description: '章节标题',
    example: '第 17 话',
    required: false,
    validation: false,
  })
  title?: string

  @StringProperty({
    description: '章节副标题',
    example: '暴雨将至',
    required: false,
    validation: false,
  })
  subtitle?: string

  @StringProperty({
    description: '章节封面',
    example: 'https://example.com/chapter-cover.png',
    required: false,
    validation: false,
  })
  cover?: string

  @NumberProperty({
    description: '所属作品 ID',
    example: 8,
    required: false,
    validation: false,
  })
  workId?: number

  @NumberProperty({
    description: '所属作品类型',
    example: 1,
    required: false,
    validation: false,
  })
  workType?: number
}

export class NotificationAnnouncementSnapshotDto {
  @StringProperty({
    description: '对象类型，固定为 announcement',
    example: 'announcement',
    validation: false,
  })
  kind!: 'announcement'

  @NumberProperty({
    description: '公告 ID',
    example: 42,
    validation: false,
  })
  id!: number

  @StringProperty({
    description: '公告标题',
    example: '版本更新',
    required: false,
    validation: false,
  })
  title?: string

  @StringProperty({
    description: '公告摘要',
    example: '公告摘要',
    required: false,
    validation: false,
  })
  summary?: string

  @NumberProperty({
    description: '公告类型',
    example: 1,
    required: false,
    validation: false,
  })
  announcementType?: number

  @NumberProperty({
    description: '优先级',
    example: 2,
    required: false,
    validation: false,
  })
  priorityLevel?: number
}

export class NotificationTaskSnapshotDto {
  @StringProperty({
    description: '对象类型，固定为 task',
    example: 'task',
    validation: false,
  })
  kind!: 'task'

  @NumberProperty({
    description: '任务 ID',
    example: 5,
    validation: false,
  })
  id!: number

  @StringProperty({
    description: '任务编码',
    example: 'daily-comment',
    required: false,
    validation: false,
  })
  code?: string

  @StringProperty({
    description: '任务标题',
    example: '每日评论',
    required: false,
    validation: false,
  })
  title?: string

  @StringProperty({
    description: '任务封面',
    example: 'https://example.com/task-cover.png',
    required: false,
    validation: false,
  })
  cover?: string

  @NumberProperty({
    description: '任务场景类型',
    example: 2,
    required: false,
    validation: false,
  })
  sceneType?: number
}

export class NotificationTaskReminderInfoDto {
  @StringProperty({
    description:
      '提醒子类型：auto_assigned=自动分配；expiring_soon=即将过期；reward_granted=奖励到账',
    example: 'reward_granted',
    validation: false,
  })
  kind!: 'auto_assigned' | 'expiring_soon' | 'reward_granted'

  @NumberProperty({
    description: '任务分配 ID',
    example: 10,
    required: false,
    validation: false,
  })
  assignmentId?: number

  @StringProperty({
    description: '周期键',
    example: '2026-04-18',
    required: false,
    validation: false,
  })
  cycleKey?: string

  @StringProperty({
    description: '过期时间',
    example: '2026-04-19T12:00:00.000Z',
    required: false,
    validation: false,
    type: 'ISO8601',
  })
  expiredAt?: string
}

export class NotificationTaskRewardItemDto {
  @EnumProperty({
    description: '奖励资产类型（1=积分；2=经验；3=道具；4=虚拟货币；5=等级）',
    example: GrowthRewardRuleAssetTypeEnum.POINTS,
    enum: GrowthRewardRuleAssetTypeEnum,
    validation: false,
  })
  assetType!: GrowthRewardRuleAssetTypeEnum

  @NumberProperty({
    description: '奖励数量',
    example: 5,
    validation: false,
  })
  amount!: number
}

export class NotificationTaskRewardSnapshotDto {
  @ArrayProperty({
    description: '奖励项列表',
    itemClass: NotificationTaskRewardItemDto,
    required: true,
    validation: false,
  })
  items!: NotificationTaskRewardItemDto[]

  @ArrayProperty({
    description: '奖励流水记录 ID 列表',
    itemType: 'number',
    required: true,
    validation: false,
    example: [101],
  })
  ledgerRecordIds!: number[]
}

export class NotificationCommentActionDataDto {
  @NestedProperty({
    description: '被操作评论快照',
    type: NotificationCommentSnapshotDto,
    validation: false,
  })
  object!: NotificationCommentSnapshotDto

  @ApiProperty({
    description: '评论挂载容器快照',
    required: true,
    oneOf: [
      { $ref: getSchemaPath(NotificationWorkSnapshotDto) },
      { $ref: getSchemaPath(NotificationTopicSnapshotDto) },
      { $ref: getSchemaPath(NotificationChapterSnapshotDto) },
    ],
  })
  container!:
    | NotificationWorkSnapshotDto
    | NotificationTopicSnapshotDto
    | NotificationChapterSnapshotDto

  @NestedProperty({
    description: '父级容器快照，仅章节场景返回所属作品',
    type: NotificationWorkSnapshotDto,
    required: false,
    validation: false,
    nullable: false,
  })
  parentContainer?: NotificationWorkSnapshotDto
}

export class NotificationTopicObjectDataDto {
  @NestedProperty({
    description: '主题快照',
    type: NotificationTopicSnapshotDto,
    validation: false,
  })
  object!: NotificationTopicSnapshotDto
}

export class NotificationTopicCommentedDataDto {
  @NestedProperty({
    description: '评论快照',
    type: NotificationCommentSnapshotDto,
    validation: false,
  })
  object!: NotificationCommentSnapshotDto

  @NestedProperty({
    description: '主题快照',
    type: NotificationTopicSnapshotDto,
    validation: false,
  })
  container!: NotificationTopicSnapshotDto
}

export class NotificationAnnouncementDataDto {
  @NestedProperty({
    description: '公告快照',
    type: NotificationAnnouncementSnapshotDto,
    validation: false,
  })
  object!: NotificationAnnouncementSnapshotDto
}

export class NotificationTaskReminderDataDto {
  @NestedProperty({
    description: '任务快照',
    type: NotificationTaskSnapshotDto,
    validation: false,
  })
  object!: NotificationTaskSnapshotDto

  @NestedProperty({
    description: '提醒信息',
    type: NotificationTaskReminderInfoDto,
    validation: false,
  })
  reminder!: NotificationTaskReminderInfoDto

  @NestedProperty({
    description: '奖励快照，仅奖励到账场景返回',
    type: NotificationTaskRewardSnapshotDto,
    required: false,
    validation: false,
    nullable: false,
  })
  reward?: NotificationTaskRewardSnapshotDto
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

  @ApiProperty({
    description:
      '结构化通知数据；根据 type 返回不同结构，user_followed 固定返回 null',
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
    oneOf: [
      { $ref: getSchemaPath(NotificationCommentActionDataDto) },
      { $ref: getSchemaPath(NotificationTopicObjectDataDto) },
      { $ref: getSchemaPath(NotificationTopicCommentedDataDto) },
      { $ref: getSchemaPath(NotificationAnnouncementDataDto) },
      { $ref: getSchemaPath(NotificationTaskReminderDataDto) },
    ],
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

@ApiExtraModels(
  NotificationCommentSnapshotDto,
  NotificationTopicSnapshotDto,
  NotificationWorkSnapshotDto,
  NotificationChapterSnapshotDto,
  NotificationAnnouncementSnapshotDto,
  NotificationTaskSnapshotDto,
  NotificationTaskReminderInfoDto,
  NotificationTaskRewardItemDto,
  NotificationTaskRewardSnapshotDto,
  NotificationCommentActionDataDto,
  NotificationTopicObjectDataDto,
  NotificationTopicCommentedDataDto,
  NotificationAnnouncementDataDto,
  NotificationTaskReminderDataDto,
)
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
