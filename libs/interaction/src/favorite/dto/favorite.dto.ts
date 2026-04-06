import { PageWorkDto } from '@libs/content/work/core/dto/work.dto';
import { PublicForumTopicPageItemDto } from '@libs/forum/topic/dto/forum-topic.dto';
import { BooleanProperty } from '@libs/platform/decorators/validate/boolean-property';
import { DateProperty } from '@libs/platform/decorators/validate/date-property';
import { EnumProperty } from '@libs/platform/decorators/validate/enum-property';
import { NestedProperty } from '@libs/platform/decorators/validate/nested-property';
import { NumberProperty } from '@libs/platform/decorators/validate/number-property';
import { IdDto, UserIdDto } from '@libs/platform/dto/base.dto';
import { PageDto } from '@libs/platform/dto/page.dto';
import { IntersectionType, PickType } from '@nestjs/swagger'
import { FavoriteTargetTypeEnum } from '../favorite.constant'

/**
 * 收藏记录基础 DTO（全量字段）
 */
export class BaseFavoriteDto extends IntersectionType(IdDto, UserIdDto) {
  @EnumProperty({
    description: '收藏目标类型（1=漫画，2=小说，3=论坛主题）',
    enum: FavoriteTargetTypeEnum,
    example: FavoriteTargetTypeEnum.WORK_COMIC,
    required: true,
  })
  targetType!: FavoriteTargetTypeEnum

  @NumberProperty({
    description: '收藏目标 ID',
    example: 1,
    required: true,
  })
  targetId!: number

  @DateProperty({
    description: '创建时间',
    example: '2024-01-01T00:00:00.000Z',
    required: true,
  })
  createdAt!: Date
}

export class FavoriteTargetDto extends PickType(BaseFavoriteDto, [
  'targetId',
  'targetType',
] as const) {}

export class FavoriteRecordDto extends IntersectionType(
  FavoriteTargetDto,
  PickType(BaseFavoriteDto, ['userId'] as const),
) {}

export class FavoritePageCommandDto extends IntersectionType(
  PageDto,
  PickType(BaseFavoriteDto, ['userId'] as const),
) {}

/**
 * 收藏状态 DTO。
 */
export class FavoriteStatusResponseDto {
  @BooleanProperty({
    description: '是否已收藏',
    example: true,
    required: true,
    validation: false,
  })
  isFavorited!: boolean
}

/**
 * 收藏作品分页项 DTO。
 */
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

/**
 * 收藏主题分页项 DTO。
 */
export class FavoriteTopicPageItemDto extends BaseFavoriteDto {
  @NestedProperty({
    description: '论坛主题详情',
    type: PublicForumTopicPageItemDto,
    required: false,
    nullable: false,
    validation: false,
  })
  topic!: PublicForumTopicPageItemDto
}
