import { BaseWorkDto } from '@libs/content'
import { BaseLikeDto } from '@libs/interaction'
import { BooleanProperty, NestedProperty } from '@libs/platform/decorators'
import { PageDto } from '@libs/platform/dto'
import { IntersectionType, PickType } from '@nestjs/swagger'

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

export class LikeWorkBriefDto extends PickType(BaseWorkDto, ['id', 'name', 'cover']) {}

export class LikePageItemDto extends BaseLikeDto {
  @NestedProperty({
    description: '作品信息（仅作品类型返回）',
    type: LikeWorkBriefDto,
    required: false,
    nullable: false,
    validation: false,
  })
  work?: LikeWorkBriefDto
}
