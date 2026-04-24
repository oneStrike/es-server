import {
  BooleanProperty,
  DateProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseDto, IdDto, OMIT_BASE_FIELDS, PageDto } from '@libs/platform/dto'

import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'

/**
 * 协议基础 DTO
 */
export class BaseAgreementDto extends BaseDto {
  @StringProperty({
    description: '协议标题',
    example: '隐私政策',
    required: true,
    maxLength: 200,
  })
  title!: string

  @StringProperty({
    description: '协议内容',
    example: '<p>...</p>',
    required: true,
  })
  content!: string

  @StringProperty({
    description: '版本号',
    example: '1.0.0',
    required: true,
    maxLength: 50,
  })
  version!: string

  @BooleanProperty({
    description: '是否强制重新同意',
    example: false,
    required: true,
    default: false,
  })
  isForce!: boolean

  @BooleanProperty({
    description: '是否展示在登录注册页',
    example: false,
    required: true,
    default: false,
  })
  showInAuth!: boolean

  @BooleanProperty({
    description: '是否已发布',
    example: false,
    required: true,
    default: false,
  })
  isPublished!: boolean

  @DateProperty({
    description: '发布时间',
    example: '2024-01-01T00:00:00.000Z',
    required: false,
  })
  publishedAt?: Date | null
}

export class CreateAgreementDto extends OmitType(BaseAgreementDto, [
  ...OMIT_BASE_FIELDS,
  'isPublished',
  'publishedAt',
] as const) {}

export class UpdateAgreementDto extends IntersectionType(
  IdDto,
  CreateAgreementDto,
) {}

export class QueryAgreementDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseAgreementDto, ['title', 'isPublished', 'showInAuth'] as const),
  ),
) {}

export class QueryPublishedAgreementDto extends PartialType(
  PickType(BaseAgreementDto, ['showInAuth'] as const),
) {}

export class AgreementListItemDto extends OmitType(BaseAgreementDto, [
  'content',
] as const) {}
