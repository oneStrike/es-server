import { BaseFavoriteDto } from '@libs/interaction/favorite/dto/favorite.dto'
import { NestedProperty } from '@libs/platform/decorators'
import { PublicForumTopicPageItemDto } from './forum-topic.dto'

/**
 * 收藏论坛主题分页项 DTO。
 */
export class FavoriteTopicPageItemDto extends BaseFavoriteDto {
  @NestedProperty({
    description: '论坛主题详情',
    type: PublicForumTopicPageItemDto,
    required: true,
    nullable: true,
    validation: false,
  })
  topic!: PublicForumTopicPageItemDto | null
}
