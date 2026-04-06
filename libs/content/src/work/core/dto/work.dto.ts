import { BaseAuthorDto } from '@libs/content/author/dto/author.dto';
import { BaseCategoryDto } from '@libs/content/category/dto/category.dto';
import { BaseTagDto } from '@libs/content/tag/dto/tag.dto';
import { WorkTypeEnum, WorkViewPermissionEnum } from '@libs/platform/constant/content.constant';
import { ArrayProperty } from '@libs/platform/decorators/validate/array-property';
import { BooleanProperty } from '@libs/platform/decorators/validate/boolean-property';
import { DateProperty } from '@libs/platform/decorators/validate/date-property';
import { EnumProperty } from '@libs/platform/decorators/validate/enum-property';
import { NestedProperty } from '@libs/platform/decorators/validate/nested-property';
import { NumberProperty } from '@libs/platform/decorators/validate/number-property';
import { StringProperty } from '@libs/platform/decorators/validate/string-property';
import { BaseDto, IdDto, OMIT_BASE_FIELDS } from '@libs/platform/dto/base.dto';
import { PageDto } from '@libs/platform/dto/page.dto';
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
import { BaseWorkChapterDto } from '../../chapter/dto/work-chapter.dto'
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
    contract: false,
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

class AuthorInfoDto extends PickType(BaseAuthorDto, [
  'id',
  'name',
  'type',
  'avatar',
] as const) {
  @BooleanProperty({
    description: '当前用户是否已关注该作者',
    example: true,
    required: false,
    validation: false,
  })
  isFollowed?: boolean
}

class CategoryInfoDto extends PickType(BaseCategoryDto, [
  'id',
  'name',
  'icon',
] as const) {}

class TagInfoDto extends PickType(BaseTagDto, ['id', 'name', 'icon'] as const) {}

/**
 * 作品分页项 DTO。
 */
export class PageWorkDto extends PickType(BaseWorkDto, [
  'id',
  'name',
  'type',
  'cover',
  'popularity',
  'isRecommended',
  'isHot',
  'isNew',
  'serialStatus',
  'publisher',
  'language',
  'region',
  'ageRating',
  'createdAt',
  'updatedAt',
  'publishAt',
  'isPublished',
] as const) {
  @ArrayProperty({
    description: '作者列表',
    itemClass: AuthorInfoDto,
    itemType: 'object',
    required: true,
    validation: false,
  })
  authors!: AuthorInfoDto[]

  @ArrayProperty({
    description: '分类列表',
    itemClass: CategoryInfoDto,
    itemType: 'object',
    required: true,
    validation: false,
  })
  categories!: CategoryInfoDto[]

  @ArrayProperty({
    description: '标签列表',
    itemClass: TagInfoDto,
    itemType: 'object',
    required: true,
    validation: false,
  })
  tags!: TagInfoDto[]
}

/**
 * 当前用户和作品的交互状态 DTO。
 */
export class WorkUserStatusFieldsDto {
  @BooleanProperty({
    description: '是否已点赞',
    example: true,
    required: true,
    validation: false,
  })
  liked!: boolean

  @BooleanProperty({
    description: '是否已收藏',
    example: false,
    required: true,
    validation: false,
  })
  favorited!: boolean

  @BooleanProperty({
    description: '是否已浏览',
    example: true,
    required: true,
    validation: false,
  })
  viewed!: boolean
}

/**
 * 继续阅读章节 DTO。
 */
export class ContinueReadingChapterDto extends PickType(BaseWorkChapterDto, [
  'id',
  'title',
  'subtitle',
  'sortOrder',
] as const) {}

/**
 * 阅读状态 DTO。
 */
export class WorkReadingStatusFieldsDto {
  @DateProperty({
    description: '最近阅读时间',
    example: '2026-03-09T10:00:00.000Z',
    required: false,
    validation: false,
  })
  lastReadAt?: Date

  @NestedProperty({
    description: '继续阅读章节',
    required: false,
    type: ContinueReadingChapterDto,
    validation: false,
  })
  continueChapter?: ContinueReadingChapterDto
}

class WorkDetailExtraDto extends PickType(BaseWorkDto, [
  'alias',
  'description',
  'originalSource',
  'copyright',
  'disclaimer',
  'lastUpdated',
  'viewRule',
  'requiredViewLevelId',
  'forumSectionId',
  'chapterPrice',
  'canComment',
  'viewCount',
  'favoriteCount',
  'likeCount',
  'commentCount',
  'downloadCount',
  'rating',
] as const) {}

class WorkDetailBodyDto extends IntersectionType(PageWorkDto, WorkDetailExtraDto) {}

/**
 * 作品详情 DTO。
 */
export class WorkWithUserStatusDto extends IntersectionType(
  WorkDetailBodyDto,
  WorkUserStatusFieldsDto,
) {}

/**
 * 带阅读状态的作品详情 DTO。
 */
export class WorkDetailDto extends IntersectionType(
  WorkWithUserStatusDto,
  WorkReadingStatusFieldsDto,
) {}
