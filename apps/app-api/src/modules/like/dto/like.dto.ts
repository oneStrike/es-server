import { BaseWorkDto } from '@libs/content/work'
import { BaseForumTopicDto } from '@libs/forum/topic'
import { BaseLikeDto } from '@libs/interaction/like'
import {
  BooleanProperty,
  NestedProperty,
} from '@libs/platform/decorators'
import { PageDto } from '@libs/platform/dto'
import {
  IntersectionType,
  PartialType,
  PickType,
} from '@nestjs/swagger'

export class LikeTargetDto extends PickType(BaseLikeDto, ['targetId', 'targetType']) {}

export class LikePageQueryDto extends IntersectionType(PageDto, PickType(BaseLikeDto, ['targetType'])) {}

export class LikeStatusResponseDto {
  @BooleanProperty({
    description: '是否已点赞',
    example: true,
    required: true,
    validation: false,
  })
  isLiked!: boolean
}

class LikeWorkTargetDetailDto extends PartialType(
  PickType(BaseWorkDto, ['name', 'cover'] as const),
) {}

class LikeTopicTargetDetailDto extends PartialType(
  PickType(BaseForumTopicDto, ['title', 'images', 'videos'] as const),
) {}

export class LikeTargetDetailDto extends IntersectionType(
  PickType(BaseWorkDto, ['id'] as const),
  IntersectionType(LikeWorkTargetDetailDto, LikeTopicTargetDetailDto),
) {}

export class LikePageItemDto extends BaseLikeDto {
  @NestedProperty({
    description: '目标简要信息（作品返回 name/cover，论坛主题返回 title/images/videos）',
    type: LikeTargetDetailDto,
    required: false,
    nullable: false,
    validation: false,
  })
  targetDetail?: LikeTargetDetailDto
}
