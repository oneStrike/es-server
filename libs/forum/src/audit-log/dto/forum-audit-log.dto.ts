import {
  ValidateNumber,
  ValidateOptional,
} from '@libs/base/decorators'
import { BaseDto, PageDto } from '@libs/base/dto'
import {
  IntersectionType,
  PartialType,
  PickType,
} from '@nestjs/swagger'

export class BaseForumAuditLogDto extends BaseDto {
  @ValidateNumber({
    description: '审核对象类型（1=主题, 2=回复）',
    example: 1,
    required: true,
    min: 1,
    max: 2,
  })
  objectType!: number

  @ValidateNumber({
    description: '审核对象ID',
    example: 1,
    required: true,
    min: 1,
  })
  objectId!: number

  @ValidateNumber({
    description: '审核状态（0=待审核, 1=已通过, 2=已拒绝）',
    example: 1,
    required: true,
    min: 0,
    max: 2,
  })
  auditStatus!: number

  @ValidateOptional({
    description: '审核原因',
    example: '内容违规',
    maxLength: 500,
  })
  auditReason?: string

  @ValidateNumber({
    description: '审核人ID',
    example: 1,
    required: true,
    min: 1,
  })
  auditBy!: number

  @ValidateOptional({
    description: '备注',
    example: '备注信息',
    maxLength: 500,
  })
  remark?: string
}

export class CreateForumAuditLogDto extends PickType(BaseForumAuditLogDto, [
  'objectType',
  'objectId',
  'auditStatus',
  'auditReason',
  'auditBy',
  'remark',
]) {}

export class QueryForumAuditLogDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseForumAuditLogDto, ['objectType', 'objectId', 'auditStatus', 'auditBy']),
  ),
) {}
