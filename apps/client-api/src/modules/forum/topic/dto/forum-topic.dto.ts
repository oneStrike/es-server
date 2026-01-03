import {
  ValidateArray,
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
import { ForumAuditStatusEnum } from '../../forum.constant'

/**
 * 标签信息DTO
 */
class TagInfoDto {
  @ApiProperty({
    description: '标签ID',
    example: 1,
    required: true,
  })
  id!: number

  @ApiProperty({
    description: '标签名称',
    example: '技术',
    required: true,
  })
  name!: number
}

/**
 * 板块信息DTO
 */
class SectionInfoDto {
  @ApiProperty({
    description: '板块ID',
    example: 1,
    required: true,
  })
  id!: number

  @ApiProperty({
    description: '板块名称',
    example: '技术交流',
    required: true,
  })
  name!: string
}

/**
 * 用户资料信息DTO
 */
class ProfileInfoDto {
  @ApiProperty({
    description: '用户资料ID',
    example: 1,
    required: true,
  })
  id!: number

  @ApiProperty({
    description: '用户ID',
    example: 1,
    required: true,
  })
  userId!: number
}

/**
 * 论坛主题基础DTO
 */
export class BaseForumTopicDto extends BaseDto {
  @ValidateString({
    description: '主题标题',
    example: '如何使用NestJS开发API',
    required: true,
    maxLength: 200,
  })
  title!: string

  @ValidateString({
    description: '主题内容',
    example: '我想学习如何使用NestJS开发API...',
    required: true,
  })
  content!: string

  @ApiProperty({
    description: '关联的板块',
    required: true,
    type: SectionInfoDto,
  })
  section!: SectionInfoDto

  @ApiProperty({
    description: '关联的用户资料',
    required: true,
    type: ProfileInfoDto,
  })
  profile!: ProfileInfoDto

  @ValidateBoolean({
    description: '是否置顶',
    example: false,
    required: true,
    default: false,
  })
  isPinned!: boolean

  @ValidateBoolean({
    description: '是否加精',
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
    description: '是否隐藏（待审核）',
    example: false,
    required: true,
    default: false,
  })
  isHidden!: boolean

  @ValidateEnum({
    description: '审核状态（0=待审核, 1=已通过, 2=已拒绝）',
    example: ForumAuditStatusEnum.APPROVED,
    required: true,
    enum: ForumAuditStatusEnum,
    default: ForumAuditStatusEnum.APPROVED,
  })
  auditStatus!: ForumAuditStatusEnum

  @ValidateNumber({
    description: '浏览量',
    example: 100,
    required: true,
    min: 0,
    default: 0,
  })
  viewCount!: number

  @ValidateNumber({
    description: '回复数',
    example: 10,
    required: true,
    min: 0,
    default: 0,
  })
  replyCount!: number

  @ValidateNumber({
    description: '点赞数',
    example: 5,
    required: true,
    min: 0,
    default: 0,
  })
  likeCount!: number

  @ValidateNumber({
    description: '收藏数',
    example: 2,
    required: true,
    min: 0,
    default: 0,
  })
  favoriteCount!: number

  @ApiProperty({
    description: '关联的标签',
    required: false,
    type: [TagInfoDto],
  })
  tags?: TagInfoDto[]
}

/**
 * 创建论坛主题DTO
 */
export class CreateForumTopicDto extends OmitType(BaseForumTopicDto, [
  ...OMIT_BASE_FIELDS,
  'isPinned',
  'isFeatured',
  'isLocked',
  'isHidden',
  'auditStatus',
  'viewCount',
  'replyCount',
  'likeCount',
  'favoriteCount',
  'section',
  'profile',
  'tags',
]) {
  @ValidateNumber({
    description: '关联的板块ID',
    example: 1,
    required: true,
    min: 1,
  })
  sectionId!: number

  @ValidateArray({
    description: '关联的标签ID列表',
    itemType: 'number',
    example: [1, 2],
    required: false,
  })
  tagIds?: number[]
}

/**
 * 更新论坛主题DTO
 */
export class UpdateForumTopicDto extends IntersectionType(
  PartialType(CreateForumTopicDto),
  IdDto,
) {}

/**
 * 查询论坛主题DTO
 */
export class QueryForumTopicDto extends IntersectionType(
  PageDto,
  IntersectionType(
    PartialType(
      PickType(BaseForumTopicDto, [
        'title',
        'isPinned',
        'isFeatured',
        'isLocked',
        'isHidden',
        'auditStatus',
        'viewCount',
        'replyCount',
        'likeCount',
        'favoriteCount',
      ]),
    ),
    PartialType(PickType(CreateForumTopicDto, ['sectionId', 'tagIds'])),
  ),
) {}

/**
 * 点赞主题DTO
 */
export class LikeTopicDto extends IntersectionType(
  IdDto,
  PickType(BaseForumTopicDto, ['isPinned']),
) {
  @ValidateBoolean({
    description: '是否点赞',
    example: true,
    required: true,
  })
  isLike!: boolean
}

/**
 * 收藏主题DTO
 */
export class FavoriteTopicDto extends IntersectionType(
  IdDto,
  PickType(BaseForumTopicDto, ['isFeatured']),
) {
  @ValidateBoolean({
    description: '是否收藏',
    example: true,
    required: true,
  })
  isFavorite!: boolean
}
