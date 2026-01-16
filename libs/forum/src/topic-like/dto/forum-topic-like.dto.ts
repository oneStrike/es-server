import {
  ValidateNumber,
} from '@libs/base/decorators'
import { BaseDto, PageDto } from '@libs/base/dto'
import {
  IntersectionType,
  PartialType,
  PickType,
} from '@nestjs/swagger'

export class BaseForumTopicLikeDto extends BaseDto {
  @ValidateNumber({
    description: '主题ID',
    example: 1,
    required: true,
    min: 1,
  })
  topicId!: number

  @ValidateNumber({
    description: '用户资料ID',
    example: 1,
    required: true,
    min: 1,
  })
  profileId!: number
}

export class CreateForumTopicLikeDto extends PickType(BaseForumTopicLikeDto, [
  'topicId',
  'profileId',
]) {}

/**
 * 删除主题点赞DTO
 * 用于删除主题点赞记录
 */
export class DeleteForumTopicLikeDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseForumTopicLikeDto, ['topicId', 'profileId']),
  ),
) {}

/**
 * 切换主题点赞状态DTO
 * 用于切换主题的点赞状态（点赞/取消点赞）
 */
export class ToggleForumTopicLikeDto extends PickType(CreateForumTopicLikeDto, [
  'topicId',
  'profileId',
]) {}

export class QueryForumTopicLikeDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseForumTopicLikeDto, ['topicId', 'profileId']),
  ),
) {}
