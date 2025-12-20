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
import { BaseAuthorDto } from '../../../author/dto/author.dto'
import { BaseCategoryDto } from '../../../category/dto/category.dto'
import { BaseTagDto } from '../../../tag/dto/tag.dto'
import { ComicSerialStatusEnum } from '../comic.constant'

/**
 * 作者信息DTO
 */
class AuthorInfoDto extends PickType(BaseAuthorDto, ['id', 'name']) {}

/**
 * 漫画作者关联DTO
 */
export class ComicAuthorDto {
  @ApiProperty({
    description: '作者信息',
    example: { id: 1, name: '村上春树' },
    required: true,
    type: AuthorInfoDto,
  })
  author!: AuthorInfoDto
}

/**
 * 分类信息DTO
 */
class CategoryInfoDto extends PickType(BaseCategoryDto, ['id', 'name']) {}

/**
 * 漫画分类关联DTO
 */
export class ComicCategoryDto {
  @ApiProperty({
    description: '分类信息',
    example: { id: 1, name: '科幻' },
    required: true,
    type: CategoryInfoDto,
  })
  category!: CategoryInfoDto
}

/**
 * 标签信息DTO
 */
export class TagInfoDto extends PickType(BaseTagDto, ['id', 'name']) {}

/**
 * 漫画标签关联DTO
 */
export class ComicTagDto {
  @ApiProperty({
    description: '标签信息',
    example: { id: 1, name: '热血' },
    required: true,
    type: TagInfoDto,
  })
  tag!: TagInfoDto
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
        isPrimary: true,
        sortOrder: 0,
        category: {
          id: 1,
          name: '科幻',
        },
      },
      {
        isPrimary: false,
        sortOrder: 1,
        category: {
          id: 2,
          name: '冒险',
        },
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
        isPrimary: true,
        sortOrder: 0,
        author: {
          id: 1,
          name: '村上春树',
        },
      },
      {
        isPrimary: false,
        sortOrder: 1,
        author: {
          id: 2,
          name: '东野圭吾',
        },
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
        isPrimary: true,
        sortOrder: 0,
        tag: {
          id: 1,
          name: '热血',
        },
      },
      {
        isPrimary: false,
        sortOrder: 1,
        tag: {
          id: 2,
          name: '战斗',
        },
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

  @ValidateNumber({
    description: '评分（1-10分，保留1位小数）',
    example: 8.5,
    required: false,
    min: 0,
    max: 10,
  })
  rating?: number

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
    required: true,
  })
  tagIds!: number[]
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
