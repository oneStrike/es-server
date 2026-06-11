import {
  AuthorNullableOutputFieldsDto,
  BaseAuthorDto,
} from '@libs/content/author/dto/author.dto'
import {
  BaseCategoryDto,
  CategoryOutputDto,
} from '@libs/content/category/dto/category.dto'
import { BaseTagDto, TagOutputDto } from '@libs/content/tag/dto/tag.dto'
import { CommentSortDto } from '@libs/interaction/comment/dto/comment.dto'
import {
  WorkRootViewPermissionEnum,
  WorkTypeEnum,
} from '@libs/platform/constant'
import {
  ArrayProperty,
  BooleanProperty,
  DateProperty,
  EnumProperty,
  NestedProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseDto, IdDto, OMIT_BASE_FIELDS } from '@libs/platform/dto/base.dto'
import { PageDto } from '@libs/platform/dto/page.dto'

import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'

import { ContentPurchasePricingDto } from '../../../permission/dto/content-purchase-pricing.dto'
import { BaseWorkChapterDto } from '../../chapter/dto/work-chapter.dto'
import { WorkSerialStatusEnum } from '../work.constant'

export class BaseWorkDto extends BaseDto {
  @EnumProperty({
    description: '作品类型（1=漫画；2=小说）',
    example: WorkTypeEnum.COMIC,
    required: true,
    enum: WorkTypeEnum,
  })
  type!: WorkTypeEnum

  @StringProperty({
    description: '作品名称',
    example: '进击的巨人',
    required: true,
    maxLength: 80,
  })
  name!: string

  @StringProperty({
    description: '作品别名',
    example: 'Attack on Titan',
    nullable: true,
    maxLength: 200,
  })
  alias!: string | null

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
    nullable: true,
    maxLength: 10,
  })
  ageRating!: string | null

  @EnumProperty({
    description:
      '连载状态（0=未开始，1=连载中，2=已完结，3=暂停更新，4=已停更）',
    example: WorkSerialStatusEnum.SERIALIZING,
    required: true,
    enum: WorkSerialStatusEnum,
  })
  serialStatus!: WorkSerialStatusEnum

  @StringProperty({
    description: '出版社',
    example: '讲谈社',
    nullable: true,
    maxLength: 100,
  })
  publisher!: string | null

  @StringProperty({
    description: '原始来源',
    example: '官方授权',
    nullable: true,
    maxLength: 100,
  })
  originalSource!: string | null

  @StringProperty({
    description: '版权信息',
    example: '© 2024',
    nullable: true,
    maxLength: 500,
  })
  copyright!: string | null

  @StringProperty({
    description: '免责声明',
    example: '仅供学习',
    nullable: true,
  })
  disclaimer!: string | null

  @StringProperty({
    description: '备注',
    example: '管理员备注',
    nullable: true,
    maxLength: 1000,
  })
  remark!: string | null

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
    nullable: true,
  })
  publishAt!: Date | string | null

  @DateProperty({
    description: '最近更新时间',
    example: '2024-01-01T00:00:00.000Z',
    nullable: true,
  })
  lastUpdated!: Date | null

  @EnumProperty({
    description:
      '阅读规则（0=所有人可见；1=登录用户可见；2=VIP可见；3=需购买可见）',
    example: WorkRootViewPermissionEnum.ALL,
    required: true,
    enum: WorkRootViewPermissionEnum,
  })
  viewRule!: WorkRootViewPermissionEnum

  @NumberProperty({
    description: '历史阅读等级ID（目标态不参与阅读权限）',
    example: 1,
    nullable: true,
  })
  requiredViewLevelId!: number | null

  @NumberProperty({ description: '论坛板块ID', example: 1, nullable: true })
  forumSectionId!: number | null

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
    nullable: true,
    validation: false,
  })
  rating!: number | null

  @NumberProperty({
    description: '热度值',
    example: 1000,
    required: true,
    validation: false,
  })
  popularity!: number

  @DateProperty({
    description: '删除时间',
    example: '2026-03-27T00:00:00.000Z',
    required: false,
    validation: false,
    contract: false,
  })
  deletedAt?: Date | null
}

class CreateWorkRequiredFieldsDto extends OmitType(BaseWorkDto, [
  ...OMIT_BASE_FIELDS,
  'alias',
  'ageRating',
  'publisher',
  'originalSource',
  'copyright',
  'disclaimer',
  'remark',
  'publishAt',
  'lastUpdated',
  'requiredViewLevelId',
  'popularity',
  'viewCount',
  'favoriteCount',
  'likeCount',
  'commentCount',
  'downloadCount',
  'forumSectionId',
  'rating',
  'deletedAt',
] as const) {}

