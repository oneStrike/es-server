import {
  ValidateBoolean,
  ValidateEnum,
  ValidateNumber,
  ValidateString,
} from '@libs/base/decorators'
import { BaseDto, IdDto, OMIT_BASE_FIELDS, PageDto } from '@libs/base/dto'
import {
  ApiProperty,
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
import {
  ForumTopicAuditRoleEnum,
  ForumTopicAuditStatusEnum,
} from '../forum-topic.constant'

/**
 * 论坛主题基础 DTO
 * 包含论坛主题的所有基础字段定义
 */
export class BaseForumTopicDto extends BaseDto {
  @ValidateString({
    description: '主题标题',
    example: '如何学习TypeScript？',
    required: true,
    maxLength: 200,
  })
  title!: string

  @ValidateString({
    description: '主题内容',
    example: '我想学习TypeScript，有什么好的学习资源推荐吗？',
    required: true,
  })
  content!: string

  @ValidateNumber({
    description: '关联的板块ID',
    example: 1,
    required: true,
    min: 1,
  })
  sectionId!: number

  @ValidateNumber({
    description: '论坛用户资料ID',
    example: 1,
    required: true,
    min: 1,
  })
  profileId!: number

  @ValidateBoolean({
    description: '是否置顶',
    example: false,
    required: true,
    default: false,
  })
  isPinned!: boolean

  @ValidateBoolean({
    description: '是否精华',
    example: false,
    required: true,
    default: false,
  })
  isFeatured!: boolean

  @ValidateBoolean({
    description: '是否锁定',
    example: false,
    required: true,
    default: false,
  })
  isLocked!: boolean

  @ValidateBoolean({
    description: '是否隐藏',
    example: false,
    required: true,
    default: false,
  })
  isHidden!: boolean

  @ValidateEnum({
    description: '审核角色（0=版主, 1=管理员）',
    example: ForumTopicAuditRoleEnum.MODERATOR,
    required: false,
    enum: ForumTopicAuditRoleEnum,
    default: ForumTopicAuditRoleEnum.MODERATOR,
  })
  auditRole?: ForumTopicAuditRoleEnum

  @ValidateNumber({
    description: '关联的审核用户ID',
    example: 1,
    required: false,
    min: 1,
  })
  auditById?: number

  @ValidateEnum({
    description: '审核状态（0=待审核, 1=已通过, 2=已拒绝）',
    example: ForumTopicAuditStatusEnum.APPROVED,
    required: true,
    enum: ForumTopicAuditStatusEnum,
    default: ForumTopicAuditStatusEnum.APPROVED,
  })
  auditStatus!: ForumTopicAuditStatusEnum

  @ValidateString({
    description: '审核拒绝原因',
    example: '内容包含敏感信息',
    required: false,
    maxLength: 500,
  })
  auditReason?: string

  @ApiProperty({
    description: '浏览次数',
    example: 100,
    required: true,
    default: 0,
  })
  viewCount!: number

  @ApiProperty({
    description: '回复次数',
    example: 10,
    required: true,
    default: 0,
  })
  replyCount!: number

  @ApiProperty({
    description: '点赞次数',
    example: 5,
    required: true,
    default: 0,
  })
  likeCount!: number

  @ApiProperty({
    description: '收藏次数',
    example: 5,
    required: true,
    default: 0,
  })
  favoriteCount!: number

  @ApiProperty({
    description: '最后回复时间',
    example: '2022-01-01T00:00:00.000Z',
    required: false,
    type: Date,
    nullable: true,
  })
  lastReplyAt?: Date

  @ValidateNumber({
    description: '最后回复用户ID',
    example: 2,
    required: false,
  })
  lastReplyProfileId?: number
}

/**
 * 创建论坛主题 DTO
 * 用于创建新的论坛主题
 */
export class CreateForumTopicDto extends OmitType(BaseForumTopicDto, [
  ...OMIT_BASE_FIELDS,
  'viewCount',
  'replyCount',
  'likeCount',
  'favoriteCount',
  'lastReplyProfileId',
  'lastReplyAt',
  'auditStatus',
  'auditReason',
  'auditRole',
  'auditById',
  'isPinned',
  'isFeatured',
  'isLocked',
  'isHidden',
  'auditStatus',
]) {}

/**
 * 更新论坛主题 DTO
 * 用于更新现有的论坛主题
 */
export class UpdateForumTopicDto extends IntersectionType(
  CreateForumTopicDto,
  IdDto,
) {}

/**
 * 查询论坛主题 DTO
 * 用于分页查询和筛选论坛主题
 */
export class QueryForumTopicDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseForumTopicDto, [
      'sectionId',
      'profileId',
      'isPinned',
      'isFeatured',
      'isLocked',
      'isHidden',
      'auditStatus',
    ]),
  ),
) {
  @ValidateString({
    description: '关键词搜索（标题或内容）',
    example: 'TypeScript',
    required: false,
  })
  keyword?: string
}

/**
 * 更新主题审核状态 DTO
 * 用于更新论坛主题的审核状态
 */
export class UpdateTopicAuditStatusDto extends IntersectionType(
  IdDto,
  PickType(BaseForumTopicDto, ['auditStatus', 'auditReason']),
) {}

/**
 * 更新主题置顶状态 DTO
 * 用于更新论坛主题的置顶状态
 */
export class UpdateTopicPinnedDto extends IntersectionType(
  IdDto,
  PickType(BaseForumTopicDto, ['isPinned']),
) {}

/**
 * 更新主题精华状态 DTO
 * 用于更新论坛主题的精华状态
 */
export class UpdateTopicFeaturedDto extends IntersectionType(
  IdDto,
  PickType(BaseForumTopicDto, ['isFeatured']),
) {}

/**
 * 更新主题锁定状态 DTO
 * 用于更新论坛主题的锁定状态
 */
export class UpdateTopicLockedDto extends IntersectionType(
  IdDto,
  PickType(BaseForumTopicDto, ['isLocked']),
) {}

/**
 * 更新主题隐藏状态 DTO
 * 用于更新论坛主题的隐藏状态
 */
export class UpdateTopicHiddenDto extends IntersectionType(
  IdDto,
  PickType(BaseForumTopicDto, ['isHidden']),
) {}
