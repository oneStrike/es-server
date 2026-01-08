import {
  ValidateBoolean,
  ValidateEnum,
  ValidateNumber,
  ValidateString,
} from '@libs/base/decorators'
import { BaseDto, IdDto, PageDto } from '@libs/base/dto'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
import {
  ForumTopicAuditStatusEnum,
  ForumTopicSortFieldEnum,
  ForumTopicSortOrderEnum,
} from '../forum-topic.constant'

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

  @ValidateNumber({
    description: '浏览次数',
    example: 100,
    required: true,
    min: 0,
    default: 0,
  })
  viewCount!: number

  @ValidateNumber({
    description: '回复次数',
    example: 10,
    required: true,
    min: 0,
    default: 0,
  })
  replyCount!: number

  @ValidateNumber({
    description: '点赞次数',
    example: 5,
    required: true,
    min: 0,
    default: 0,
  })
  likeCount!: number

  @ValidateNumber({
    description: '最后回复用户ID',
    example: 2,
    required: false,
  })
  lastReplyProfileId?: number

  @ValidateString({
    description: '最后回复用户昵称',
    example: '张三',
    required: false,
    maxLength: 50,
  })
  lastReplyNickname?: number

  @ValidateNumber({
    description: '最后回复时间',
    example: 1640995200000,
    required: false,
  })
  lastReplyAt?: number
}

export class CreateForumTopicDto extends OmitType(BaseForumTopicDto, [
  'id',
  'createdAt',
  'updatedAt',
  'viewCount',
  'replyCount',
  'likeCount',
  'lastReplyProfileId',
  'lastReplyNickname',
  'lastReplyAt',
  'auditStatus',
  'auditReason',
]) {}

export class UpdateForumTopicDto extends IntersectionType(
  PartialType(
    OmitType(BaseForumTopicDto, [
      'id',
      'createdAt',
      'updatedAt',
      'viewCount',
      'replyCount',
      'likeCount',
      'lastReplyProfileId',
      'lastReplyNickname',
      'lastReplyAt',
    ]),
  ),
  IdDto,
) {}

export class QueryForumTopicDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseForumTopicDto, [
      'title',
      'content',
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
  @ValidateEnum({
    description: '排序字段（createdAt=创建时间, updatedAt=更新时间, viewCount=浏览数, replyCount=回复数, likeCount=点赞数）',
    example: ForumTopicSortFieldEnum.CREATED_AT,
    required: false,
    enum: ForumTopicSortFieldEnum,
  })
  sortBy?: ForumTopicSortFieldEnum

  @ValidateEnum({
    description: '排序方式（asc=升序, desc=降序）',
    example: ForumTopicSortOrderEnum.DESC,
    required: false,
    enum: ForumTopicSortOrderEnum,
  })
  sortOrder?: ForumTopicSortOrderEnum

  @ValidateString({
    description: '关键词搜索（标题或内容）',
    example: 'TypeScript',
    required: false,
  })
  keyword?: string
}

export class UpdateTopicAuditStatusDto extends IntersectionType(
  IdDto,
  PickType(BaseForumTopicDto, ['auditStatus', 'auditReason']),
) {}

export class UpdateTopicPinnedDto extends IntersectionType(
  IdDto,
  PickType(BaseForumTopicDto, ['isPinned']),
) {}

export class UpdateTopicFeaturedDto extends IntersectionType(
  IdDto,
  PickType(BaseForumTopicDto, ['isFeatured']),
) {}

export class UpdateTopicLockedDto extends IntersectionType(
  IdDto,
  PickType(BaseForumTopicDto, ['isLocked']),
) {}

/**
 * 更新主题隐藏状态DTO
 * 用于更新主题的隐藏状态
 */
export class UpdateTopicHiddenDto extends IntersectionType(
  IdDto,
  PickType(BaseForumTopicDto, ['isHidden']),
) {}
