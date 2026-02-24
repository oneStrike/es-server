import { WorkTypeEnum } from '@libs/base/constant'
import {
  ValidateArray,
  ValidateBoolean,
  ValidateDate,
  ValidateEnum,
  ValidateNumber,
  ValidateString,
} from '@libs/base/decorators'
import { BaseDto, IdDto, OMIT_BASE_FIELDS, PageDto } from '@libs/base/dto'
import { BaseAuthorDto } from '@libs/content/author'
import { BaseCategoryDto } from '@libs/content/category'
import { BaseTagDto } from '@libs/content/tag'
import {
  ApiProperty,
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
import { WorkSerialStatusEnum } from '../work.constant'

/// 作者信息DTO
class AuthorInfoDto extends PickType(BaseAuthorDto, ['id', 'name', 'avatar']) {}

/// 作品作者关联DTO
export class WorkAuthorRelationDto {
  @ApiProperty({
    description: '作者信息',
    example: {
      id: 1,
      name: '村上春树',
      avatar: 'https://example.com/avatar.jpg',
    },
    required: true,
    type: AuthorInfoDto,
  })
  author!: AuthorInfoDto

  @ApiProperty({
    description: '排序顺序',
    example: 0,
    required: false,
  })
  sortOrder?: number

  @ApiProperty({
    description: '角色类型',
    example: '作者',
    required: false,
  })
  role?: string
}

/// 分类信息DTO
class CategoryInfoDto extends PickType(BaseCategoryDto, ['id', 'name', 'icon']) {}

/// 作品分类关联DTO
export class WorkCategoryRelationDto {
  @ApiProperty({
    description: '分类信息',
    example: { id: 1, name: '科幻', icon: 'https://example.com/icon.jpg' },
    required: true,
    type: CategoryInfoDto,
  })
  category!: CategoryInfoDto

  @ApiProperty({
    description: '排序顺序',
    example: 0,
    required: false,
  })
  sortOrder?: number
}

/// 标签信息DTO
class TagInfoDto extends PickType(BaseTagDto, ['id', 'name', 'icon']) {}

/// 作品标签关联DTO
export class WorkTagRelationDto {
  @ApiProperty({
    description: '标签信息',
    example: { id: 1, name: '热血', icon: 'https://example.com/icon.jpg' },
    required: true,
    type: TagInfoDto,
  })
  tag!: TagInfoDto

  @ApiProperty({
    description: '排序顺序',
    example: 0,
    required: false,
  })
  sortOrder?: number
}

/// 作品基础DTO
export class BaseWorkDto extends BaseDto {
  @ValidateEnum({
    description: '作品类型（1=漫画, 2=小说）',
    example: WorkTypeEnum.COMIC,
    required: true,
    enum: WorkTypeEnum,
  })
  type!: WorkTypeEnum

  @ValidateString({
    description: '作品名称',
    example: '进击的巨人',
    required: true,
    maxLength: 100,
  })
  name!: string

  @ValidateString({
    description: '作品别名（支持多别名，用逗号分隔）',
    example: 'Attack on Titan,進撃の巨人',
    required: false,
    maxLength: 200,
  })
  alias?: string

  @ValidateString({
    description: '作品封面URL',
    example: 'https://example.com/cover.jpg',
    required: true,
    maxLength: 500,
  })
  cover!: string

  @ValidateString({
    description: '作品简介',
    example: '这是一部关于巨人的作品...',
    required: true,
  })
  description!: string

  @ValidateString({
    description: '语言代码',
    example: 'en',
    required: true,
    maxLength: 10,
  })
  language!: string

  @ValidateString({
    description: '地区代码',
    example: 'CN',
    required: true,
    maxLength: 10,
  })
  region!: string

  @ValidateString({
    description: '年龄分级',
    example: 'R14',
    required: false,
    maxLength: 10,
  })
  ageRating?: string

  @ValidateEnum({
    description: '连载状态',
    example: WorkSerialStatusEnum.SERIALIZING,
    required: true,
    enum: WorkSerialStatusEnum,
    default: WorkSerialStatusEnum.SERIALIZING,
  })
  serialStatus!: WorkSerialStatusEnum

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

  @ValidateString({
    description: '版权信息',
    example: '© 2024 作者名',
    required: false,
    maxLength: 500,
  })
  copyright?: string

  @ValidateString({
    description: '免责声明',
    example: '本作品仅供娱乐，不代表任何立场',
    required: false,
  })
  disclaimer?: string

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
  lastUpdated?: Date

  @ValidateNumber({
    description: '浏览量',
    example: 1000,
    required: true,
    min: 0,
    default: 0,
  })
  viewCount!: number

  @ValidateNumber({
    description: '收藏数',
    example: 50,
    required: true,
    min: 0,
    default: 0,
  })
  favoriteCount!: number

  @ValidateNumber({
    description: '点赞数',
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
    example: 1000,
    required: true,
    min: 0,
    default: 0,
  })
  ratingCount!: number

  @ValidateNumber({
    description: '热度值',
    example: 1000,
    required: true,
    min: 0,
    default: 0,
  })
  popularity!: number

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

  @ValidateNumber({
    description: '推荐权重',
    example: 1.0,
    required: false,
    min: 0,
    default: 1.0,
  })
  recommendWeight?: number

  @ApiProperty({
    description: '作品作者',
    example: [
      {
        author: { id: 1, name: '村上春树', avatar: 'https://example.com/avatar.jpg' },
        sortOrder: 0,
        role: '作者',
      },
    ],
    required: true,
    type: [WorkAuthorRelationDto],
  })
  authors!: WorkAuthorRelationDto[]

  @ApiProperty({
    description: '作品分类',
    example: [
      {
        category: { id: 1, name: '科幻', icon: 'https://example.com/icon.jpg' },
        sortOrder: 0,
      },
    ],
    required: true,
    type: [WorkCategoryRelationDto],
  })
  categories!: WorkCategoryRelationDto[]

  @ApiProperty({
    description: '作品标签',
    example: [
      {
        tag: { id: 1, name: '热血', icon: 'https://example.com/icon.jpg' },
        sortOrder: 0,
      },
    ],
    required: true,
    type: [WorkTagRelationDto],
  })
  tags!: WorkTagRelationDto[]
}

/// 创建作品DTO
export class CreateWorkDto extends OmitType(BaseWorkDto, [
  ...OMIT_BASE_FIELDS,
  'popularity',
  'isPublished',
  'authors',
  'categories',
  'tags',
  'viewCount',
  'likeCount',
  'favoriteCount',
  'ratingCount',
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

/// 更新作品DTO
export class UpdateWorkDto extends IntersectionType(
  PartialType(CreateWorkDto),
  IdDto,
) {}

/// 查询作品DTO
export class QueryWorkDto extends IntersectionType(
  PageDto,
  IntersectionType(
    PickType(PartialType(BaseWorkDto), [
      'name',
      'type',
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
    PartialType(PickType(CreateWorkDto, ['tagIds', 'categoryIds'])),
  ),
) {
  @ValidateString({
    description: '作者名称',
    example: '村',
    required: false,
  })
  author?: string
}

/// 作品用户状态字段DTO
export class WorkUserStatusFieldsDto {
  @ApiProperty({
    description: '是否已点赞',
    example: true,
    required: true,
  })
  liked!: boolean

  @ApiProperty({
    description: '是否已收藏',
    example: false,
    required: true,
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
