import { BaseFollowDto } from '@libs/interaction/follow/dto/follow.dto'
import { NestedProperty } from '@libs/platform/decorators'
import { PublicForumSectionListItemDto } from './forum-section.dto'

/**
 * 关注板块分页项 DTO。
 */
export class FollowSectionPageItemDto extends BaseFollowDto {
  @NestedProperty({
    description: '板块信息',
    type: PublicForumSectionListItemDto,
    required: true,
    validation: false,
    nullable: true,
  })
  section!: PublicForumSectionListItemDto | null
}
