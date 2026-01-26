import { ValidateNumber } from '@libs/base/decorators'
import { BaseDto, PageDto } from '@libs/base/dto'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'

export class BaseForumTopicFavoriteDto extends BaseDto {
  @ValidateNumber({
    description: '主题ID',
    example: 1,
    required: true,
    min: 1,
  })
  topicId!: number

  @ValidateNumber({
    description: '用户ID',
    example: 1,
    required: true,
    min: 1,
  })
  userId!: number
}

export class CreateForumTopicFavoriteDto extends PickType(
  BaseForumTopicFavoriteDto,
  ['topicId', 'userId'],
) {}

export class DeleteForumTopicFavoriteDto extends IntersectionType(
  PageDto,
  PartialType(PickType(BaseForumTopicFavoriteDto, ['topicId', 'userId'])),
) {}

export class ToggleForumTopicFavoriteDto extends PickType(
  CreateForumTopicFavoriteDto,
  ['topicId', 'userId'],
) {}

export class QueryForumTopicFavoriteDto extends IntersectionType(
  PageDto,
  PartialType(PickType(BaseForumTopicFavoriteDto, ['userId'])),
) {}
