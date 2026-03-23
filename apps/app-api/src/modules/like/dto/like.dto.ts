import { BaseWorkDto } from '@libs/content/work'
import { BaseLikeDto } from '@libs/interaction/like'
import {
  BooleanProperty,
  NestedProperty,
  StringProperty,
} from '@libs/platform/decorators'
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

export class LikeTargetDetailDto extends PickType(BaseWorkDto, ['id']) {
  @StringProperty({
    description: '作品名称（作品类型返回）',
    example: '进击的巨人',
    required: false,
    validation: false,
  })
  name?: string

  @StringProperty({
    description: '作品封面（作品类型返回）',
    example: 'https://example.com/cover.jpg',
    required: false,
    validation: false,
  })
  cover?: string

  @StringProperty({
    description: '主题标题（论坛主题类型返回）',
    example: '如何学习 TypeScript？',
    required: false,
    validation: false,
  })
  title?: string
}

export class LikePageItemDto extends BaseLikeDto {
  @NestedProperty({
    description: '目标简要信息（作品返回 name/cover，论坛主题返回 title）',
    type: LikeTargetDetailDto,
    required: false,
    nullable: false,
    validation: false,
  })
  targetDetail?: LikeTargetDetailDto
}
