import {
  EnumProperty,
  NumberProperty,
  StringProperty,
} from '@libs/base/decorators'
import { BaseDto, PageDto } from '@libs/base/dto'
import {
  IntersectionType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
import { ForumViewTypeEnum } from '../forum-view.constant'

export class BaseForumViewDto extends BaseDto {
  @NumberProperty({
    description: '主题ID',
    example: 1,
    required: true,
    min: 1,
  })
  topicId!: number

  @NumberProperty({
    description: '回复ID（查看回复时必填）',
    example: 1,
    required: false,
  })
  replyId?: number

  @NumberProperty({
    description: '用户ID',
    example: 1,
    required: true,
    min: 1,
  })
  userId!: number

  @StringProperty({
    description: '用户IP地址',
    example: '192.168.1.1',
    required: false,
  })
  ipAddress?: string

  @StringProperty({
    description: '用户代理',
    example: 'Mozilla/5.0...',
    required: false,
  })
  userAgent?: string

  @EnumProperty({
    description: '查看类型（topic=主题, reply=回复）',
    example: ForumViewTypeEnum.TOPIC,
    required: true,
    enum: ForumViewTypeEnum,
  })
  type!: ForumViewTypeEnum

  @NumberProperty({
    description: '停留时长（秒）',
    example: 30,
    required: false,
    min: 0,
  })
  duration?: number
}

/**
 * 创建浏览记录DTO
 * 用于创建新的浏览记录
 */
export class CreateForumViewDto extends PickType(BaseForumViewDto, [
  'topicId',
  'replyId',
  'userId',
  'ipAddress',
  'userAgent',
  'type',
  'duration',
]) {}

export class QueryForumViewDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseForumViewDto, ['topicId', 'userId', 'type', 'ipAddress']),
  ),
) {}

export class ForumViewStatisticsDto {
  @NumberProperty({
    description: '主题ID',
    example: 1,
    required: true,
    min: 1,
  })
  topicId!: number
}
