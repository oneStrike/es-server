import { PageDto } from '@libs/base/dto'
import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator'
import { TimeRangeEnum } from '../analytics.constant'

/**
 * 论坛概览数据 DTO
 */
export class ForumOverviewDto {
  @ApiProperty({ description: '总用户数', example: 1000 })
  totalUsers!: number

  @ApiProperty({ description: '总主题数', example: 500 })
  totalTopics!: number

  @ApiProperty({ description: '总回复数', example: 2000 })
  totalReplies!: number

  @ApiProperty({ description: '总板块数', example: 10 })
  totalSections!: number

  @ApiProperty({ description: '今日新增主题数', example: 10 })
  todayTopics!: number

  @ApiProperty({ description: '今日新增回复数', example: 50 })
  todayReplies!: number

  @ApiProperty({ description: '今日新增用户数', example: 5 })
  todayUsers!: number

  @ApiProperty({ description: '活跃用户数（7天内）', example: 100 })
  activeUsers!: number

  @ApiProperty({ description: '在线用户数', example: 20 })
  onlineUsers!: number
}

/**
 * 活跃度趋势数据点 DTO
 */
export class ActivityTrendPointDto {
  @ApiProperty({ description: '日期', example: '2024-01-01' })
  date!: string

  @ApiProperty({ description: '主题数', example: 10 })
  topicCount!: number

  @ApiProperty({ description: '回复数', example: 50 })
  replyCount!: number

  @ApiProperty({ description: '用户数', example: 5 })
  userCount!: number

  @ApiProperty({ description: '访问数', example: 100 })
  visitCount!: number
}

/**
 * 活跃度趋势查询 DTO
 */
export class ActivityTrendQueryDto {
  @ApiProperty({
    description: '时间范围',
    enum: TimeRangeEnum,
    example: TimeRangeEnum.LAST_7_DAYS,
  })
  @IsEnum(TimeRangeEnum)
  @IsOptional()
  timeRange?: TimeRangeEnum

  @ApiProperty({
    description: '开始日期',
    example: '2024-01-01',
    required: false,
  })
  @IsString()
  @IsOptional()
  startDate?: string

  @ApiProperty({
    description: '结束日期',
    example: '2024-01-31',
    required: false,
  })
  @IsString()
  @IsOptional()
  endDate?: string
}

/**
 * 热门主题 DTO
 */
export class HotTopicDto {
  @ApiProperty({ description: '主题ID', example: 1 })
  id!: number

  @ApiProperty({ description: '主题标题', example: '这是一个热门主题' })
  title!: string

  @ApiProperty({ description: '板块ID', example: 1 })
  sectionId!: number

  @ApiProperty({ description: '板块名称', example: '技术交流' })
  sectionName!: string

  @ApiProperty({ description: '作者ID', example: 1 })
  authorId!: number

  @ApiProperty({ description: '作者昵称', example: '张三' })
  authorNickname!: string

  @ApiProperty({ description: '浏览次数', example: 1000 })
  viewCount!: number

  @ApiProperty({ description: '回复次数', example: 50 })
  replyCount!: number

  @ApiProperty({ description: '点赞次数', example: 20 })
  likeCount!: number

  @ApiProperty({ description: '创建时间', example: '2024-01-01 10:00:00' })
  createdAt!: string
}

/**
 * 热门主题查询 DTO
 */
export class HotTopicsQueryDto extends PageDto {
  @ApiProperty({
    description: '时间范围',
    enum: TimeRangeEnum,
    example: TimeRangeEnum.LAST_7_DAYS,
    required: false,
  })
  @IsEnum(TimeRangeEnum)
  @IsOptional()
  timeRange?: TimeRangeEnum

  @ApiProperty({ description: '板块ID', example: 1, required: false })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  sectionId?: number

  @ApiProperty({
    description: '排序方式',
    example: 'viewCount',
    required: false,
  })
  @IsString()
  @IsOptional()
  sortBy?: 'viewCount' | 'replyCount' | 'likeCount'
}

/**
 * 活跃用户 DTO
 */
export class ActiveUserDto {
  @ApiProperty({ description: '用户ID', example: 1 })
  id!: number

  @ApiProperty({ description: '用户昵称', example: '张三' })
  nickname!: string

  @ApiProperty({
    description: '头像',
    example: 'https://example.com/avatar.jpg',
    required: false,
  })
  avatar?: string

  @ApiProperty({ description: '积分', example: 1000 })
  points!: number

  @ApiProperty({ description: '等级', example: 5 })
  level!: number

  @ApiProperty({ description: '主题数', example: 10 })
  topicCount!: number

  @ApiProperty({ description: '回复数', example: 50 })
  replyCount!: number

  @ApiProperty({ description: '最后活跃时间', example: '2024-01-01 10:00:00' })
  lastActiveAt!: string
}

/**
 * 活跃用户查询 DTO
 */
export class ActiveUsersQueryDto extends PageDto {
  @ApiProperty({
    description: '时间范围',
    enum: TimeRangeEnum,
    example: TimeRangeEnum.LAST_7_DAYS,
    required: false,
  })
  @IsEnum(TimeRangeEnum)
  @IsOptional()
  timeRange?: TimeRangeEnum

  @ApiProperty({ description: '排序方式', example: 'points', required: false })
  @IsString()
  @IsOptional()
  sortBy?: 'points' | 'topicCount' | 'replyCount' | 'lastActiveAt'
}

/**
 * 板块统计 DTO
 */
export class SectionStatsDto {
  @ApiProperty({ description: '板块ID', example: 1 })
  id!: number

  @ApiProperty({ description: '板块名称', example: '技术交流' })
  name!: number

  @ApiProperty({ description: '主题数', example: 100 })
  topicCount!: number

  @ApiProperty({ description: '回复数', example: 500 })
  replyCount!: number

  @ApiProperty({ description: '用户数', example: 50 })
  userCount!: number

  @ApiProperty({ description: '今日新增主题数', example: 5 })
  todayTopics!: number

  @ApiProperty({ description: '今日新增回复数', example: 20 })
  todayReplies!: number

  @ApiProperty({ description: '今日活跃用户数', example: 10 })
  todayActiveUsers!: number
}

/**
 * 板块统计查询 DTO
 */
export class SectionStatsQueryDto extends PageDto {
  @ApiProperty({ description: '板块ID', example: 1, required: false })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  sectionId?: number

  @ApiProperty({
    description: '排序方式',
    example: 'topicCount',
    required: false,
  })
  @IsString()
  @IsOptional()
  sortBy?:
    | 'topicCount'
    | 'replyCount'
    | 'userCount'
    | 'todayTopics'
    | 'todayReplies'
}
