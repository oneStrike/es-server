import {
  EnumProperty,
  NumberProperty,
  StringProperty,
} from '@libs/base/decorators'
import { PageDto } from '@libs/base/dto'
import { ApiProperty, OmitType } from '@nestjs/swagger'
import { ForumSearchSortTypeEnum, ForumSearchTypeEnum } from '../search.constant'

/**
 * 搜索DTO
 */
export class ForumSearchDto extends PageDto {
  @StringProperty({
    description: '搜索关键词',
    example: '测试',
    required: true,
    minLength: 1,
    maxLength: 100,
  })
  keyword!: string

  @EnumProperty({
    description: '搜索类型',
    example: ForumSearchTypeEnum.ALL,
    required: false,
    enum: ForumSearchTypeEnum,
  })
  type?: ForumSearchTypeEnum

  @NumberProperty({
    description: '板块ID',
    example: 1,
    required: false,
  })
  sectionId?: number

  @NumberProperty({
    description: '标签ID',
    example: 1,
    required: false,
  })
  tagId?: number

  @EnumProperty({
    description: '排序类型',
    example: ForumSearchSortTypeEnum.RELEVANCE,
    required: false,
    enum: ForumSearchSortTypeEnum,
  })
  sort?: ForumSearchSortTypeEnum
}

export class ForumSearchTopicDto extends OmitType(ForumSearchDto, ['type']) {}
export class ForumSearchReplyDto extends OmitType(ForumSearchDto, ['type']) {}

/**
 * 搜索结果DTO
 * 返回搜索结果的数据结构
 */
export class ForumSearchResultDto {
  @ApiProperty({ description: '主题ID', example: 1 })
  topicId!: number

  @ApiProperty({ description: '主题标题', example: '测试主题' })
  topicTitle!: string

  @ApiProperty({ description: '主题内容', example: '这是测试内容' })
  topicContent!: string

  @ApiProperty({ description: '板块ID', example: 1 })
  sectionId!: number

  @ApiProperty({ description: '板块名称', example: '技术交流' })
  sectionName!: string

  @ApiProperty({ description: '用户ID', example: 1 })
  userId!: number

  @ApiProperty({ description: '用户昵称', example: '张三' })
  userNickname!: string

  @ApiProperty({ description: '回复ID', example: 1, required: false })
  replyId?: number

  @ApiProperty({
    description: '回复内容',
    example: '这是回复内容',
    required: false,
  })
  replyContent?: string

  @ApiProperty({ description: '创建时间', example: '2024-01-01T00:00:00.000Z' })
  createdAt!: Date

  @ApiProperty({ description: '回复数', example: 10 })
  replyCount!: number

  @ApiProperty({ description: '浏览数', example: 100 })
  viewCount!: number

  @ApiProperty({ description: '点赞数', example: 5 })
  likeCount!: number
}
