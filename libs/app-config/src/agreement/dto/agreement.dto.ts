import {
  ValidateBoolean,
  ValidateDate,
  ValidateString,
} from '@libs/base/decorators'
import { BaseDto, IdDto, OMIT_BASE_FIELDS, PageDto } from '@libs/base/dto'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'

/**
 * 协议基础DTO
 */
export class BaseAgreementDto extends BaseDto {
  @ValidateString({
    description: '协议标题',
    example: '隐私政策',
    required: true,
    maxLength: 200,
  })
  title!: string

  @ValidateString({
    description: '协议内容',
    example: '<p>...</p>',
    required: true,
  })
  content!: string

  @ValidateString({
    description: '版本号',
    example: '1.0.0',
    required: true,
    maxLength: 50,
  })
  version!: string

  @ValidateBoolean({
    description: '是否强制重新同意',
    example: false,
    required: false,
    default: false,
  })
  isForce?: boolean

  @ValidateBoolean({
    description: '是否展示在登录注册页',
    example: false,
    required: false,
    default: false,
  })
  showInAuth?: boolean

  @ValidateBoolean({
    description: '是否已发布',
    example: false,
    required: false,
    default: false,
  })
  isPublished?: boolean

  @ValidateDate({
    description: '发布时间',
    example: '2024-01-01T00:00:00.000Z',
    required: false,
  })
  publishedAt?: Date
}

/**
 * 创建协议DTO
 */
export class CreateAgreementDto extends OmitType(BaseAgreementDto, [
  ...OMIT_BASE_FIELDS,
  'publishedAt',
]) {}

/**
 * 更新协议DTO
 */
export class UpdateAgreementDto extends IntersectionType(
  CreateAgreementDto,
  IdDto,
) {}

/**
 * 查询协议DTO
 */
export class QueryAgreementDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseAgreementDto, ['title', 'isPublished', 'showInAuth']),
  ),
) {}

/**
 * 列表或者分页响应dto
 */
export class ListOrPageAgreementResponseDto extends PickType(BaseAgreementDto, [
  'content',
]) {}

/**
 * 查询所有已发布的协议
 */
export class QueryPublishedAgreementDto extends PickType(BaseAgreementDto, [
  'showInAuth',
]) {}
