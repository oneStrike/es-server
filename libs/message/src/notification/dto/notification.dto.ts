import type { ApiPropertyOptions } from '@nestjs/swagger'
import { BaseAnnouncementDto } from '@libs/app-content/announcement/dto/announcement.dto'
import { BaseForumTopicDto } from '@libs/forum/topic/dto/forum-topic.dto'
import { GrowthRewardRuleAssetTypeEnum } from '@libs/growth/reward-rule/reward-rule.constant'
import { BaseTaskDefinitionDto } from '@libs/growth/task/dto/task-view.dto'
import { TaskTypeEnum } from '@libs/growth/task/task.constant'
import { WorkTypeEnum } from '@libs/platform/constant'
import {
  ArrayProperty,
  BooleanProperty,
  DateProperty,
  EnumProperty,
  NestedProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseDto, IdDto, PageDto } from '@libs/platform/dto'
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
  MessageNotificationPreferenceSourceEnum,
} from '../notification.constant'
import { NotificationDeliveryLookupFilterDto } from './notification-delivery-filter.dto'
import { BaseNotificationDeliveryDto } from './notification-delivery.dto'

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
    nullable: true,
    validation: false,
  })
  snippet!: string | null
}

/**
 * 主题快照 DTO
 *
 * 在通知中展示主题（帖子）的基本信息
 * 用于主题点赞、主题收藏、主题提及等场景
 */
export class NotificationTopicSnapshotDto extends PickType(BaseForumTopicDto, [
  'id',
]) {
  @StringProperty({
    description: '对象类型，固定为 topic',
    example: 'topic',
    validation: false,
  })
  kind!: 'topic'

  @StringProperty({
    description: '主题标题',
    example: '如何学习 TypeScript？',
    nullable: true,
    validation: false,
  })
  title!: string | null

  @NumberProperty({
    description: '关联的板块 ID',
    example: 1,
    nullable: true,
    validation: false,
  })
  sectionId!: number | null
}

/**
 * 作品快照 DTO
 *
 * 在通知中展示作品的基本信息
 * 用于作品相关评论通知场景，展示作品封面和类型
 */
export class NotificationWorkSnapshotDto extends PickType(IdDto, [
  'id',
] as const) {
  @StringProperty({
    description: '对象类型，固定为 work',
    example: 'work',
    validation: false,
  })
  kind!: 'work'

  @StringProperty({
    description: '作品标题',
    example: '鬼灭之刃',
    nullable: true,
    validation: false,
  })
  title!: string | null

  @StringProperty({
    description: '作品封面',
    example: 'https://example.com/cover.jpg',
    nullable: true,
    validation: false,
  })
  cover!: string | null

  @EnumProperty({
    description: '作品类型（1=漫画；2=小说）',
    example: WorkTypeEnum.COMIC,
    enum: WorkTypeEnum,
    nullable: true,
    validation: false,
  })
  workType!: WorkTypeEnum | null
}

/**
 * 章节快照 DTO
 *
 * 在通知中展示章节的基本信息
 * 用于章节评论相关通知场景，包含所属作品 ID 和类型
 */
export class NotificationChapterSnapshotDto extends PickType(IdDto, [
  'id',
] as const) {
  @StringProperty({
    description: '对象类型，固定为 chapter',
    example: 'chapter',
    validation: false,
  })
  kind!: 'chapter'

  @StringProperty({
    description: '章节标题',
    example: '第 1 话',
    nullable: true,
    validation: false,
  })
  title!: string | null

  @StringProperty({
    description: '章节副标题',
    example: '序章',
    nullable: true,
    validation: false,
  })
  subtitle!: string | null

  @StringProperty({
    description: '章节封面',
    example: 'https://example.com/chapter-cover.jpg',
    nullable: true,
    validation: false,
  })
  cover!: string | null

  @NumberProperty({
    description: '作品 ID',
    example: 1,
    nullable: true,
    validation: false,
  })
  workId!: number | null

  @EnumProperty({
    description: '作品类型（1=漫画；2=小说）',
    example: WorkTypeEnum.COMIC,
    enum: WorkTypeEnum,
    nullable: true,
    validation: false,
  })
  workType!: WorkTypeEnum | null
}

/**
 * 公告快照 DTO
 *
 * 在通知中展示系统公告的基本信息
 * 用于系统公告类通知场景
 */
