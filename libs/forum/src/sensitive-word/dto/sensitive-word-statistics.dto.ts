import { ApiProperty } from '@nestjs/swagger'
import {
  ForumSensitiveWordLevelEnum,
  ForumSensitiveWordTypeEnum,
  ForumStatisticsTypeEnum,
} from '../sensitive-word-constant'

/**
 * 统计查询请求DTO
 */
export class ForumSensitiveWordStatisticsQueryDto {
  @ApiProperty({
    description: '统计类型',
    required: false,
    example: 'level',
    enum: ForumStatisticsTypeEnum,
  })
  type?: ForumStatisticsTypeEnum
}

/**
 * 级别统计结果DTO
 */
export class ForumForumSensitiveWordLevelStatisticsDto {
  @ApiProperty({
    description: '敏感词级别',
    example: ForumSensitiveWordLevelEnum.SEVERE,
    enum: ForumSensitiveWordLevelEnum,
  })
  level!: number

  @ApiProperty({
    description: '级别名称',
    example: '严重',
  })
  levelName!: string

  @ApiProperty({
    description: '该级别的敏感词数量',
    example: 100,
  })
  count!: number

  @ApiProperty({
    description: '该级别的敏感词命中总次数',
    example: 5000,
  })
  hitCount!: number
}

/**
 * 类型统计结果DTO
 */
export class ForumForumSensitiveWordTypeStatisticsDto {
  @ApiProperty({
    description: '敏感词类型',
    example: ForumSensitiveWordTypeEnum.POLITICS,
    enum: ForumSensitiveWordTypeEnum,
  })
  type!: number

  @ApiProperty({
    description: '类型名称',
    example: '政治',
  })
  typeName!: string

  @ApiProperty({
    description: '该类型的敏感词数量',
    example: 50,
  })
  count!: number

  @ApiProperty({
    description: '该类型的敏感词命中总次数',
    example: 3000,
  })
  hitCount!: number
}

/**
 * 热门敏感词统计DTO
 */
export class ForumSensitiveWordTopHitStatisticsDto {
  @ApiProperty({
    description: '敏感词内容',
    example: '测试',
  })
  word!: string

  @ApiProperty({
    description: '命中次数',
    example: 1000,
  })
  hitCount!: number

  @ApiProperty({
    description: '敏感词级别',
    example: ForumSensitiveWordLevelEnum.SEVERE,
    enum: ForumSensitiveWordLevelEnum,
  })
  level!: number

  @ApiProperty({
    description: '敏感词类型',
    example: ForumSensitiveWordTypeEnum.POLITICS,
    enum: ForumSensitiveWordTypeEnum,
  })
  type!: number

  @ApiProperty({
    description: '最后命中时间',
    example: '2024-01-01T00:00:00.000Z',
  })
  lastHitAt!: Date | null
}

/**
 * 最近命中统计DTO
 */
export class ForumSensitiveWordRecentHitStatisticsDto {
  @ApiProperty({
    description: '敏感词内容',
    example: '测试',
  })
  word!: string

  @ApiProperty({
    description: '命中次数',
    example: 50,
  })
  hitCount!: number

  @ApiProperty({
    description: '敏感词级别',
    example: ForumSensitiveWordLevelEnum.GENERAL,
    enum: ForumSensitiveWordLevelEnum,
  })
  level!: number

  @ApiProperty({
    description: '敏感词类型',
    example: ForumSensitiveWordTypeEnum.VIOLENCE,
    enum: ForumSensitiveWordTypeEnum,
  })
  type!: number

  @ApiProperty({
    description: '最后命中时间',
    example: '2024-01-01T00:00:00.000Z',
  })
  lastHitAt!: Date
}

/**
 * 完整统计数据DTO
 */
export class ForumSensitiveWordStatisticsDataDto {
  @ApiProperty({
    description: '敏感词总数',
    example: 500,
  })
  totalWords!: number

  @ApiProperty({
    description: '启用的敏感词数量',
    example: 450,
  })
  enabledWords!: number

  @ApiProperty({
    description: '禁用的敏感词数量',
    example: 50,
  })
  disabledWords!: number

  @ApiProperty({
    description: '敏感词总命中次数',
    example: 100000,
  })
  totalHits!: number

  @ApiProperty({
    description: '今日命中次数',
    example: 500,
  })
  todayHits!: number

  @ApiProperty({
    description: '最近一周命中次数',
    example: 3000,
  })
  lastWeekHits!: number

  @ApiProperty({
    description: '最近一月命中次数',
    example: 10000,
  })
  lastMonthHits!: number

  @ApiProperty({
    description: '按级别分组的统计信息',
    type: [ForumForumSensitiveWordLevelStatisticsDto],
  })
  levelStatistics!: ForumForumSensitiveWordLevelStatisticsDto[]

  @ApiProperty({
    description: '按类型分组的统计信息',
    type: [ForumForumSensitiveWordTypeStatisticsDto],
  })
  typeStatistics!: ForumForumSensitiveWordTypeStatisticsDto[]

  @ApiProperty({
    description: '命中次数最多的敏感词（Top 20）',
    type: [ForumSensitiveWordTopHitStatisticsDto],
  })
  topHitWords!: ForumSensitiveWordTopHitStatisticsDto[]

  @ApiProperty({
    description: '最近命中的敏感词（Top 20）',
    type: [ForumSensitiveWordRecentHitStatisticsDto],
  })
  recentHitWords!: ForumSensitiveWordRecentHitStatisticsDto[]
}

/**
 * 统计查询响应DTO
 */
export class ForumSensitiveWordStatisticsResponseDto {
  @ApiProperty({
    description: '统计类型',
    example: 'level',
    enum: ForumStatisticsTypeEnum,
  })
  type!: ForumStatisticsTypeEnum

  @ApiProperty({
    description: '统计数据',
    oneOf: [
      {
        type: 'array',
        items: {
          $ref: '#/components/schemas/ForumForumSensitiveWordLevelStatisticsDto',
        },
      },
      {
        type: 'array',
        items: {
          $ref: '#/components/schemas/ForumForumSensitiveWordTypeStatisticsDto',
        },
      },
      {
        type: 'array',
        items: {
          $ref: '#/components/schemas/ForumSensitiveWordTopHitStatisticsDto',
        },
      },
      {
        type: 'array',
        items: {
          $ref: '#/components/schemas/ForumSensitiveWordRecentHitStatisticsDto',
        },
      },
    ],
  })
  data!:
    | ForumForumSensitiveWordLevelStatisticsDto[]
    | ForumForumSensitiveWordTypeStatisticsDto[]
    | ForumSensitiveWordTopHitStatisticsDto[]
    | ForumSensitiveWordRecentHitStatisticsDto[]
}
