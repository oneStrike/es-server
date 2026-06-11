import { BaseWorkDto } from '@libs/content/work/core/dto/work.dto';
import { CommentLevelEnum, SceneTypeEnum } from '@libs/platform/constant';
import {
  ArrayProperty,
  BooleanProperty,
  DateProperty,
  EnumProperty,
  JsonProperty,
  NestedProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators';

import { IdDto, UserIdDto } from '@libs/platform/dto/base.dto'
import { CursorPageSizeDto, PageDto } from '@libs/platform/dto/page.dto'
import { BaseAppUserDto } from '@libs/user/dto/base-app-user.dto';

import {
  IntersectionType,
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
    required: true,
    nullable: true,
    validation: false,
  })
  commentLevel!: CommentLevelEnum | null

  @DateProperty({
    description: '创建时间',
    example: '2024-01-01T00:00:00.000Z',
    required: true,
    validation: false,
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
  CursorPageSizeDto,
  PickType(BaseLikeDto, ['targetType'] as const),
) {
  @StringProperty({
    description: '下一页游标；按创建时间倒序和 ID 倒序翻页',
    example: 'eyJjcmVhdGVkQXQiOiIyMDI2LTA2LTAxVDAwOjAwOjAwLjAwMFoiLCJpZCI6MTAwfQ',
    required: false,
  })
  cursor?: string
}

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

class LikeTargetUserDto extends PickType(BaseAppUserDto, [
  'id',
  'nickname',
] as const) {}

/**
 * 点赞目标摘要 DTO。
 */
export class LikeTargetDetailDto extends PickType(BaseWorkDto, [
  'id',
] as const) {
  @StringProperty({
    description: '作品名称；目标为作品时返回',
    example: '示例漫画',
    nullable: true,
    validation: false,
  })
  name!: string | null

  @StringProperty({
    description: '作品封面；目标为作品时返回',
    example: 'https://example.com/cover.jpg',
    nullable: true,
    validation: false,
  })
  cover!: string | null

  @StringProperty({
    description: '主题标题；目标为论坛主题时返回',
    example: '如何学习 TypeScript？',
    nullable: true,
    validation: false,
  })
  title!: string | null

  @ArrayProperty({
    description: '主题图片列表；目标为论坛主题时返回',
    itemType: 'string',
    nullable: true,
    validation: false,
  })
  images!: string[] | null

  @JsonProperty({
    description: '主题视频 JSON 值；目标为论坛主题时返回',
    nullable: true,
    validation: false,
    example: [],
  })
  videos!: unknown | null

  @NumberProperty({
    description: '评论楼层；目标为评论时返回',
    example: 1,
    nullable: true,
    validation: false,
  })
  floor!: number | null

  @StringProperty({
    description: '评论内容；目标为评论时返回',
    example: '这章很精彩',
    nullable: true,
    validation: false,
  })
  content!: string | null

  @DateProperty({
    description: '评论创建时间；目标为评论时返回',
    example: '2024-01-01T00:00:00.000Z',
    nullable: true,
    validation: false,
  })
  createdAt!: Date | null

  @NestedProperty({
    description: '评论作者；目标为评论时返回',
    type: LikeTargetUserDto,
    nullable: true,
    validation: false,
  })
  user!: LikeTargetUserDto | null
}

/**
 * 点赞分页项 DTO。
 */
export class LikePageItemDto extends BaseLikeDto {
  @NestedProperty({
    description: '目标简要信息（作品返回 name/cover，论坛主题返回 title/images/videos）',
    type: LikeTargetDetailDto,
    required: true,
    nullable: true,
    validation: false,
  })
  targetDetail!: LikeTargetDetailDto | null
}
