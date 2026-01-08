import { ValidateBoolean, ValidateString } from '@libs/base/decorators'
import { BaseDto, IdDto, OMIT_BASE_FIELDS, PageDto } from '@libs/base/dto'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'

export class BaseSensitiveWordDto extends BaseDto {
  @ValidateString({
    description: '敏感词',
    maxLength: 100,
    required: true,
    example: '测试',
  })
  word!: string

  @ValidateString({
    description: '替换词',
    maxLength: 100,
    required: false,
    example: '***',
    default: '***',
  })
  replaceWord?: string

  @ValidateBoolean({
    description: '是否启用',
    required: false,
    example: true,
    default: true,
  })
  isEnabled?: boolean

  @ValidateString({
    description: '备注',
    maxLength: 500,
    required: false,
  })
  remark?: string
}

export class CreateSensitiveWordDto extends OmitType(
  BaseSensitiveWordDto,
  OMIT_BASE_FIELDS,
) {}

export class UpdateSensitiveWordDto extends IntersectionType(
  CreateSensitiveWordDto,
  IdDto,
) {}

export class QuerySensitiveWordDto extends IntersectionType(
  PageDto,
  PartialType(PickType(CreateSensitiveWordDto, ['word', 'isEnabled'])),
) {}