class CreateWorkOptionalFieldsDto extends PartialType(
  PickType(BaseWorkDto, [
    'alias',
    'ageRating',
    'publisher',
    'originalSource',
    'copyright',
    'disclaimer',
    'remark',
    'publishAt',
    'lastUpdated',
    'requiredViewLevelId',
    'rating',
  ] as const),
) {}

export class CreateWorkDto extends IntersectionType(
  CreateWorkRequiredFieldsDto,
  CreateWorkOptionalFieldsDto,
) {

  @ArrayProperty({
    description: '作者ID列表',
    itemType: 'number',
    example: [1],
    required: true,
    minLength: 1,
  })
  authorIds!: number[]

  @ArrayProperty({
    description: '分类ID列表',
    itemType: 'number',
    example: [1],
    required: true,
    minLength: 1,
  })
  categoryIds!: number[]

  @ArrayProperty({
    description: '标签ID列表',
    itemType: 'number',
    example: [1],
    required: true,
    minLength: 1,
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
  PartialType(OmitType(CreateWorkDto, ['type'] as const)),
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

export class QueryWorkCommentPageDto extends IntersectionType(
  PageDto,
  IdDto,
  PartialType(CommentSortDto),
) {}

class AuthorInfoDto extends IntersectionType(
  PickType(BaseAuthorDto, ['id', 'name'] as const),
  PickType(AuthorNullableOutputFieldsDto, ['type', 'avatar'] as const),
) {
  @BooleanProperty({
    description: '当前用户是否已关注该作者',
    example: true,
    validation: false,
  })
  isFollowed!: boolean
}

class CategoryInfoDto extends PickType(CategoryOutputDto, [
  'id',
  'name',
  'icon',
] as const) {}

class TagInfoDto extends PickType(TagOutputDto, [
  'id',
  'name',
  'icon',
] as const) {}

/**
 * 作品分页项 DTO。
 */
class PageWorkBaseFieldsDto extends PickType(BaseWorkDto, [
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
] as const) {}

export class PageWorkDto extends PageWorkBaseFieldsDto {
  @ArrayProperty({
    description: '作者列表',
    itemClass: AuthorInfoDto,
    required: true,
    validation: false,
  })
  authors!: AuthorInfoDto[]

  @ArrayProperty({
    description: '分类列表',
    itemClass: CategoryInfoDto,
    required: true,
    validation: false,
  })
  categories!: CategoryInfoDto[]

  @BooleanProperty({
    description: '是否存在三方来源绑定',
    example: true,
    required: true,
    validation: false,
  })
  hasThirdPartySourceBinding!: boolean

  @ArrayProperty({
    description: '标签列表',
    itemClass: TagInfoDto,
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
class ContinueReadingChapterNullableFieldsDto {
  @StringProperty({
    description: '章节副标题',
    example: '序章',
    nullable: true,
    maxLength: 200,
    validation: false,
  })
  subtitle!: string | null
}

export class ContinueReadingChapterDto extends IntersectionType(
  PickType(BaseWorkChapterDto, ['id', 'title', 'sortOrder'] as const),
  ContinueReadingChapterNullableFieldsDto,
) {}

/**
 * 阅读状态 DTO。
 */
export class WorkReadingStatusFieldsDto {
  @DateProperty({
    description: '最近阅读时间',
    example: '2026-03-09T10:00:00.000Z',
    nullable: true,
    validation: false,
  })
  lastReadAt!: Date | null

  @NestedProperty({
    description: '继续阅读章节',
    nullable: true,
    type: ContinueReadingChapterDto,
    validation: false,
  })
  continueChapter!: ContinueReadingChapterDto | null
}

class WorkDetailExtraBaseDto extends PickType(BaseWorkDto, [
  'alias',
  'description',
  'originalSource',
  'copyright',
  'disclaimer',
  'lastUpdated',
  'viewRule',
  'requiredViewLevelId',
  'forumSectionId',
  'canComment',
  'viewCount',
  'favoriteCount',
  'likeCount',
  'commentCount',
  'downloadCount',
  'rating',
] as const) {}

class WorkDetailExtraDto extends WorkDetailExtraBaseDto {
  @NestedProperty({
    description: '章节默认购买价格信息',
    type: ContentPurchasePricingDto,
    required: true,
    validation: false,
    nullable: true,
  })
  chapterPurchasePricing!: ContentPurchasePricingDto | null
}

class WorkDetailBodyDto extends IntersectionType(
  PageWorkDto,
  WorkDetailExtraDto,
) {}

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

class AdminWorkDetailExtraDto extends PickType(BaseWorkDto, [
  'chapterPrice',
  'recommendWeight',
  'remark',
] as const) {}

/**
 * 后台作品详情 DTO。
 */
export class AdminWorkDetailDto extends IntersectionType(
  WorkDetailDto,
  AdminWorkDetailExtraDto,
) {}
