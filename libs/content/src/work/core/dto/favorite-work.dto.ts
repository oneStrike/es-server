import { BaseFavoriteDto } from '@libs/interaction/favorite/dto/favorite.dto'
import { NestedProperty } from '@libs/platform/decorators'
import { PageWorkDto } from './work.dto'

/**
 * 收藏作品分页项 DTO。
 */
export class FavoriteWorkPageItemDto extends BaseFavoriteDto {
  @NestedProperty({
    description: '作品详情',
    type: PageWorkDto,
    required: true,
    nullable: true,
    validation: false,
  })
  work!: PageWorkDto | null
}