export class NotificationAnnouncementSnapshotDto extends PickType(
  BaseAnnouncementDto,
  ['id', 'title', 'announcementType', 'priorityLevel'],
) {
  @StringProperty({
    description: '对象类型，固定为 announcement',
    example: 'announcement',
    validation: false,
  })
  kind!: 'announcement'

  @StringProperty({
    description: '公告摘要',
    example: '系统维护通知，预计维护时间 2 小时',
    nullable: true,
    validation: false,
  })
  summary!: string | null
}

/**
 * 任务快照 DTO
 *
 * 在通知中展示任务的基本信息
 * 用于任务提醒类通知场景
 */
export class NotificationTaskSnapshotDto extends PickType(
  BaseTaskDefinitionDto,
  ['id', 'code', 'cover', 'title'] as const,
) {
  @NumberProperty({
    description: '任务场景类型（1=新手引导；2=日常；4=活动）',
    example: TaskTypeEnum.DAILY,
    validation: false,
  })
  type!: TaskTypeEnum

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
class NotificationTaskReminderOptionalFieldsDto {
  @StringProperty({
    description: '周期键',
    example: '2026-04-22',
    nullable: true,
    validation: false,
  })
  cycleKey!: string | null

  @DateProperty({
    description: '过期时间',
    example: '2026-04-23T00:00:00.000Z',
    nullable: true,
    validation: false,
  })
  expiredAt!: Date | null

  @NumberProperty({
    description: '任务实例 ID',
    example: 88,
    nullable: true,
    validation: false,
  })
  instanceId!: number | null
}

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

function createNotificationCommentContainerOneOfSchemas() {
  return [
    { $ref: getSchemaPath(NotificationWorkSnapshotDto) },
    { $ref: getSchemaPath(NotificationTopicSnapshotDto) },
    { $ref: getSchemaPath(NotificationChapterSnapshotDto) },
  ] satisfies NonNullable<ApiPropertyOptions['oneOf']>
}

function createNotificationDataAnyOfSchemas() {
  const commentReplyProperties = {
    object: { $ref: getSchemaPath(NotificationCommentSnapshotDto) },
    container: {
      oneOf: createNotificationCommentContainerOneOfSchemas(),
    },
    parentContainer: {
      allOf: [{ $ref: getSchemaPath(NotificationWorkSnapshotDto) }],
      nullable: true,
    },
    parentComment: {
      allOf: [{ $ref: getSchemaPath(NotificationCommentSnapshotDto) }],
      nullable: true,
    },
  } satisfies Record<string, ApiPropertyOptions | { $ref: string }>

  const commentActionProperties = {
    object: { $ref: getSchemaPath(NotificationCommentSnapshotDto) },
    container: {
      oneOf: createNotificationCommentContainerOneOfSchemas(),
    },
    parentContainer: {
      allOf: [{ $ref: getSchemaPath(NotificationWorkSnapshotDto) }],
      nullable: true,
    },
  } satisfies Record<string, ApiPropertyOptions | { $ref: string }>

  const topicObjectProperties = {
    object: { $ref: getSchemaPath(NotificationTopicSnapshotDto) },
  } satisfies Record<string, ApiPropertyOptions | { $ref: string }>

  const topicCommentedProperties = {
    object: { $ref: getSchemaPath(NotificationCommentSnapshotDto) },
    container: { $ref: getSchemaPath(NotificationTopicSnapshotDto) },
  } satisfies Record<string, ApiPropertyOptions | { $ref: string }>

  const announcementProperties = {
    object: { $ref: getSchemaPath(NotificationAnnouncementSnapshotDto) },
  } satisfies Record<string, ApiPropertyOptions | { $ref: string }>

  const taskReminderProperties = {
    object: { $ref: getSchemaPath(NotificationTaskSnapshotDto) },
    reminder: { $ref: getSchemaPath(NotificationTaskReminderInfoDto) },
    reward: {
      allOf: [{ $ref: getSchemaPath(NotificationTaskRewardSnapshotDto) }],
      nullable: true,
    },
  } satisfies Record<string, ApiPropertyOptions | { $ref: string }>

  return [
    {
      title: '评论回复通知数据',
      type: 'object',
      additionalProperties: false,
      required: ['object', 'container', 'parentContainer', 'parentComment'],
      properties: commentReplyProperties,
    },
    {
      title: '评论提及 / 点赞通知数据',
      type: 'object',
      additionalProperties: false,
      required: ['object', 'container', 'parentContainer'],
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
      required: ['object', 'reminder', 'reward'],
      properties: taskReminderProperties,
    },
  ] satisfies NonNullable<ApiPropertyOptions['anyOf']>
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
export class BaseUserNotificationDto extends BaseDto {
  @EnumProperty({
    description: '通知分类键，表示通知所属业务分类',
    example: MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.COMMENT_REPLY,
    enum: MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM,
    validation: false,
  })
  type!: (typeof MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM)[keyof typeof MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM]

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
      parentComment: {
        kind: 'comment',
        id: 88,
        snippet: '上一条被回复的评论',
      },
      reminder: {
        kind: 'reward_granted',
        instanceId: 10,
      },
      reward: {
        items: [
          {
            assetType: GrowthRewardRuleAssetTypeEnum.POINTS,
            amount: 5,
          },
        ],
        ledgerRecordIds: [101],
      },
    },
    required: true,
    nullable: true,
    anyOf: createNotificationDataAnyOfSchemas(),
  })
  data!: object | null

  @NestedProperty({
    description: '触发用户信息',
    type: NotificationActorDto,
    validation: false,
    nullable: true,
  })
  actor!: NotificationActorDto | null

  @BooleanProperty({
    description: '是否已读',
    example: false,
    validation: false,
  })
  isRead!: boolean

  @DateProperty({
    description: '已读时间',
    example: '2026-04-13T12:00:00.000Z',
    nullable: true,
    validation: false,
  })
  readAt!: Date | null

  @DateProperty({
    description: '过期时间',
    example: '2026-04-14T12:00:00.000Z',
    nullable: true,
    validation: false,
  })
  expiresAt!: Date | null
}

