import {
  ValidateEnum,
  ValidateNumber,
  ValidateString,
} from '@libs/base/decorators'
import { BaseDto, PageDto } from '@libs/base/dto'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'
import { AuditStatusEnum, ObjectTypeEnum } from '../forum-audit-log.constant'

/**
 * 审核日志基础数据传输对象
 */
export class BaseForumAuditLogDto extends BaseDto {
  @ValidateEnum({
    description: '审核对象类型（1=主题, 2=回复）',
    example: ObjectTypeEnum.Topic,
    required: true,
    enum: ObjectTypeEnum,
  })
  objectType!: ObjectTypeEnum

  @ValidateNumber({
    description: '审核对象ID',
    example: 1,
    required: true,
    min: 1,
  })
  objectId!: number

  @ValidateEnum({
    description: '审核状态（0=待审核, 1=已通过, 2=已拒绝）',
    example: AuditStatusEnum.Approved,
    required: true,
    enum: AuditStatusEnum,
  })
  auditStatus!: AuditStatusEnum

  @ValidateString({
    description: '审核原因',
    example: '内容违规',
    maxLength: 500,
    required: false,
  })
  auditReason?: string

  @ValidateString({
    description: '备注',
    example: '备注信息',
    maxLength: 500,
    required: false,
  })
  remark?: string
}

/**
 * 创建审核日志数据传输对象
 */
export class CreateForumAuditLogDto extends PickType(BaseForumAuditLogDto, [
  'objectType',
  'objectId',
  'auditStatus',
  'auditReason',
  'remark',
]) {}

/**
 * 查询审核日志数据传输对象
 */
export class QueryForumAuditLogDto extends IntersectionType(
  PageDto,
  PartialType(PickType(BaseForumAuditLogDto, ['objectType', 'auditStatus'])),
) {}
