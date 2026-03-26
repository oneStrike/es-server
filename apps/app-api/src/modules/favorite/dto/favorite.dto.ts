import { BaseFavoriteDto } from '@libs/interaction/favorite'
import {
  BooleanProperty,
  NestedProperty,
} from '@libs/platform/decorators'
import { BaseAppUserDto } from '@libs/user/core'
import {
  PickType,
} from '@nestjs/swagger'
import { AppForumTopicPageItemDto } from '../../forum/dto/forum-topic.dto'
import { PageWorkDto } from '../../work/dto/work.dto'

export class FavoriteTargetDto extends PickType(BaseFavoriteDto, [
  'targetId',
  'targetType',
]) {}

export class FavoriteStatusResponseDto {
  @BooleanProperty({
    description: '是否已收藏',
    example: true,
    required: true,
    validation: false,
  })
  isFavorited!: boolean
}

export class FavoriteTopicUserBriefDto extends PickType(BaseAppUserDto, [
  'id',
  'nickname',
  'avatarUrl',
] as const) {}

export class FavoriteTopicInfoDto extends AppForumTopicPageItemDto {
  @NestedProperty({
    description: '发帖用户（论坛主题类型返回）',
    type: FavoriteTopicUserBriefDto,
    required: false,
    nullable: false,
    validation: false,
  })
  user!: FavoriteTopicUserBriefDto
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
    type: FavoriteTopicInfoDto,
    required: false,
    nullable: false,
    validation: false,
  })
  topic!: FavoriteTopicInfoDto
}