/**
 * 查询用户通知列表 DTO
 *
 * 支持分页查询，可按已读状态和通知分类键筛选
 * categoryKeys 支持多分类键筛选，使用分隔符连接
 */
export class QueryUserNotificationPageDto extends PageDto {
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
 * 用户通知偏好可写字段。
 */
class UserNotificationPreferenceWritableFieldsDto {
  @EnumProperty({
    description:
      '通知分类键（评论回复；评论提及；评论点赞；主题点赞；主题收藏；主题评论；主题提及；用户关注；系统公告；任务提醒）',
    example: MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.COMMENT_REPLY,
    enum: MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM,
  })
  categoryKey!: (typeof MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM)[keyof typeof MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM]

  @BooleanProperty({
    description: '是否启用该分类通知',
    example: false,
  })
  isEnabled!: boolean
}

/**
 * 更新用户通知偏好项 DTO
 *
 * 用于设置单个通知分类的启用状态
 */
export class UpdateUserNotificationPreferenceItemDto extends PickType(
  UserNotificationPreferenceWritableFieldsDto,
  ['categoryKey', 'isEnabled'] as const,
) {}

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
class BaseNotificationDeliveryQueryDto extends IntersectionType(
  NotificationDeliveryLookupFilterDto,
  PartialType(PickType(BaseNotificationDeliveryDto, ['status'] as const)),
) {}

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

class UserNotificationPreferenceOutputFieldsDto {
  @StringProperty({
    description: '通知分类中文标签',
    example: getMessageNotificationCategoryLabel('comment_reply'),
    validation: false,
  })
  categoryLabel!: string

  @BooleanProperty({
    description: '该通知分类的默认启用状态',
    example: true,
    validation: false,
  })
  defaultEnabled!: boolean

  @EnumProperty({
    description: '偏好来源（系统默认；用户显式覆盖）',
    example: MessageNotificationPreferenceSourceEnum.DEFAULT,
    enum: MessageNotificationPreferenceSourceEnum,
    validation: false,
  })
  source!: MessageNotificationPreferenceSourceEnum

  @DateProperty({
    description: '最近一次显式覆盖更新时间',
    example: '2026-04-13T12:30:00.000Z',
    nullable: true,
    validation: false,
  })
  updatedAt!: Date | null
}

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
export class UserNotificationPreferenceItemDto extends IntersectionType(
  UserNotificationPreferenceWritableFieldsDto,
  UserNotificationPreferenceOutputFieldsDto,
) {}

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
