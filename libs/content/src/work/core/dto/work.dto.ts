import { WorkTypeEnum, WorkViewPermissionEnum } from '@libs/base/constant'
import {
  ArrayProperty,
  BooleanProperty,
  DateProperty,
  EnumProperty,
  NestedProperty,
  NumberProperty,
  StringProperty,
} from '@libs/base/decorators'
import { BaseDto, IdDto, OMIT_BASE_FIELDS, PageDto } from '@libs/base/dto'
import { BaseAuthorDto } from '@libs/content/author'
import { BaseCategoryDto } from '@libs/content/category'
import { BaseTagDto } from '@libs/content/tag'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
import { WorkSerialStatusEnum } from '../work.constant'

/// 作者信息DTO
class AuthorInfoDto extends PickType(BaseAuthorDto, [
  'id',
  'name',
  'type',
  'avatar',
]) {}

/// 作品作者关联DTO
export class WorkAuthorRelationDto {
  @NestedProperty({
    description: '作者信息',
    example: {
      id: 1,
      name: '村上春树',
      avatar: 'https://example.com/avatar.jpg',
    },
    required: true,
    type: AuthorInfoDto,
    validation: false,
  })
  author!: AuthorInfoDto

  @NumberProperty({
    description: '排序顺序',
    example: 0,
    required: false,
    validation: false,
  })
  sortOrder?: number
}

/// 分类信息DTO
class CategoryInfoDto extends PickType(BaseCategoryDto, [
  'id',
  'name',
  'icon',
]) {}

/// 作品分类关联DTO
export class WorkCategoryRelationDto {
  @NestedProperty({
    description: '分类信息',
    example: { id: 1, name: '科幻', icon: 'https://example.com/icon.jpg' },
    required: true,
    type: CategoryInfoDto,
    validation: false,
  })
  category!: CategoryInfoDto

  @NumberProperty({
    description: '排序顺序',
    example: 0,
    required: false,
    validation: false,
  })
  sortOrder?: number
}

/// 标签信息DTO
class TagInfoDto extends PickType(BaseTagDto, ['id', 'name', 'icon']) {}

/// 作品标签关联DTO
export class WorkTagRelationDto {
  @NestedProperty({
    description: '标签信息',
    example: { id: 1, name: '热血', icon: 'https://example.com/icon.jpg' },
    required: true,
    type: TagInfoDto,
    validation: false,
  })
  tag!: TagInfoDto

  @NumberProperty({
    description: '排序顺序',
    example: 0,
    required: false,
    validation: false,
  })
  sortOrder?: number
}

// 作品基础DTO
export class BaseWorkDto extends BaseDto {
  @EnumProperty({
    description: '作品类型（1=漫画, 2=小说）',
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
    description: '作品别名（支持多别名，用逗号分隔）',
    example: 'Attack on Titan,進撃の巨人',
    required: false,
    maxLength: 200,
  })
  alias?: string

  @StringProperty({
    description: '作品封面URL',
    example: 'https://example.com/cover.jpg',
    required: true,
    maxLength: 500,
  })
  cover!: string

  @StringProperty({
    description: '作品简介',
    example: '这是一部关于巨人的作品...',
    required: true,
  })
  description!: string

  @StringProperty({
    description: '语言代码',
    example: 'en',
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
    default: WorkSerialStatusEnum.SERIALIZING,
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
    example: '© 2024 作者名',
    required: false,
    maxLength: 500,
  })
  copyright?: string

  @StringProperty({
    description: '免责声明',
    example: '本作品仅供娱乐，不代表任何立场',
    required: false,
  })
  disclaimer?: string

  @BooleanProperty({
    description: '发布状态',
    example: true,
    required: true,
    default: true,
  })
  isPublished!: boolean

  @DateProperty({
    description: '发布日期',
    example: '2024-01-01',
    required: false,
  })
  publishAt?: Date

  @DateProperty({
    description: '最后更新时间',
    example: '2025-10-10',
    required: false,
    validation: false,
  })
  lastUpdated?: Date

