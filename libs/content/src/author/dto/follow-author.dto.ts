import { BaseFollowDto } from '@libs/interaction/follow/dto/follow.dto'
import { BooleanProperty, NestedProperty } from '@libs/platform/decorators'
import { IntersectionType, PickType } from '@nestjs/swagger'
import { AuthorNullableOutputFieldsDto, BaseAuthorDto } from './author.dto'

/**
 * 关注作者摘要 DTO。
 */
export class FollowAuthorBriefDto extends IntersectionType(
  PickType(BaseAuthorDto, ['id', 'name', 'followersCount'] as const),
  PickType(AuthorNullableOutputFieldsDto, ['avatar', 'type'] as const),
) {
  @BooleanProperty({
    description: '当前用户是否已关注该作者',
    example: true,
    validation: false,
  })
  isFollowed!: boolean
}

/**
 * 关注作者分页项 DTO。
 */
export class FollowAuthorPageItemDto extends BaseFollowDto {
  @NestedProperty({
    description: '作者信息',
    type: FollowAuthorBriefDto,
    required: true,
    validation: false,
    nullable: true,
  })
  author!: FollowAuthorBriefDto | null
}
