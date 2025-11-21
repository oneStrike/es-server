import {
  ValidateBoolean,
  ValidateNumber,
  ValidateString,
} from '@libs/decorators'
import { IdDto, PageDto } from '@libs/dto'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'

/**
 * 内容类型基础 DTO
 */
export class BaseContentTypeDto {
  @ValidateNumber({
    description: 'ID',
    example: 1,
    required: true,
    min: 1,
  })
  id!: number

  @ValidateString({
    description: '类型编码（唯一，如：COMIC/NOVEL/ILLUSTRATION/ALBUM）',
    example: 'COMIC',
    required: true,
    maxLength: 32,
  })
  code!: string

  @ValidateString({
    description: '显示名称',
    example: '漫画',
    required: true,
    maxLength: 50,
  })
  name!: string

  @ValidateBoolean({
    description: '是否启用',
    example: true,
    required: false,
  })
  isEnabled!: boolean

  @ValidateString({
    description: '创建时间',
    example: '2024-01-01T00:00:00.000Z',
    required: false,
  })
  createdAt!: string

  @ValidateString({
    description: '更新时间',
    example: '2024-01-01T00:00:00.000Z',
    required: false,
  })
  updatedAt!: string
}

/**
 * 创建内容类型 DTO
 */
export class CreateContentTypeDto extends OmitType(BaseContentTypeDto, [
  'id',
  'createdAt',
  'updatedAt',
]) {}

/**
 * 更新内容类型 DTO
 */
export class UpdateContentTypeDto extends IntersectionType(
  PartialType(OmitType(BaseContentTypeDto, ['id', 'createdAt', 'updatedAt'])),
  IdDto,
) {}

/**
 * 查询内容类型 DTO
 */
export class QueryContentTypeDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(PartialType(BaseContentTypeDto), ['code', 'name', 'isEnabled']),
  ),
) {}
