import { ValidateEnum, ValidateNumber, ValidateString } from '@libs/base/decorators'
import { ApiProperty } from '@nestjs/swagger'
import { IsOptional } from 'class-validator'
import { SearchTypeEnum, SearchSortTypeEnum, SearchTimeFilterEnum } from '../search.constant'

/**
 * 搜索DTO
 */
export class SearchDto {
  @ValidateString({
    description: '搜索关键词',
    example: '测试',
    required: true,
    minLength: 1,
    maxLength: 100,
  })
  keyword!: string

  @ValidateEnum({
    description: '搜索类型',
    example: SearchTypeEnum.ALL,
    required: false,
    enum: SearchTypeEnum,
  })
  @IsOptional()
  type?: SearchTypeEnum

  @ValidateNumber({
    description: '板块ID',
    example: 1,
    required: false,
  })
  @IsOptional()
  sectionId?: number

  @ValidateNumber({
    description: '标签ID',
    example: 1,
    required: false,
  })
  @IsOptional()
  tagId?: number

  @ValidateEnum({
    description: '排序类型',
    example: SearchSortTypeEnum.RELEVANCE,
    required: false,
    enum: SearchSortTypeEnum,
  })
  @IsOptional()
  sort?: SearchSortTypeEnum

  @ValidateEnum({
    description: '时间筛选',
    example: SearchTimeFilterEnum.ALL,
    required: false,
    enum: SearchTimeFilterEnum,
  })
  @IsOptional()
  timeFilter?: SearchTimeFilterEnum

  @ValidateNumber({
    description: '页码',
    example: 1,
    required: false,
    min: 1,
  })
  @IsOptional()
  page?: number

  @ValidateNumber({
    description: '每页数量',
    example: 20,
    required: false,
    min: 1,
    max: 100,
  })
  @IsOptional()
  pageSize?: number
}

/**
 * 搜索结果DTO
 */
export class SearchResultDto {
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

  @ApiProperty({ description: '回复内容', example: '这是回复内容', required: false })
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

/**
 * 搜索结果分页DTO
 */
export class SearchResultPageDto {
  @ApiProperty({ description: '数据列表', type: [SearchResultDto] })
  list!: SearchResultDto[]

  @ApiProperty({ description: '总数', example: 100 })
  total!: number

  @ApiProperty({ description: '页码', example: 1 })
  page!: number

  @ApiProperty({ description: '每页数量', example: 20 })
  pageSize!: number
}
