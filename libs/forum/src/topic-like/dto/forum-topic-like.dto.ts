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

export class QueryForumTopicLikeDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseForumTopicLikeDto, ['topicId', 'profileId']),
  ),
) {}

export class ToggleTopicLikeDto extends PickType(CreateForumTopicLikeDto, [
  'topicId',
  'profileId',
]) {}
