import type {
  ReferenceObject,
  SchemaObject,
} from '@nestjs/swagger/dist/interfaces/open-api-spec.interface'
import { BaseAnnouncementDto } from '@libs/app-content/announcement/dto/announcement.dto'
import { BaseWorkChapterDto } from '@libs/content/work/chapter/dto/work-chapter.dto'
import { BaseWorkDto } from '@libs/content/work/core/dto/work.dto'
import { BaseForumTopicDto } from '@libs/forum/topic/dto/forum-topic.dto'
import { GrowthRewardRuleAssetTypeEnum } from '@libs/growth/reward-rule/reward-rule.constant'
import {
  BaseTaskAssignmentDto,
  BaseTaskDto,
  QueryTaskAssignmentReconciliationDto,
} from '@libs/growth/task/dto/task.dto'
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
import { BaseAppUserDto } from '@libs/user/dto/base-app-user.dto'
import {
  ApiExtraModels,
  ApiProperty,
  getSchemaPath,
  IntersectionType,
  PartialType,
  PickType,
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
import { BaseNotificationUnreadDto } from './notification-unread.dto'

/**
 * 通知分类键过滤器校验装饰器
 *
 * 用于校验 categoryKeys 参数是否为合法的通知分类键组合字符串
 * 支持逗号、中文逗号、分号或竖线分隔多个分类键
 */
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

/**
 * 通知消息 DTO
 *
 * 表示通知的文本内容，包含标题和正文
 */
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

/**
 * 通知触发者 DTO
 *
 * 表示触发通知的用户基本信息，从 BaseAppUserDto 中选取关键字段
 * 用于在通知列表中展示"谁触发了这条通知"
 */
export class NotificationActorDto extends PickType(BaseAppUserDto, [
  'id',
  'nickname',
  'avatarUrl',
]) {}

/**
 * 评论快照 DTO
 *
 * 在通知中展示被操作的评论基本信息
 * 用于评论回复、评论点赞、评论提及等场景
 */
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

/**
 * 主题快照 DTO
 *
 * 在通知中展示主题（帖子）的基本信息
 * 用于主题点赞、主题收藏、主题提及等场景
 */
export class NotificationTopicSnapshotDto extends PickType(BaseForumTopicDto, [
  'id',
  'title',
  'sectionId',
]) {
  @StringProperty({
    description: '对象类型，固定为 topic',
    example: 'topic',
    validation: false,
  })
  kind!: 'topic'
}

/**
 * 作品快照 DTO
 *
 * 在通知中展示作品的基本信息
 * 用于作品相关评论通知场景，展示作品封面和类型
 */
export class NotificationWorkSnapshotDto extends IntersectionType(
  PickType(BaseWorkDto, ['id', 'cover']),
  PickType(BaseWorkChapterDto, ['workType']),
) {
  @StringProperty({
    description: '对象类型，固定为 work',
    example: 'work',
    validation: false,
  })
  kind!: 'work'

  @StringProperty({
    description: '作品标题',
    example: '鬼灭之刃',
    required: false,
    validation: false,
  })
  title?: string
}

/**
 * 章节快照 DTO
 *
 * 在通知中展示章节的基本信息
 * 用于章节评论相关通知场景，包含所属作品 ID 和类型
 */
export class NotificationChapterSnapshotDto extends PickType(
  BaseWorkChapterDto,
  ['id', 'title', 'subtitle', 'cover', 'workId', 'workType'],
) {
  @StringProperty({
    description: '对象类型，固定为 chapter',
    example: 'chapter',
    validation: false,
  })
  kind!: 'chapter'
}

/**
 * 公告快照 DTO
 *
 * 在通知中展示系统公告的基本信息
 * 用于系统公告类通知场景
 */
export class NotificationAnnouncementSnapshotDto extends PickType(
  BaseAnnouncementDto,
  ['id', 'title', 'summary', 'announcementType', 'priorityLevel'],
) {
  @StringProperty({
    description: '对象类型，固定为 announcement',
    example: 'announcement',
    validation: false,
  })
  kind!: 'announcement'
}

/**
 * 任务快照 DTO
 *
 * 在通知中展示任务的基本信息
 * 用于任务提醒类通知场景
 */
export class NotificationTaskSnapshotDto extends PickType(BaseTaskDto, [
  'id',
  'code',
  'cover',
  'title',
  'type',
]) {
  @StringProperty({
    description: '对象类型，固定为 task',
    example: 'task',
    validation: false,
  })
  kind!: 'task'
}

/**
 * 任务提醒信息 DTO
 *
 * 描述任务提醒的具体类型和相关信息
 * - auto_assigned: 任务自动分配提醒
 * - expiring_soon: 任务即将过期提醒
 * - reward_granted: 任务奖励到账提醒
 */
class NotificationTaskReminderOptionalFieldsDto extends PartialType(
  IntersectionType(
    PickType(BaseTaskAssignmentDto, ['cycleKey', 'expiredAt']),
    PickType(QueryTaskAssignmentReconciliationDto, ['assignmentId']),
  ),
) {}

export class NotificationTaskReminderInfoDto extends NotificationTaskReminderOptionalFieldsDto {
  @StringProperty({
    description: '任务提醒子类型，表示自动分配、即将过期或奖励到账三类业务场景',
    example: 'reward_granted',
    validation: false,
  })
  kind!: 'auto_assigned' | 'expiring_soon' | 'reward_granted'
}

/**
 * 任务奖励项 DTO
 *
 * 描述单个奖励项的资产类型和数量
 */
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

/**
 * 任务奖励快照 DTO
 *
 * 描述任务奖励的完整信息，包含奖励项列表和对应的流水记录 ID
 * 仅在任务奖励到账场景中使用
 */
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

export type NotificationCommentContainerDto =
  | NotificationWorkSnapshotDto
  | NotificationTopicSnapshotDto
  | NotificationChapterSnapshotDto

export interface NotificationCommentActionDataDto {
  object: NotificationCommentSnapshotDto
  container: NotificationCommentContainerDto
  parentContainer?: NotificationWorkSnapshotDto
}

export interface NotificationTopicObjectDataDto {
  object: NotificationTopicSnapshotDto
}

export interface NotificationTopicCommentedDataDto {
  object: NotificationCommentSnapshotDto
  container: NotificationTopicSnapshotDto
}

export interface NotificationAnnouncementDataDto {
  object: NotificationAnnouncementSnapshotDto
}

export interface NotificationTaskReminderDataDto {
  object: NotificationTaskSnapshotDto
  reminder: NotificationTaskReminderInfoDto
  reward?: NotificationTaskRewardSnapshotDto
}

export interface NotificationDataByTypeDto {
  comment_reply: NotificationCommentActionDataDto
  comment_mention: NotificationCommentActionDataDto
  comment_like: NotificationCommentActionDataDto
  topic_like: NotificationTopicObjectDataDto
  topic_favorited: NotificationTopicObjectDataDto
  topic_commented: NotificationTopicCommentedDataDto
  topic_mentioned: NotificationTopicObjectDataDto
  user_followed: null
  system_announcement: NotificationAnnouncementDataDto
  task_reminder: NotificationTaskReminderDataDto
}

export type UserNotificationDataDto = Exclude<
  NotificationDataByTypeDto[MessageNotificationCategoryKey],
  null
>

function createNotificationCommentContainerOneOfSchemas() {
  return [
    { $ref: getSchemaPath(NotificationWorkSnapshotDto) },
    { $ref: getSchemaPath(NotificationTopicSnapshotDto) },
    { $ref: getSchemaPath(NotificationChapterSnapshotDto) },
  ] satisfies ReferenceObject[]
}

function createNotificationDataOneOfSchemas() {
  const commentActionProperties: Record<
    string,
    SchemaObject | ReferenceObject
  > = {
    object: { $ref: getSchemaPath(NotificationCommentSnapshotDto) },
    container: {
      oneOf: createNotificationCommentContainerOneOfSchemas(),
    },
    parentContainer: {
      $ref: getSchemaPath(NotificationWorkSnapshotDto),
    },
  }

  const topicObjectProperties: Record<string, SchemaObject | ReferenceObject> =
    {
      object: { $ref: getSchemaPath(NotificationTopicSnapshotDto) },
    }

  const topicCommentedProperties: Record<
    string,
    SchemaObject | ReferenceObject
  > = {
    object: { $ref: getSchemaPath(NotificationCommentSnapshotDto) },
    container: { $ref: getSchemaPath(NotificationTopicSnapshotDto) },
  }

  const announcementProperties: Record<string, SchemaObject | ReferenceObject> =
    {
      object: { $ref: getSchemaPath(NotificationAnnouncementSnapshotDto) },
    }

  const taskReminderProperties: Record<string, SchemaObject | ReferenceObject> =
    {
      object: { $ref: getSchemaPath(NotificationTaskSnapshotDto) },
      reminder: { $ref: getSchemaPath(NotificationTaskReminderInfoDto) },
      reward: { $ref: getSchemaPath(NotificationTaskRewardSnapshotDto) },
    }

  return [
    {
      title: '评论互动通知数据',
      type: 'object',
      additionalProperties: false,
      required: ['object', 'container'],
      properties: commentActionProperties,
    },
    {
      title: '主题互动通知数据',
      type: 'object',
      additionalProperties: false,
      required: ['object'],
      properties: topicObjectProperties,
    },
    {
      title: '主题评论通知数据',
      type: 'object',
      additionalProperties: false,
      required: ['object', 'container'],
      properties: topicCommentedProperties,
    },
    {
      title: '系统公告通知数据',
      type: 'object',
      additionalProperties: false,
      required: ['object'],
      properties: announcementProperties,
    },
    {
      title: '任务提醒通知数据',
      type: 'object',
      additionalProperties: false,
      required: ['object', 'reminder'],
      properties: taskReminderProperties,
    },
  ] satisfies SchemaObject[]
}

/**
 * 用户通知基础 DTO
 *
 * 定义用户通知的核心字段，包括：
 * - type: 通知分类键（决定通知类型）
 * - message: 通知文案（标题和正文）
 * - data: 结构化数据（根据 type 返回不同结构）
 * - actor: 触发用户信息
 * - isRead/readAt: 已读状态和时间
 * - expiresAt: 过期时间
 */
export class BaseUserNotificationDto extends BaseDto {
  @EnumProperty({
    description: '通知分类键，表示通知所属业务分类',
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
      '结构化通知数据；根据通知分类返回不同结构，用户关注场景固定返回 null',
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
    oneOf: createNotificationDataOneOfSchemas(),
  })
  data!: UserNotificationDataDto | null

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

/**
 * 查询用户通知列表 DTO
 *
 * 支持分页查询，可按已读状态和通知分类键筛选
 * categoryKeys 支持多分类键筛选，使用分隔符连接
 */
export class QueryUserNotificationListDto extends PageDto {
  @BooleanProperty({
    description: '是否已读',
    required: false,
    example: false,
  })
  isRead?: boolean

  @IsValidNotificationCategoryKeysFilter()
  @StringProperty({
    description:
      '通知分类键筛选列表，多个分类键使用逗号、中文逗号、分号或竖线分隔',
    required: false,
    example: `${MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.COMMENT_REPLY},${MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.COMMENT_LIKE}`,
    transform: ({ value }) => {
      return serializeMessageNotificationCategoryKeysFilter(value)
    },
  })
  categoryKeys?: string
}

/**
 * 更新用户通知偏好项 DTO
 *
 * 用于设置单个通知分类的启用状态
 */
export class UpdateUserNotificationPreferenceItemDto {
  @EnumProperty({
    description: '通知分类键，表示通知所属业务分类',
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

/**
 * 更新用户通知偏好列表 DTO
 *
 * 批量更新多个通知分类的启用状态
 */
export class UpdateUserNotificationPreferencesDto {
  @ArrayProperty({
    description: '通知偏好更新项列表',
    itemClass: UpdateUserNotificationPreferenceItemDto,
    required: true,
    minLength: 1,
  })
  preferences!: UpdateUserNotificationPreferenceItemDto[]
}

/**
 * 通知投递查询基础 DTO
 *
 * 用于管理后台查询通知投递记录
 * 可按投递状态和通知分类键筛选
 */
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
    description: '通知分类键，表示通知所属业务分类',
    example: MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.TASK_REMINDER,
    required: false,
    enum: MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM,
  })
  categoryKey?: MessageNotificationCategoryKey
}

/**
 * 分页查询通知投递记录 DTO
 *
 * 继承分页参数和投递查询条件
 * 用于管理后台查看通知投递情况
 */
export class QueryNotificationDeliveryPageDto extends IntersectionType(
  PageDto,
  PartialType(BaseNotificationDeliveryQueryDto),
) {}

/**
 * 用户通知 DTO（完整版）
 *
 * 继承 BaseUserNotificationDto，通过 @ApiExtraModels 注册所有可能用到的子模型
 * 用于 Swagger 文档生成正确的 OpenAPI Schema
 */
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
)
export class UserNotificationDto extends BaseUserNotificationDto {}

/**
 * 用户通知未读统计 DTO
 *
 * 继承自基础未读统计 DTO
 */
export class NotificationUnreadDto extends BaseNotificationUnreadDto {}

/**
 * 用户通知偏好项 DTO
 *
 * 描述单个通知分类的偏好设置，包括：
 * - categoryKey/categoryLabel: 分类键和中文标签
 * - isEnabled: 当前是否启用
 * - defaultEnabled: 默认启用状态
 * - source: 状态来源（默认策略或用户显式覆盖）
 * - updatedAt: 最近更新时间
 */
export class UserNotificationPreferenceItemDto {
  @EnumProperty({
    description: '通知分类键，表示通知所属业务分类',
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
    description: '偏好来源，表示当前配置来自系统默认值或用户显式覆盖',
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

/**
 * 用户通知偏好列表 DTO
 *
 * 返回用户所有通知分类的偏好设置列表
 */
export class UserNotificationPreferenceListDto {
  @ArrayProperty({
    description: '通知偏好列表',
    itemClass: UserNotificationPreferenceItemDto,
    validation: false,
  })
  list!: UserNotificationPreferenceItemDto[]
}
