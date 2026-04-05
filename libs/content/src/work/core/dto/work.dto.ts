import { WorkTypeEnum, WorkViewPermissionEnum } from '@libs/platform/constant'
import {
  ArrayProperty,
  BooleanProperty,
  DateProperty,
  EnumProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseDto, IdDto, OMIT_BASE_FIELDS, PageDto } from '@libs/platform/dto'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
import { WorkSerialStatusEnum } from '../work.constant'

export class BaseWorkDto extends BaseDto {
  @EnumProperty({
    description: '作品类型',
    example: WorkTypeEnum.COMIC,
    required: true,
    enum: WorkTypeEnum,
  })
  type!: WorkTypeEnum

  @StringProperty({
    description: '作品名称',
    example: '进击的巨人',
    required: true,
    maxLength: 100,
  })
  name!: string

  @StringProperty({
    description: '作品别名',
    example: 'Attack on Titan',
    required: false,
    maxLength: 200,
  })
  alias?: string

  @StringProperty({
    description: '作品封面',
    example: 'https://example.com/cover.jpg',
    required: true,
    maxLength: 500,
  })
  cover!: string

  @StringProperty({
    description: '作品简介',
    example: '这是一部关于巨人的作品',
    required: true,
  })
  description!: string

  @StringProperty({
    description: '语言代码',
    example: 'zh-CN',
    required: true,
    maxLength: 10,
  })
  language!: string

  @StringProperty({
    description: '地区代码',
    example: 'CN',
    required: true,
    maxLength: 10,
  })
  region!: string

  @StringProperty({
    description: '年龄分级',
    example: 'R14',
    required: false,
    maxLength: 10,
  })
  ageRating?: string

  @EnumProperty({
    description: '连载状态',
    example: WorkSerialStatusEnum.SERIALIZING,
    required: true,
    enum: WorkSerialStatusEnum,
  })
  serialStatus!: WorkSerialStatusEnum

  @StringProperty({
    description: '出版社',
    example: '讲谈社',
    required: false,
    maxLength: 100,
  })
  publisher?: string

  @StringProperty({
    description: '原始来源',
    example: '官方授权',
    required: false,
    maxLength: 100,
  })
  originalSource?: string

  @StringProperty({
    description: '版权信息',
    example: '© 2024',
    required: false,
    maxLength: 500,
  })
  copyright?: string

  @StringProperty({
    description: '免责声明',
    example: '仅供学习',
    required: false,
  })
  disclaimer?: string

  @StringProperty({
    description: '备注',
    example: '管理员备注',
    required: false,
    maxLength: 1000,
  })
  remark?: string

  @BooleanProperty({ description: '是否发布', example: true, required: true })
  isPublished!: boolean

  @BooleanProperty({ description: '是否推荐', example: false, required: true })
  isRecommended!: boolean

  @BooleanProperty({ description: '是否热门', example: false, required: true })
  isHot!: boolean

  @BooleanProperty({ description: '是否新作', example: false, required: true })
  isNew!: boolean

  @DateProperty({
    description: '发布日期',
    example: '2024-01-01T00:00:00.000Z',
    required: false,
  })
  publishAt?: Date

  @DateProperty({
    description: '最近更新时间',
    example: '2024-01-01T00:00:00.000Z',
    required: false,
  })
  lastUpdated?: Date

  @EnumProperty({
    description: '查看规则',
    example: WorkViewPermissionEnum.ALL,
    required: true,
    enum: WorkViewPermissionEnum,
  })
  viewRule!: WorkViewPermissionEnum

  @NumberProperty({
    description: '阅读所需会员等级ID',
    example: 1,
    required: false,
  })
  requiredViewLevelId?: number

  @NumberProperty({ description: '论坛板块ID', example: 1, required: false })
  forumSectionId?: number

  @NumberProperty({ description: '章节默认价格', example: 0, required: true })
  chapterPrice!: number

  @BooleanProperty({
    description: '是否允许评论',
    example: true,
    required: true,
  })
  canComment!: boolean

  @NumberProperty({ description: '推荐权重', example: 1, required: true })
  recommendWeight!: number

  @NumberProperty({
    description: '浏览量',
    example: 100,
    required: true,
    validation: false,
  })
  viewCount!: number

  @NumberProperty({
    description: '收藏数',
    example: 10,
    required: true,
    validation: false,
  })
  favoriteCount!: number

  @NumberProperty({
    description: '点赞数',
    example: 10,
    required: true,
    validation: false,
  })
  likeCount!: number

  @NumberProperty({
    description: '评论数',
    example: 10,
    required: true,
    validation: false,
  })
  commentCount!: number

  @NumberProperty({
    description: '下载数',
    example: 10,
    required: true,
    validation: false,
  })
  downloadCount!: number

  @NumberProperty({
    description: '评分',
    example: 8.5,
    required: false,
    validation: false,
  })
  rating?: number

  @NumberProperty({
    description: '热度值',
    example: 1000,
    required: true,
    validation: false,
  })
  popularity!: number

  @DateProperty({
    description: '删除时间',
    example: '2024-01-01T00:00:00.000Z',
    required: false,
    validation: false,
  })
  deletedAt?: Date | null
}

export class CreateWorkDto extends OmitType(BaseWorkDto, [
  ...OMIT_BASE_FIELDS,
  'popularity',
  'viewCount',
  'favoriteCount',
  'likeCount',
  'commentCount',
  'downloadCount',
  'forumSectionId',
  'deletedAt',
] as const) {
  @ArrayProperty({
    description: '作者ID列表',
    itemType: 'number',
    example: [1],
    required: true,
  })
  authorIds!: number[]

  @ArrayProperty({
    description: '分类ID列表',
    itemType: 'number',
    example: [1],
    required: true,
  })
  categoryIds!: number[]

  @ArrayProperty({
    description: '标签ID列表',
    itemType: 'number',
    example: [1],
    required: true,
  })
  tagIds!: number[]
}

export class QueryWorkDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseWorkDto, [
      'name',
      'publisher',
      'isPublished',
      'serialStatus',
      'language',
      'region',
      'ageRating',
      'isRecommended',
      'isHot',
      'isNew',
      'type',
    ] as const),
  ),
) {
  @StringProperty({ description: '作者名称', example: '村上', required: false })
  author?: string

  @NumberProperty({ description: '作者ID', example: 1, required: false })
  authorId?: number

  @ArrayProperty({
    description: '分类ID列表',
    itemType: 'number',
    example: [1],
    required: false,
  })
  categoryIds?: number[]

  @ArrayProperty({
    description: '标签ID列表',
    itemType: 'number',
    example: [1],
    required: false,
  })
  tagIds?: number[]
}

export class QueryWorkTypeDto extends IntersectionType(
  PageDto,
  PickType(BaseWorkDto, ['type'] as const),
) {}

export class UpdateWorkDto extends IntersectionType(
  PartialType(CreateWorkDto),
  IdDto,
) {}

export class UpdateWorkStatusDto extends IntersectionType(
  IdDto,
  PickType(BaseWorkDto, ['isPublished'] as const),
) {}

export class UpdateWorkRecommendedDto extends IntersectionType(
  IdDto,
  PickType(BaseWorkDto, ['isRecommended'] as const),
) {}

export class UpdateWorkHotDto extends IntersectionType(
  IdDto,
  PickType(BaseWorkDto, ['isHot'] as const),
) {}

export class UpdateWorkNewDto extends IntersectionType(
  IdDto,
  PickType(BaseWorkDto, ['isNew'] as const),
) {}

export class QueryWorkCommentPageDto extends IntersectionType(PageDto, IdDto) {}
