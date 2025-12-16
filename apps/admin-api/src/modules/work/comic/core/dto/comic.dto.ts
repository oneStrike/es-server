import {
  ValidateArray,
  ValidateBoolean,
  ValidateDate,
  ValidateEnum,
  ValidateNumber,
  ValidateString,
} from '@libs/base/decorators'
import { BaseDto, IdDto, OMIT_BASE_FIELDS, PageDto } from '@libs/base/dto'
import {
  ApiProperty,
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
import {
  ComicDownloadPermissionEnum,
  ComicReadRuleEnum,
  ComicSerialStatusEnum,
} from '../comic.constant'

/**
 * 漫画作者DTO
 */
export class ComicAuthorDto {
  @ApiProperty({
    description: '作者ID',
    example: 1,
    required: true,
    type: Number,
  })
  id!: IdDto

  @ApiProperty({
    description: '作者名称',
    example: '村上春树',
    required: true,
    type: String,
  })
  name!: string

  @ApiProperty({
    description: '是否为主要作者',
    example: true,
    required: true,
    type: Boolean,
  })
  isPrimary!: boolean

  @ApiProperty({
    description: '排序',
    example: 1,
    required: true,
    type: Number,
  })
  sortOrder!: boolean
}

/**
 * 漫画分类DTO
 */
export class ComicCategoryDto {
  @ApiProperty({
    description: '分类ID',
    example: 1,
    required: true,
    type: Number,
  })
  id!: IdDto

  @ApiProperty({
    description: '分类名称',
    example: '科幻',
    required: true,
    type: String,
  })
  name!: string
}

/**
 * 漫画标签DTO
 */
export class ComicTagDto {
  @ApiProperty({
    description: '标签ID',
    example: 1,
    required: true,
    type: Number,
  })
  id!: IdDto

  @ApiProperty({
    description: '标签名称',
    example: '热血',
    required: true,
    type: String,
  })
  name!: string
}

/**
 * 漫画基础DTO
 */
export class BaseComicDto extends BaseDto {
  @ValidateString({
    description: '漫画名称',
    example: '进击的巨人',
    required: true,
    maxLength: 100,
  })
  name!: string

  @ValidateString({
    description: '漫画别名（支持多别名，用逗号分隔）',
    example: 'Attack on Titan,進撃の巨人',
    required: false,
    maxLength: 200,
  })
  alias?: string

  @ValidateString({
    description: '漫画封面URL',
    example: 'https://example.com/cover.jpg',
    required: true,
    maxLength: 500,
  })
  cover!: string

  @ApiProperty({
    description: '漫画分类',
    example: [
      {
        id: 1,
        name: '科幻',
      },
      {
        id: 2,
        name: '冒险',
      },
    ],
    required: true,
    type: [ComicCategoryDto], // 明确指定类型为 ComicCategoryDto 数组
  })
  comicCategories!: ComicCategoryDto[]

  @ApiProperty({
    description: '漫画作者',
    example: [
      {
        id: 1,
        name: '村上春树',
        isPrimary: true,
        sortOrder: 1,
      },
      {
        id: 2,
        name: '东野圭吾',
        isPrimary: false,
        sortOrder: 2,
      },
    ],
    required: true,
    type: [ComicAuthorDto], // 明确指定类型为 ComicAuthorDto 数组
  })
  comicAuthors!: ComicAuthorDto[]

  @ApiProperty({
    description: '漫画标签',
    example: [
      {
        id: 1,
        name: '热血',
      },
      {
        id: 2,
        name: '战斗',
      },
    ],
    required: true,
    type: [ComicTagDto], // 明确指定类型为 ComicTagDto 数组
  })
  comicTags!: ComicTagDto[]

  @ValidateNumber({
    description: '热度值（用于排序）',
    example: 1000,
    required: true,
    min: 0,
    default: 0,
  })
  popularity!: number

  @ValidateNumber({
    description: '虚拟热度热度权重（影响热度计算）',
    example: 1.0,
    required: false,
    min: 0,
    default: 1.0,
  })
  popularityWeight?: number

  @ValidateString({
    description: '语言代码',
    example: 'en',
    required: true,
  })
  language!: string

  @ValidateString({
    description: '地区代码',
    example: 'CN',
    required: true,
  })
  region!: string

  @ValidateString({
    description: '年龄分级',
    example: 'R14',
    required: true,
  })
  ageRating!: string

  @ValidateBoolean({
    description: '发布状态',
    example: true,
    required: true,
    default: true,
  })
  isPublished!: boolean

  @ValidateDate({
    description: '发布日期',
    example: '2024-01-01',
    required: false,
  })
  publishAt?: Date

  @ApiProperty({
    description: '最后更新时间',
    example: '2025-10-10',
    required: false,
    type: Date,
  })
  lastUpdated: Date

  @ValidateString({
    description: '漫画简介',
    example: '这是一部关于巨人的漫画...',
    required: true,
  })
  description: string

  @ValidateString({
    description: '出版社',
    example: '讲谈社',
    required: false,
    maxLength: 100,
  })
  publisher?: string

  @ValidateString({
    description: '原始来源',
    example: '官方授权',
    required: false,
    maxLength: 100,
  })
  originalSource?: string

  @ValidateEnum({
    description: '连载状态',
    example: ComicSerialStatusEnum.SERIALIZING,
    required: true,
    enum: ComicSerialStatusEnum,
    default: ComicSerialStatusEnum.SERIALIZING,
  })
  serialStatus!: ComicSerialStatusEnum

  @ValidateEnum({
    description: '是否允许下载',
    enum: ComicDownloadPermissionEnum,
    example: ComicDownloadPermissionEnum.ALLOWED,
    required: true,
    default: ComicDownloadPermissionEnum.ALLOWED,
  })
  canDownload!: number

  @ValidateBoolean({
    description: '是否允许评论',
    example: true,
    required: true,
    default: true,
  })
  canComment!: boolean

  @ValidateEnum({
    description: '阅读规则',
    example: ComicReadRuleEnum.FREE,
    required: true,
    enum: ComicReadRuleEnum,
    default: ComicReadRuleEnum.FREE,
  })
  readRule!: ComicReadRuleEnum

  @ValidateNumber({
    description: '所需积分',
    example: 1000,
    required: false,
    min: 0,
  })
  readPoints?: number

  @ValidateNumber({
    description: '总章节数',
    example: 100,
    required: true,
    min: 0,
    default: 0,
  })
  totalChapters!: number

  @ValidateNumber({
    description: '总阅读次数',
    example: 10000,
    required: true,
    min: 0,
    default: 0,
  })
  totalViews!: number

  @ValidateNumber({
    description: '收藏数',
    example: 500,
    required: true,
    min: 0,
    default: 0,
  })
  favoriteCount!: number

  @ValidateNumber({
    description: '评论总数',
    example: 200,
    required: true,
    min: 0,
    default: 0,
  })
  commentCount!: number

  @ValidateNumber({
    description: '点赞总数',
    example: 1000,
    required: true,
    min: 0,
    default: 0,
  })
  likeCount!: number

  @ValidateNumber({
    description: '评分（1-10分，保留1位小数）',
    example: 8.5,
    required: false,
    min: 0,
    max: 10,
  })
  rating?: number

  @ValidateNumber({
    description: '评分人数',
    example: 100,
    required: true,
    min: 0,
    default: 0,
  })
  ratingCount!: number

  @ValidateString({
    description: 'SEO标题',
    example: '进击的巨人 - 热门漫画在线阅读',
    required: false,
    maxLength: 100,
  })
  seoTitle?: string

  @ValidateString({
    description: 'SEO描述',
    example: '进击的巨人是一部精彩的漫画作品...',
    required: false,
    maxLength: 200,
  })
  seoDescription?: string

  @ValidateString({
    description: 'SEO关键词',
    example: '进击的巨人,漫画,在线阅读',
    required: false,
    maxLength: 200,
  })
  seoKeywords?: string

  @ValidateNumber({
    description: '推荐权重（影响推荐排序）',
    example: 1.0,
    required: false,
    min: 0,
    default: 1.0,
  })
  recommendWeight?: number

  @ValidateBoolean({
    description: '是否推荐',
    example: false,
    required: true,
    default: false,
  })
  isRecommended!: boolean

  @ValidateBoolean({
    description: '是否热门',
    example: false,
    required: true,
    default: false,
  })
  isHot!: boolean

  @ValidateBoolean({
    description: '是否新作',
    example: true,
    required: true,
    default: false,
  })
  isNew!: boolean

  @ValidateString({
    description: '版权信息',
    example: '© 2024 作者名',
    required: false,
    maxLength: 200,
  })
  copyright?: string

  @ValidateString({
    description: '免责声明',
    example: '本作品仅供娱乐，不代表任何立场',
    required: false,
  })
  disclaimer?: string

  @ValidateString({
    description: '管理员备注',
    example: '优质漫画，推荐首页展示',
    required: false,
  })
  remark?: string

  @ValidateDate({
    description: '软删除时间',
    example: null,
    required: false,
  })
  deletedAt?: Date | null
}

/**
 * 创建漫画DTO
 */
export class CreateComicDto extends OmitType(BaseComicDto, [
  ...OMIT_BASE_FIELDS,
  'popularity',
  'isPublished',
  'deletedAt',
  'totalChapters',
  'totalViews',
  'favoriteCount',
  'commentCount',
  'likeCount',
  'ratingCount',
  'isRecommended',
  'isHot',
  'isNew',
  'comicCategories',
  'comicAuthors',
  'comicTags',
]) {
  @ValidateArray({
    description: '关联的作者ID列表',
    itemType: 'number',
    example: [1, 2],
    required: true,
  })
  authorIds!: number[]

  @ValidateArray({
    description: '关联的分类ID列表',
    itemType: 'number',
    example: [1, 2, 3],
    required: true,
  })
  categoryIds!: number[]

  @ValidateArray({
    description: '关联的标签ID列表',
    itemType: 'number',
    example: [1, 2],
    required: false,
  })
  tagIds?: number[]
}

/**
 * 更新漫画DTO
 */
export class UpdateComicDto extends IntersectionType(
  PartialType(CreateComicDto),
  IdDto,
) {}

/**
 * 查询漫画DTO
 */
export class QueryComicDto extends IntersectionType(
  PageDto,
  IntersectionType(
    PickType(PartialType(BaseComicDto), [
      'name',
      'publisher',
      'isPublished',
      'serialStatus',
      'language',
      'region',
      'ageRating',
      'readRule',
      'isRecommended',
      'isHot',
      'isNew',
    ]),
    PartialType(PickType(CreateComicDto, ['tagIds', 'categoryIds'])),
  ),
) {
  @ValidateString({
    description: '作者名称',
    example: '村',
    required: false,
  })
  author?: string
}

/**
 * 更新漫画推荐状态DTO
 */
export class UpdateComicRecommendedDto extends IntersectionType(
  IdDto,
  PickType(BaseComicDto, ['isRecommended']),
) {}

/**
 * 更新漫画发布状态DTO
 */
export class UpdateComicStatusDto extends IntersectionType(
  IdDto,
  PickType(BaseComicDto, ['isPublished']),
) {}

/**
 * 更新漫画热门状态DTO
 */
export class UpdateComicHotDto extends IntersectionType(
  IdDto,
  PickType(BaseComicDto, ['isHot']),
) {}

/**
 * 更新漫画新作状态DTO
 */
export class UpdateComicNewDto extends IntersectionType(
  IdDto,
  PickType(BaseComicDto, ['isNew']),
) {}