  @EnumProperty({
    description: '查看规则（0=所有人, 1=登录用户, 2=会员, 3=积分购买）',
    example: WorkViewPermissionEnum.ALL,
    required: true,
    enum: WorkViewPermissionEnum,
    default: WorkViewPermissionEnum.ALL,
  })
  viewRule!: WorkViewPermissionEnum

  @NumberProperty({
    description: '阅读所需会员等级ID',
    example: 1,
    required: false,
  })
  requiredViewLevelId?: number

  @NumberProperty({
    description: '作品购买价格（余额）',
    example: 0,
    required: true,
    default: 0,
  })
  price!: number

  @NumberProperty({
    description: '章节默认购买价格（余额）',
    example: 0,
    required: true,
    default: 0,
  })
  chapterPrice!: number

  @NumberProperty({
    description: '章节默认兑换积分',
    example: 0,
    required: true,
    default: 0,
  })
  chapterExchangePoints!: number

  @BooleanProperty({
    description: '是否允许评论',
    example: true,
    required: true,
    default: true,
  })
  canComment!: boolean

  @NumberProperty({
    description: '购买数',
    example: 0,
    required: true,
    min: 0,
    default: 0,
    validation: false,
  })
  purchaseCount!: number

  @NumberProperty({
    description: '兑换所需积分',
    example: 0,
    required: true,
    default: 0,
  })
  exchangePoints!: number

  @BooleanProperty({
    description: '是否允许兑换',
    example: false,
    required: true,
    default: false,
  })
  canExchange!: boolean

  @BooleanProperty({
    description: '是否允许下载',
    example: false,
    required: true,
    default: false,
  })
  canDownload!: boolean

  @NumberProperty({
    description: '浏览量',
    example: 1000,
    required: true,
    min: 0,
    default: 0,
    validation: false,
  })
  viewCount!: number

  @NumberProperty({
    description: '下载量',
    example: 1000,
    required: true,
    min: 0,
    default: 0,
    validation: false,
  })
  downloadCount!: number

  @NumberProperty({
    description: '收藏数',
    example: 50,
    required: true,
    min: 0,
    default: 0,
    validation: false,
  })
  favoriteCount!: number

  @NumberProperty({
    description: '点赞数',
    example: 1000,
    required: true,
    min: 0,
    default: 0,
    validation: false,
  })
  likeCount!: number

  @NumberProperty({
    description: '评分（1-10分，保留1位小数）',
    example: 8.5,
    required: false,
    min: 0,
    max: 10,
    validation: false,
  })
  rating?: number

  @NumberProperty({
    description: '评分人数',
    example: 1000,
    required: true,
    min: 0,
    default: 0,
    validation: false,
  })
  ratingCount!: number

  @NumberProperty({
    description: '热度值',
    example: 1000,
    required: true,
    min: 0,
    default: 0,
  })
  popularity!: number

  @BooleanProperty({
    description: '是否推荐',
    example: false,
    required: true,
    default: false,
  })
  isRecommended!: boolean

  @BooleanProperty({
    description: '是否热门',
    example: false,
    required: true,
    default: false,
  })
  isHot!: boolean

  @BooleanProperty({
    description: '是否新作',
    example: true,
    required: true,
    default: false,
  })
  isNew!: boolean

  @NumberProperty({
    description: '推荐权重',
    example: 1.0,
    required: false,
    min: 0,
    default: 1.0,
  })
  recommendWeight?: number

  @ArrayProperty({
    description: '作品作者',
    example: [
      {
        author: {
          id: 1,
          name: '村上春树',
          avatar: 'https://example.com/avatar.jpg',
        },
        sortOrder: 0,
        role: '作者',
      },
    ],
    required: true,
    itemClass: WorkAuthorRelationDto,
    itemType: 'object',
    validation: false,
  })
  authors!: WorkAuthorRelationDto[]

