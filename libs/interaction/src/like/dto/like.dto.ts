import {
  BooleanProperty,
  EnumProperty,
  NestedProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseDto, IdDto, PageDto } from '@libs/platform/dto'
import { IntersectionType, PickType } from '@nestjs/swagger'
import { LikeTargetTypeEnum } from '../like.constant'

/**
 * 点赞目标 DTO
 */
export class LikeTargetDto {
  @NumberProperty({
    description: '点赞的目标id',
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
}

/**
 * 点赞列表查询 DTO
 */
export class LikePageQueryDto extends IntersectionType(
  PageDto,
  PickType(LikeTargetDto, ['targetType']),
) {}

/**
 * 点赞状态响应 DTO
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

/**
 * 点赞作品简要信息响应 DTO
 */
export class LikeWorkBriefDto extends IdDto {
  @StringProperty({
    description: '作品名称',
    example: '进击的巨人',
    required: true,
    validation: false,
  })
  name!: string

  @StringProperty({
    description: '作品封面',
    example: 'https://example.com/cover.jpg',
    required: true,
    validation: false,
  })
  cover!: string
}

/**
 * 点赞列表项响应 DTO
 */
export class LikePageItemDto extends BaseDto {
  @NumberProperty({
    description: '用户ID',
    example: 1,
    required: true,
    validation: false,
  })
  userId!: number

  @NumberProperty({
    description: '点赞目标ID',
    example: 1,
    required: true,
    validation: false,
  })
  targetId!: number

  @EnumProperty({
    description:
      '点赞目标类型（1=漫画，2=小说，3=论坛主题，4=漫画章节，5=小说章节，6=评论）',
    enum: LikeTargetTypeEnum,
    example: LikeTargetTypeEnum.WORK_COMIC,
    required: true,
    validation: false,
  })
  targetType!: LikeTargetTypeEnum

  @NestedProperty({
    description: '作品信息（仅作品类型返回）',
    type: LikeWorkBriefDto,
    required: false,
    nullable: false,
    validation: false,
  })
  work?: LikeWorkBriefDto
}

/**
 * @deprecated 使用 LikePageItemDto 替代
 */
export class LikeRecordResponseDto extends LikePageItemDto {}
