import {
  DateProperty,
  EnumProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { IdDto, PageDto } from '@libs/platform/dto'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
import {
  ForumModeratorActionTargetTypeEnum,
  ForumModeratorActionTypeEnum,
} from '../moderator-action-log.constant'

/**
 * 版主操作日志基础 DTO。
 * 严格对应 forum_moderator_action_log 表对外可查询字段。
 */
export class BaseForumModeratorActionLogDto extends IdDto {
  @NumberProperty({
    description: '版主ID',
    example: 1,
    required: true,
    min: 1,
  })
  moderatorId!: number

  @NumberProperty({
    description: '操作目标ID',
    example: 100,
    required: true,
    min: 1,
  })
  targetId!: number

  @EnumProperty({
    description:
      '操作类型（1=置顶主题；2=取消置顶主题；3=加精主题；4=取消加精主题；5=锁定主题；6=取消锁定主题；7=删除主题；8=移动主题；9=审核主题；10=删除评论；11=隐藏主题；12=取消隐藏主题；13=审核评论；14=隐藏评论；15=取消隐藏评论）',
    example: ForumModeratorActionTypeEnum.HIDE_COMMENT,
    required: true,
    enum: ForumModeratorActionTypeEnum,
  })
  actionType!: ForumModeratorActionTypeEnum

  @EnumProperty({
    description: '操作目标类型（1=论坛主题；2=论坛评论）',
    example: ForumModeratorActionTargetTypeEnum.COMMENT,
    required: true,
    enum: ForumModeratorActionTargetTypeEnum,
  })
  targetType!: ForumModeratorActionTargetTypeEnum

  @StringProperty({
    description: '操作描述',
    example: '隐藏评论',
    required: true,
    maxLength: 200,
  })
  actionDescription!: string

  @StringProperty({
    description: '操作前数据快照',
    example: '{"isHidden":false}',
    required: false,
    validation: false,
  })
  beforeData?: string | null

  @StringProperty({
    description: '操作后数据快照',
    example: '{"isHidden":true}',
    required: false,
    validation: false,
  })
  afterData?: string | null

  @DateProperty({
    description: '操作时间',
    example: '2026-01-01T00:00:00.000Z',
    required: true,
    validation: false,
  })
  createdAt!: Date
}

export class ForumModeratorActionLogDto extends BaseForumModeratorActionLogDto {}

export class AppForumModeratorActionLogDto extends OmitType(
  BaseForumModeratorActionLogDto,
  ['beforeData', 'afterData'] as const,
) {}

class QueryForumModeratorActionLogFilterDto extends PartialType(
  PickType(BaseForumModeratorActionLogDto, [
    'targetId',
    'targetType',
    'actionType',
  ] as const),
) {}

export class QueryAppForumModeratorActionLogDto extends IntersectionType(
  PageDto,
  QueryForumModeratorActionLogFilterDto,
) {}

export class QueryAdminForumModeratorActionLogDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseForumModeratorActionLogDto, [
      'moderatorId',
      'targetId',
      'targetType',
      'actionType',
    ] as const),
  ),
) {}
