import { WorkViewPermissionEnum } from '@libs/base/constant'
import {
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

/// 章节基础DTO
export class BaseWorkChapterDto extends BaseDto {
  @ValidateNumber({
    description: '作品ID',
    example: 1,
    required: true,
  })
  workId!: number

  @ValidateNumber({
    description: '作品类型（1=漫画, 2=小说）',
    example: 1,
    required: true,
  })
  workType!: number

  @ValidateString({
    description: '章节标题',
    example: '第1话 巨人的来袭',
    required: true,
    maxLength: 100,
  })
  title!: string

  @ValidateString({
    description: '章节副标题',
    example: '序幕',
    required: false,
    maxLength: 200,
  })
  subtitle?: string

  @ValidateString({
    description: '章节描述',
    example: '这是第一章的内容描述',
    required: false,
    maxLength: 1000,
  })
  description?: string

  @ValidateNumber({
    description: '章节序号',
    example: 1,
    required: true,
    min: 0,
  })
  sortOrder!: number

  @ValidateEnum({
    description: '查看规则（0=所有人, 1=登录用户, 2=会员, 3=积分购买）',
    example: WorkViewPermissionEnum.ALL,
    required: true,
    enum: WorkViewPermissionEnum,
    default: WorkViewPermissionEnum.ALL,
  })
  readRule!: WorkViewPermissionEnum

  @ValidateNumber({
    description: '阅读所需积分',
    example: 10,
    required: false,
    min: 0,
  })
  readPoints?: number

  @ValidateNumber({
    description: '下载规则（0=禁止, 1=允许, 2=VIP可下载, 3=积分可下载）',
    example: 1,
    required: true,
    default: 1,
  })
  downloadRule!: number

  @ValidateNumber({
    description: '下载所需积分',
    example: 5,
    required: false,
    min: 0,
  })
  downloadPoints?: number

  @ValidateNumber({
    description: '阅读所需会员等级ID',
    example: 1,
    required: false,
  })
  requiredReadLevelId?: number

  @ValidateNumber({
    description: '下载所需会员等级ID',
    example: 1,
    required: false,
  })
  requiredDownloadLevelId?: number

  @ValidateBoolean({
    description: '发布状态',
    example: false,
    required: true,
    default: false,
  })
  isPublished!: boolean

  @ValidateBoolean({
    description: '是否为试读章节',
    example: false,
    required: true,
    default: false,
  })
  isPreview!: boolean

  @ValidateBoolean({
    description: '是否允许评论',
    example: true,
    required: true,
    default: true,
  })
  canComment!: boolean

  @ValidateDate({
    description: '发布时间',
    example: '2024-01-01',
    required: false,
  })
  publishAt?: Date

  @ApiProperty({
    description: '阅读次数',
    example: 1000,
    required: true,
    default: 0,
  })
  viewCount!: number

  @ApiProperty({
    description: '点赞数',
    example: 100,
    required: true,
    default: 0,
  })
  likeCount!: number

  @ApiProperty({
    description: '评论数',
    example: 50,
    required: true,
    default: 0,
  })
  commentCount!: number

  @ApiProperty({
    description: '购买次数',
    example: 20,
    required: true,
    default: 0,
  })
  purchaseCount!: number

  @ApiProperty({
    description: '字数（小说章节）',
    example: 3000,
    required: true,
    default: 0,
  })
  wordCount!: number

  @ValidateString({
    description: '内容存储路径',
    example: '/uploads/chapters/1/',
    required: false,
    maxLength: 500,
  })
  contentPath?: string

  @ValidateString({
    description: '备注',
    example: '管理员备注',
    required: false,
    maxLength: 1000,
  })
  remark?: string
}

/// 创建章节DTO
export class CreateWorkChapterDto extends OmitType(BaseWorkChapterDto, [
  ...OMIT_BASE_FIELDS,
  'viewCount',
  'likeCount',
  'commentCount',
  'purchaseCount',
  'wordCount',
]) {}

/// 更新章节DTO
export class UpdateWorkChapterDto extends IntersectionType(
  PartialType(CreateWorkChapterDto),
  IdDto,
) {}

/// 查询章节DTO
export class QueryWorkChapterDto extends IntersectionType(
  PageDto,
  PickType(PartialType(BaseWorkChapterDto), [
    'workId',
    'title',
    'isPublished',
    'isPreview',
    'readRule',
  ]),
) {}

/// 章节用户状态字段DTO
export class ChapterUserStatusFieldsDto {
  @ApiProperty({
    description: '是否已点赞',
    example: true,
    required: true,
  })
  liked!: boolean

  @ApiProperty({
    description: '是否已购买',
    example: false,
    required: true,
  })
  purchased!: boolean

  @ApiProperty({
    description: '是否已下载',
    example: false,
    required: true,
  })
  downloaded!: boolean
}

/// 章节分页带用户状态DTO
export class WorkChapterPageWithUserStatusDto extends IntersectionType(
  BaseWorkChapterDto,
  ChapterUserStatusFieldsDto,
) {}

/// 章节详情带用户状态DTO
export class WorkChapterDetailWithUserStatusDto extends WorkChapterPageWithUserStatusDto {}

/// 章节用户状态DTO
export class WorkChapterUserStatusDto extends IntersectionType(
  IdDto,
  ChapterUserStatusFieldsDto,
) {}
