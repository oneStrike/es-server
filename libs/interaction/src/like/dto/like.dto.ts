import { BaseWorkDto } from '@libs/content/work/core/dto/work.dto';
import { BaseForumTopicDto } from '@libs/forum/topic/dto/forum-topic.dto';
import { CommentLevelEnum, SceneTypeEnum } from '@libs/platform/constant/interaction.constant';
import { BooleanProperty } from '@libs/platform/decorators/validate/boolean-property';
import { DateProperty } from '@libs/platform/decorators/validate/date-property';
import { EnumProperty } from '@libs/platform/decorators/validate/enum-property';
import { NestedProperty } from '@libs/platform/decorators/validate/nested-property';
import { NumberProperty } from '@libs/platform/decorators/validate/number-property';
import { IdDto, UserIdDto } from '@libs/platform/dto/base.dto';
import { PageDto } from '@libs/platform/dto/page.dto';
import {
  IntersectionType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
import { LikeTargetTypeEnum } from '../like.constant'

/**
 * 点赞记录基础 DTO（全量字段）
 */
export class BaseLikeDto extends IntersectionType(IdDto, UserIdDto) {
  @NumberProperty({
    description: '点赞目标 ID',
    example: 1,
    required: true,
  })
  targetId!: number

  @EnumProperty({
    description:
      '点赞目标类型（1=漫画，2=小说，3=论坛主题，4=漫画章节，5=小说章节，6=评论）',
    enum: LikeTargetTypeEnum,
    example: LikeTargetTypeEnum.WORK_COMIC,
    required: true,
  })
  targetType!: LikeTargetTypeEnum

  @EnumProperty({
    description: '业务场景类型（1=漫画作品；2=小说作品；3=论坛主题；10=漫画章节；11=小说章节；12=用户主页）',
    enum: SceneTypeEnum,
    example: SceneTypeEnum.COMIC_WORK,
    required: true,
  })
  sceneType!: SceneTypeEnum

  @NumberProperty({
    description: '业务场景根对象 ID',
    example: 1,
    required: true,
  })
  sceneId!: number

  @EnumProperty({
    description: '评论层级（1=根评论；2=回复评论）',
    enum: CommentLevelEnum,
    example: CommentLevelEnum.ROOT,
    required: false,
  })
  commentLevel?: CommentLevelEnum | null

  @DateProperty({
    description: '创建时间',
    example: '2024-01-01T00:00:00.000Z',
    required: true,
  })
  createdAt!: Date
}

export class LikeTargetDto extends PickType(BaseLikeDto, [
  'targetId',
  'targetType',
] as const) {}

export class LikeRecordDto extends IntersectionType(
  LikeTargetDto,
  PickType(BaseLikeDto, ['userId'] as const),
) {}

export class LikePageQueryDto extends IntersectionType(
  PageDto,
  PickType(BaseLikeDto, ['targetType'] as const),
) {}

/**
 * 点赞状态 DTO。
 */
export class LikeStatusResponseDto {
  @BooleanProperty({
    description: '是否已点赞',
    example: true,
    required: true,
    validation: false,
  })
  isLiked!: boolean
}

class LikeWorkTargetDetailDto extends PartialType(
  PickType(BaseWorkDto, ['name', 'cover'] as const),
) {}

class LikeTopicTargetDetailDto extends PartialType(
  PickType(BaseForumTopicDto, ['title', 'images', 'videos'] as const),
) {}

class LikeTargetPartialDetailDto extends IntersectionType(
  LikeWorkTargetDetailDto,
  LikeTopicTargetDetailDto,
) {}

/**
 * 点赞目标摘要 DTO。
 */
export class LikeTargetDetailDto extends IntersectionType(
  PickType(BaseWorkDto, ['id'] as const),
  LikeTargetPartialDetailDto,
) {}

/**
 * 点赞分页项 DTO。
 */
export class LikePageItemDto extends BaseLikeDto {
  @NestedProperty({
    description: '目标简要信息（作品返回 name/cover，论坛主题返回 title/images/videos）',
    type: LikeTargetDetailDto,
    required: false,
    nullable: false,
    validation: false,
  })
  targetDetail!: LikeTargetDetailDto
}
