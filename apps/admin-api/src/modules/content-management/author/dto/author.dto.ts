import {
  ValidateBitmask,
  ValidateBoolean,
  ValidateEnum,
  ValidateNumber,
  ValidateString,
} from '@libs/base/decorators'
import { BaseDto, IdDto, OMIT_BASE_FIELDS, PageDto } from '@libs/base/dto'
import { GenderEnum } from '@libs/base/enum'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
import { AuthorTypeEnum } from '../author.constant'

/**
 * 作者基础DTO
 */
export class BaseAuthorDto extends BaseDto {
  @ValidateString({
    description: '作者姓名',
    example: '村上春树',
    required: true,
  })
  name!: string

  @ValidateString({
    description: '作者头像URL',
    example: 'https://example.com/avatar.jpg',
    required: false,
  })
  avatar?: string

  @ValidateString({
    description: '作者描述',
    example: '日本著名小说家，代表作有《挪威的森林》等',
    required: false,
  })
  description?: string

  @ValidateBoolean({
    description: '启用状态（true: 启用, false: 禁用）',
    example: true,
    required: true,
    default: true,
  })
  isEnabled!: boolean

  @ValidateBitmask({
    description: '作者角色类型 bitmask',
    example: 1,
    required: true,
    enum: AuthorTypeEnum,
  })
  type!: number

  @ValidateString({
    description: '国籍',
    example: '日本',
    required: false,
  })
  nationality?: string

  @ValidateEnum({
    description: '性别（0: 未知, 1: 男性, 2: 女性, 3: 其他）',
    example: GenderEnum.MALE,
    required: true,
    enum: GenderEnum,
    default: GenderEnum.UNKNOWN,
  })
  gender!: GenderEnum

  @ValidateString({
    description: '社交媒体链接（JSON格式存储多个平台链接）',
    example: '{"twitter":"@author","instagram":"@author_ig"}',
    required: false,
  })
  socialLinks?: string

  @ValidateString({
    description: '管理员备注',
    example: '优秀作者，作品质量高',
    required: false,
  })
  remark?: string

  @ValidateNumber({
    description: '作品数量（冗余字段，用于提升查询性能）',
    example: 10,
    required: true,
    min: 0,
    default: 0,
  })
  worksCount!: number

  @ValidateNumber({
    description: '粉丝数量（冗余字段，用于前台展示）',
    example: 1000,
    required: true,
    min: 0,
    default: 0,
  })
  followersCount!: number

  @ValidateBoolean({
    description: '是否为推荐作者（用于前台推荐展示）',
    example: false,
    required: true,
    default: false,
  })
  isRecommended!: boolean
}

/**
 * 创建作者DTO
 */
export class CreateAuthorDto extends OmitType(BaseAuthorDto, [
  ...OMIT_BASE_FIELDS,
  'worksCount',
  'isEnabled',
  'isRecommended',
  'followersCount',
]) {}

/**
 * 更新作者DTO
 */
export class UpdateAuthorDto extends IntersectionType(CreateAuthorDto, IdDto) {}

/**
 * 查询作者DTO
 */
export class QueryAuthorDto extends IntersectionType(
  PageDto,
  PickType(PartialType(BaseAuthorDto), [
    'name',
    'isEnabled',
    'nationality',
    'gender',
    'type',
    'isRecommended',
  ]),
) {}

/**
 * 更新作者推荐状态DTO
 */
export class UpdateAuthorisRecommendedDto extends IntersectionType(
  PickType(BaseAuthorDto, ['isRecommended']),
  IdDto,
) {}

/**
 * 作者分页响应DTO
 */
export class AuthorPageResponseDto extends OmitType(BaseAuthorDto, [
  'remark',
  'socialLinks',
  'description',
]) {}
