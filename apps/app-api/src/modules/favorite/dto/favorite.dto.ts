import {
  BaseFavoriteDto,
} from '@libs/interaction/favorite'
import {
  BooleanProperty,
  NestedProperty,
} from '@libs/platform/decorators'
import { AppForumTopicPageItemDto } from '../../forum/dto/forum-topic.dto'
import { PageWorkDto } from '../../work/dto/work.dto'

export class FavoriteStatusResponseDto {
  @BooleanProperty({
    description: '是否已收藏',
    example: true,
    required: true,
    validation: false,
  })
  isFavorited!: boolean
}

export class FavoriteWorkPageItemDto extends BaseFavoriteDto {
  @NestedProperty({
    description: '作品详情',
    type: PageWorkDto,
    required: false,
    nullable: false,
    validation: false,
  })
  work!: PageWorkDto
}

export class FavoriteTopicPageItemDto extends BaseFavoriteDto {
  @NestedProperty({
    description: '论坛主题详情',
    type: AppForumTopicPageItemDto,
    required: false,
    nullable: false,
    validation: false,
  })
  topic!: AppForumTopicPageItemDto
}
