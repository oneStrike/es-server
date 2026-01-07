import {
  ValidateEnum,
  ValidateNumber,
  ValidateString,
} from '@libs/base/decorators'
import { BaseDto, PageDto } from '@libs/base/dto'
import {
  IntersectionType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
import { ForumViewTypeEnum } from '../forum-view.constant'

export class BaseForumViewDto extends BaseDto {
  @ValidateNumber({
    description: '主题ID',
    example: 1,
    required: true,
    min: 1,
  })
  topicId!: number

  @ValidateNumber({
    description: '回复ID（查看回复时必填）',
    example: 1,
    required: false,
  })
  replyId?: number

  @ValidateNumber({
    description: '用户资料ID',
    example: 1,
    required: true,
    min: 1,
  })
  profileId!: number

  @ValidateString({
    description: '用户IP地址',
    example: '192.168.1.1',
    required: false,
  })
  ipAddress?: string

  @ValidateString({
    description: '用户代理',
    example: 'Mozilla/5.0...',
    required: false,
  })
  userAgent?: string

  @ValidateEnum({
    description: '查看类型（topic=主题, reply=回复）',
    example: ForumViewTypeEnum.TOPIC,
    required: true,
    enum: ForumViewTypeEnum,
  })
  type!: ForumViewTypeEnum

  @ValidateNumber({
    description: '停留时长（秒）',
    example: 30,
    required: false,
    min: 0,
  })
  duration?: number
}

export class CreateForumViewDto extends PickType(BaseForumViewDto, [
  'topicId',
  'replyId',
  'profileId',
  'ipAddress',
  'userAgent',
  'type',
  'duration',
]) {}

export class QueryForumViewDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseForumViewDto, ['topicId', 'profileId', 'type', 'ipAddress']),
  ),
) {}

export class ViewStatisticsDto {
  @ValidateNumber({
    description: '主题ID',
    example: 1,
    required: true,
    min: 1,
  })
  topicId!: number
}
