import { BaseFollowDto } from '@libs/interaction/follow/dto/follow.dto'
import { NestedProperty } from '@libs/platform/decorators'
import { ForumHashtagBriefDto } from './forum-hashtag.dto'

/**
 * 关注话题分页项 DTO。
 */
export class FollowHashtagPageItemDto extends BaseFollowDto {
  @NestedProperty({
    description: '话题信息',
    type: ForumHashtagBriefDto,
    required: true,
    validation: false,
    nullable: true,
  })
  hashtag!: ForumHashtagBriefDto | null
}
