import {
  DateProperty,
  EnumProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { PageDto } from '@libs/platform/dto'
import { ForumSearchSortTypeEnum, ForumSearchTypeEnum } from '../search.constant'

/**
 * 论坛搜索查询 DTO。
 * 供 app/public 与后台复用同一套搜索参数契约。
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
    description: '搜索类型（all=全部；topic=主题；comment=评论）',
    example: ForumSearchTypeEnum.ALL,
    required: false,
    enum: ForumSearchTypeEnum,
  })
  type?: ForumSearchTypeEnum

  @NumberProperty({
    description: '板块ID',
    example: 1,
    required: false,
    min: 1,
  })
  sectionId?: number

  @NumberProperty({
    description: '标签ID',
    example: 1,
    required: false,
    min: 1,
  })
  tagId?: number

  @EnumProperty({
    description: '排序类型（relevance=相关度；latest=最新；hot=最热）',
    example: ForumSearchSortTypeEnum.RELEVANCE,
    required: false,
    enum: ForumSearchSortTypeEnum,
  })
  sort?: ForumSearchSortTypeEnum
}

/**
 * 论坛搜索结果项 DTO。
 * 统一承载主题和评论搜索结果，便于分页接口直接复用。
 */
export class ForumSearchResultDto {
  @EnumProperty({
    description: '结果类型（topic=主题；comment=评论）',
    example: ForumSearchTypeEnum.TOPIC,
    enum: ForumSearchTypeEnum,
    validation: false,
  })
  resultType!: ForumSearchTypeEnum

  @NumberProperty({
    description: '主题ID',
    example: 1,
    validation: false,
  })
  topicId!: number

  @StringProperty({
    description: '主题标题',
    example: '测试主题',
    validation: false,
  })
  topicTitle!: string

  @StringProperty({
    description: '主题内容摘要',
    example: '这是测试内容',
    required: false,
    validation: false,
  })
  topicContentSnippet?: string

  @NumberProperty({
    description: '板块ID',
    example: 1,
    validation: false,
  })
  sectionId!: number

  @StringProperty({
    description: '板块名称',
    example: '技术交流',
    validation: false,
  })
  sectionName!: string

  @NumberProperty({
    description: '用户ID',
    example: 1,
    validation: false,
  })
  userId!: number

  @StringProperty({
    description: '用户昵称',
    example: '张三',
    validation: false,
  })
  userNickname!: string

  @StringProperty({
    description: '用户头像',
    example: 'https://example.com/avatar.png',
    required: false,
    validation: false,
  })
  userAvatarUrl?: string

  @NumberProperty({
    description: '评论ID；仅评论搜索结果返回。',
    example: 1,
    required: false,
    validation: false,
  })
  commentId?: number

  @StringProperty({
    description: '评论内容摘要；仅评论搜索结果返回。',
    example: '这是评论内容',
    required: false,
    validation: false,
  })
  commentContentSnippet?: string

  @DateProperty({
    description: '创建时间',
    example: '2024-01-01T00:00:00.000Z',
    validation: false,
  })
  createdAt!: Date

  @NumberProperty({
    description: '评论数',
    example: 10,
    validation: false,
  })
  commentCount!: number

  @NumberProperty({
    description: '浏览数',
    example: 100,
    validation: false,
  })
  viewCount!: number

  @NumberProperty({
    description: '点赞数',
    example: 5,
    validation: false,
  })
  likeCount!: number

  @NumberProperty({
    description: '收藏数',
    example: 5,
    validation: false,
  })
  favoriteCount!: number
}
