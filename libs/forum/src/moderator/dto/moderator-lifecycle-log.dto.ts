import {
  DateProperty,
  EnumProperty,
  JsonProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { PageDto } from '@libs/platform/dto'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'
import { ForumModeratorLifecycleEventTypeEnum } from '../moderator-lifecycle-log.constant'

export class BaseForumModeratorLifecycleLogDto {
  @NumberProperty({
    description: '主键id',
    example: 1,
    required: true,
  })
  id!: number

  @EnumProperty({
    description: '生命周期事件类型',
    example: ForumModeratorLifecycleEventTypeEnum.CREATE,
    enum: ForumModeratorLifecycleEventTypeEnum,
    required: true,
  })
  eventType!: ForumModeratorLifecycleEventTypeEnum

  @NumberProperty({
    description: '关联版主ID',
    example: 1,
    required: false,
    min: 1,
  })
  moderatorId!: number | null

  @NumberProperty({
    description: '关联申请ID',
    example: 1,
    required: false,
    min: 1,
  })
  applicationId!: number | null

  @NumberProperty({
    description: '后台操作者用户ID',
    example: 1,
    required: true,
    min: 1,
  })
  actorAdminUserId!: number

  @StringProperty({
    description: '操作原因或审核意见',
    example: '符合要求',
    required: false,
    maxLength: 500,
  })
  reason!: string | null

  @JsonProperty({
    description: '操作前快照',
    required: false,
    validation: false,
    example: { roleType: 3, sectionIds: [1] },
  })
  beforeData!: unknown | null

  @JsonProperty({
    description: '操作后快照',
    required: false,
    validation: false,
    example: { roleType: 3, sectionIds: [1, 2] },
  })
  afterData!: unknown | null

  @DateProperty({
    description: '创建时间',
    example: '2026-03-19T12:00:00.000Z',
    required: true,
  })
  createdAt!: Date
}

export class ForumModeratorLifecycleLogDto extends BaseForumModeratorLifecycleLogDto {}

export class QueryForumModeratorLifecycleLogDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseForumModeratorLifecycleLogDto, [
      'eventType',
      'moderatorId',
      'applicationId',
      'actorAdminUserId',
    ] as const),
  ),
) {}
