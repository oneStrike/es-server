import {
  ValidateArray,
  ValidateBoolean,
  ValidateDate,
  ValidateEnum,
  ValidateNumber,
  ValidateString,
} from '@libs/base/decorators'
import {
  BaseDto,
  IdDto,
  IdsDto,
  OMIT_BASE_FIELDS,
  PageDto,
} from '@libs/base/dto'
import { WorkViewPermissionEnum } from '@libs/base/enum'
import {
  ApiProperty,
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'

/**
 * 漫画章节基础DTO
 */
export class BaseComicChapterDto extends BaseDto {
  @ValidateString({
    description: '章节标题',
    example: '第一话：开始的故事',
    required: true,
    maxLength: 100,
  })
  title!: string

  @ValidateString({
    description: '章节副标题或描述',
    example: '主角的冒险开始了',
    required: false,
    maxLength: 200,
  })
  subtitle?: string

  @ValidateBoolean({
    description: '发布状态（true: 已发布, false: 未发布）',
    example: true,
    required: true,
    default: false,
  })
  isPublished!: boolean

  @ValidateNumber({
    description: '关联的漫画ID',
    example: 1,
    required: true,
    min: 1,
  })
  comicId!: number

  @ValidateNumber({
    description: '章节序号（用于排序）',
    example: 1.0,
    required: true,
    min: 0,
  })
  sortOrder!: number

  @ValidateEnum({
    description: '查看规则（0: 公开, 1: 登录, 2: 会员, 3: 购买）',
    example: WorkViewPermissionEnum.ALL,
    required: true,
    enum: WorkViewPermissionEnum,
    default: WorkViewPermissionEnum.ALL,
  })
  readRule!: WorkViewPermissionEnum

  @ValidateNumber({
    description: '购买需要消耗的积分',
    example: 100,
    required: false,
    min: 0,
    default: 0,
  })
  readPoints?: number

  @ValidateEnum({
    description: '下载规则（0: 禁止, 1: 允许, 2: VIP可下载, 3: 积分可下载）',
    example: WorkViewPermissionEnum.ALL,
    required: true,
    enum: WorkViewPermissionEnum,
    default: WorkViewPermissionEnum.ALL,
  })
  downloadRule!: WorkViewPermissionEnum

  @ValidateNumber({
    description: '下载所需要的积分',
    example: 50,
    required: false,
    min: 0,
    default: 0,
  })
  downloadPoints?: number

  @ValidateBoolean({
    description: '是否允许评论',
    example: true,
    required: true,
    default: true,
  })
  canComment!: boolean

  @ValidateNumber({
    description: '允许查看的会员等级ID',
    example: 1,
    required: false,
    min: 1,
  })
  requiredReadLevelId?: number

  @ValidateNumber({
    description: '允许下载的会员等级ID',
    example: 2,
    required: false,
    min: 1,
  })
  requiredDownloadLevelId?: number

  @ValidateString({
    description: '漫画内容（JSON格式存储图片URL数组）',
    example:
      '["https://example.com/page1.jpg", "https://example.com/page2.jpg"]',
    required: true,
    default: '[]',
  })
  contents!: string

  @ValidateBoolean({
    description: '是否为试读章节',
    example: false,
    required: true,
    default: false,
  })
  isPreview!: boolean

  @ValidateDate({
    description: '发布时间',
    example: '2024-01-01T00:00:00.000Z',
    required: false,
  })
  publishAt?: Date

  @ValidateString({
    description: '章节缩略图',
    example: 'https://example.com/thumbnail.jpg',
    required: false,
    maxLength: 255,
  })
  thumbnail?: string

  @ValidateNumber({
    description: '阅读次数',
    example: 1000,
    required: true,
    min: 0,
    default: 0,
  })
  viewCount!: number

  @ValidateNumber({
    description: '点赞数',
    example: 100,
    required: true,
    min: 0,
    default: 0,
  })
  likeCount!: number

  @ValidateNumber({
    description: '评论数',
    example: 50,
    required: true,
    min: 0,
    default: 0,
  })
  commentCount!: number

  @ValidateString({
    description: '管理员备注',
    example: '优质章节，内容丰富',
    required: false,
    maxLength: 1000,
  })
  remark?: string
}

/**
 * 关联的漫画信息
 */
export class RelatedComicDto {
  @ApiProperty({ description: '漫画ID', example: 1 })
  id: number

  @ApiProperty({ description: '漫画名字', example: '示例漫画' })
  name: string
}

/**
 * 关联的会员等级信息
 */
export class RelatedMemberLevelDto {
  @ApiProperty({ description: '会员等级ID', example: 1 })
  id: number

  @ApiProperty({ description: '会员等级名称', example: '白金会员' })
  name: string

  @ApiProperty({ description: '会员等级颜色', example: '#FFD700' })
  color: string
}

/**
 * 漫画详情接口响应dto
 */

export class ComicChapterDetailDto extends BaseComicChapterDto {
  @ApiProperty({
    description: '关联的漫画信息',
    type: RelatedComicDto,
  })
  relatedComic: RelatedComicDto

  @ApiProperty({
    description: '允许查看的会员等级信息',
    type: RelatedMemberLevelDto,
    required: false,
  })
  requiredReadLevel?: RelatedMemberLevelDto

  @ApiProperty({
    description: '允许下载的会员等级信息',
    type: RelatedMemberLevelDto,
    required: false,
  })
  requiredDownloadLevel?: RelatedMemberLevelDto
}

/**
 * 创建漫画章节DTO
 */
export class CreateComicChapterDto extends OmitType(BaseComicChapterDto, [
  ...OMIT_BASE_FIELDS,
  'viewCount',
  'likeCount',
  'commentCount',
  'isPublished',
  'contents',
]) {}

/**
 * 添加章节内容DTO
 */
export class AddChapterContentDto extends IdDto {
  @ValidateString({
    description: '要添加的内容（图片URL）',
    example: 'https://example.com/new-page.jpg',
    required: true,
  })
  content!: string

  @ValidateNumber({
    description: '插入位置索引（可选，默认添加到末尾）',
    example: 2,
    required: false,
    min: 0,
  })
  index?: number
}

/**
 * 更新章节内容DTO
 */
export class UpdateChapterContentDto extends OmitType(AddChapterContentDto, [
  'index',
]) {
  @ValidateNumber({
    description: '插入位置索引（可选，默认添加到末尾）',
    example: 2,
    required: true,
    min: 0,
  })
  index!: number
}

/**
 * 删除章节内容DTO
 */
export class DeleteChapterContentDto extends OmitType(UpdateChapterContentDto, [
  'content',
]) {}

/**
 * 移动章节内容DTO（用于排序）
 */
export class MoveChapterContentDto extends IdDto {
  @ValidateNumber({
    description: '源索引位置',
    example: 2,
    required: true,
    min: 0,
  })
  fromIndex!: number

  @ValidateNumber({
    description: '目标索引位置',
    example: 0,
    required: true,
    min: 0,
  })
  toIndex!: number
}

/**
 * 批量更新章节内容DTO
 */
export class BatchUpdateChapterContentsDto extends IdDto {
  @ValidateArray({
    description: '新的内容数组（JSON格式）',
    example: ['https://example.com/page1.jpg'],
    required: true,
    itemType: 'string',
  })
  contents!: string
}

/**
 * 更新漫画章节DTO
 */
export class UpdateComicChapterDto extends IntersectionType(
  PartialType(CreateComicChapterDto),
  IdDto,
) {}

/**
 * 查询漫画章节DTO
 */
export class QueryComicChapterDto extends IntersectionType(
  PageDto,
  PickType(PartialType(BaseComicChapterDto), [
    'title',
    'isPublished',
    'readRule',
    'downloadRule',
    'canComment',
    'isPreview',
    'comicId',
  ]),
) {}

/**
 * 批量更新章节发布状态DTO
 */
export class UpdateChapterPublishStatusDto extends IdsDto {
  @ValidateBoolean({
    description: '发布状态（true: 发布, false: 取消发布）',
    example: true,
    required: true,
  })
  isPublished!: boolean
}

/**
 * 漫画章节分页响应DTO
 */
export class ComicChapterPageResponseDto extends OmitType(BaseComicChapterDto, [
  'contents',
  'remark',
]) {}
