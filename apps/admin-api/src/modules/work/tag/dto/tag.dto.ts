import {
  ValidateBoolean,
  ValidateNumber,
  ValidateString,
} from '@libs/base/decorators'
import { IdDto, PageDto } from '@libs/base/dto'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'

/**
 * 标签基础 DTO
 */
export class BaseTagDto {
  @ValidateNumber({
    description: '标签ID',
    example: 1,
    required: true,
    min: 1,
  })
  id!: number

  @ValidateString({
    description: '标签名称',
    example: '科幻',
    required: true,
    maxLength: 20,
  })
  name!: string

  @ValidateString({
    description: '标签图标URL',
    example: 'https://example.com/icon.png',
    required: false,
    maxLength: 255,
  })
  icon?: string

  @ValidateNumber({
    description: '人气值',
    example: 1000,
    required: false,
    min: 0,
  })
  popularity!: number

  @ValidateNumber({
    description: '辅助人气值',
    example: 500,
    required: false,
    min: 0,
  })
  popularityWeight!: number

  @ValidateNumber({
    description: '排序值',
    example: 1,
    required: false,
    min: 0,
    max: 32767,
  })
  order!: number

  @ValidateBoolean({
    description: '是否启用',
    example: true,
    required: false,
  })
  isEnabled!: boolean
}

/**
 * 创建标签 DTO
 */
export class CreateTagDto extends OmitType(BaseTagDto, [
  'id',
  'popularity',
]) {}

/**
 * 更新标签 DTO
 */
export class UpdateTagDto extends IntersectionType(
  CreateTagDto,
  IdDto,
) {}

/**
 * 查询标签 DTO
 */
export class QueryTagDto extends IntersectionType(
  PageDto,
  PickType(PartialType(CreateTagDto), ['name', 'isEnabled']),
) {}