  @ArrayProperty({
    description: '作品分类',
    example: [
      {
        category: { id: 1, name: '科幻', icon: 'https://example.com/icon.jpg' },
        sortOrder: 0,
      },
    ],
    required: true,
    itemClass: WorkCategoryRelationDto,
    itemType: 'object',
    validation: false,
  })
  categories!: WorkCategoryRelationDto[]

  @ArrayProperty({
    description: '作品标签',
    example: [
      {
        tag: { id: 1, name: '热血', icon: 'https://example.com/icon.jpg' },
        sortOrder: 0,
      },
    ],
    required: true,
    itemClass: WorkTagRelationDto,
    itemType: 'object',
    validation: false,
  })
  tags!: WorkTagRelationDto[]
}

// 分页返回作品DTO
export class PageWorkDto extends PickType(BaseWorkDto, [
  'id',
  'name',
  'type',
  'cover',
  'popularity',
  'isRecommended',
  'isHot',
  'isNew',
  'categories',
  'tags',
]) {}

/// 创建作品DTO
export class CreateWorkDto extends OmitType(BaseWorkDto, [
  ...OMIT_BASE_FIELDS,
  'popularity',
  'isPublished',
  'authors',
  'categories',
  'tags',
  'viewCount',
  'downloadCount',
  'likeCount',
  'favoriteCount',
  'ratingCount',
]) {
  @ArrayProperty({
    description: '关联的作者ID列表',
    itemType: 'number',
    example: [1, 2],
    required: true,
  })
  authorIds!: number[]

  @ArrayProperty({
    description: '关联的分类ID列表',
    itemType: 'number',
    example: [1, 2, 3],
    required: true,
  })
  categoryIds!: number[]

  @ArrayProperty({
    description: '关联的标签ID列表',
    itemType: 'number',
    example: [1, 2],
    required: true,
  })
  tagIds!: number[]
}

/// 更新作品DTO
export class UpdateWorkDto extends IntersectionType(CreateWorkDto, IdDto) {}

// 查询作品DTO
export class QueryWorkDto extends IntersectionType(
  PageDto,
  IntersectionType(
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
      ]),
    ),
    PartialType(PickType(CreateWorkDto, ['tagIds', 'categoryIds'])),
  ),
) {
  @StringProperty({
    description: '作者名称',
    example: '村',
    required: false,
  })
  author?: string

  @EnumProperty({
    description: '作品类型（1=漫画, 2=小说）',
    example: WorkTypeEnum.COMIC,
    required: true,
    enum: WorkTypeEnum,
  })
  type!: WorkTypeEnum
}

// 根据类型查询作品
export class QueryWorkTypeDto extends IntersectionType(
  PageDto,
  PickType(QueryWorkDto, ['type']),
) {}

/// 作品用户状态字段DTO
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
}

/// 作品分页带用户状态DTO
export class WorkPageWithUserStatusDto extends IntersectionType(
  BaseWorkDto,
  WorkUserStatusFieldsDto,
) {}

/// 作品详情带用户状态DTO
export class WorkDetailWithUserStatusDto extends WorkPageWithUserStatusDto {}

/// 作品用户状态DTO
export class WorkUserStatusDto extends IntersectionType(
  IdDto,
  WorkUserStatusFieldsDto,
) {}

/// 更新作品推荐状态DTO
export class UpdateWorkRecommendedDto extends IntersectionType(
  IdDto,
  PickType(BaseWorkDto, ['isRecommended']),
) {}

/// 更新作品发布状态DTO
export class UpdateWorkStatusDto extends IntersectionType(
  IdDto,
  PickType(BaseWorkDto, ['isPublished']),
) {}

/// 更新作品热门状态DTO
export class UpdateWorkHotDto extends IntersectionType(
  IdDto,
  PickType(BaseWorkDto, ['isHot']),
) {}

/// 更新作品新作状态DTO
export class UpdateWorkNewDto extends IntersectionType(
  IdDto,
  PickType(BaseWorkDto, ['isNew']),
) {}
