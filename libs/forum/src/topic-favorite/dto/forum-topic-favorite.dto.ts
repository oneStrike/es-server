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
    description: '用户资料ID',
    example: 1,
    required: true,
    min: 1,
  })
  profileId!: number
}

export class CreateForumTopicFavoriteDto extends PickType(
  BaseForumTopicFavoriteDto,
  ['topicId', 'profileId'],
) {}

export class DeleteForumTopicFavoriteDto extends IntersectionType(
  PageDto,
  PartialType(PickType(BaseForumTopicFavoriteDto, ['topicId', 'profileId'])),
) {}

export class ToggleForumTopicFavoriteDto extends PickType(
  CreateForumTopicFavoriteDto,
  ['topicId', 'profileId'],
) {}

export class QueryForumTopicFavoriteDto extends IntersectionType(
  PageDto,
  PartialType(PickType(BaseForumTopicFavoriteDto, ['profileId'])),
) {}
