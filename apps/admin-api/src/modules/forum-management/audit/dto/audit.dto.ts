import { ValidateNumber, ValidateString } from '@libs/base/dto'
import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator'
import { AuditObjectTypeEnum, AuditStatusEnum } from '../audit.constant'

export class CreateSensitiveWordDto {
  @ApiProperty({ description: '敏感词', example: '测试' })
  @ValidateString({ maxLength: 100 })
  word!: string

  @ApiProperty({ description: '替换词', example: '***', required: false })
  @IsOptional()
  @ValidateString({ maxLength: 100 })
  replaceWord?: string

  @ApiProperty({ description: '是否启用', example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean

  @ApiProperty({ description: '备注', example: '政治敏感词', required: false })
  @IsOptional()
  @ValidateString({ maxLength: 500 })
  remark?: string
}

export class UpdateSensitiveWordDto {
  @ApiProperty({ description: '敏感词ID', example: 1 })
  @ValidateNumber()
  id!: number

  @ApiProperty({ description: '替换词', example: '***', required: false })
  @IsOptional()
  @ValidateString({ maxLength: 100 })
  replaceWord?: string

  @ApiProperty({ description: '是否启用', example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean

  @ApiProperty({ description: '备注', example: '政治敏感词', required: false })
  @IsOptional()
  @ValidateString({ maxLength: 500 })
  remark?: string
}

export class DeleteSensitiveWordDto {
  @ApiProperty({ description: '敏感词ID', example: 1 })
  @ValidateNumber()
  id!: number
}

export class QuerySensitiveWordDto {
  @ApiProperty({ description: '敏感词', example: '测试', required: false })
  @IsOptional()
  @IsString()
  word?: string

  @ApiProperty({ description: '是否启用', example: true, required: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isEnabled?: boolean

  @ApiProperty({ description: '页码', example: 1, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number

  @ApiProperty({ description: '每页数量', example: 20, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  pageSize?: number
}

export class QueryAuditQueueDto {
  @ApiProperty({ description: '审核对象类型', example: 1, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  objectType?: AuditObjectTypeEnum

  @ApiProperty({ description: '审核状态', example: 0, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  auditStatus?: AuditStatusEnum

  @ApiProperty({ description: '开始时间', example: '2024-01-01', required: false })
  @IsOptional()
  @IsString()
  startTime?: string

  @ApiProperty({ description: '结束时间', example: '2024-12-31', required: false })
  @IsOptional()
  @IsString()
  endTime?: string

  @ApiProperty({ description: '页码', example: 1, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number

  @ApiProperty({ description: '每页数量', example: 20, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  pageSize?: number
}

export class BatchApproveDto {
  @ApiProperty({ description: '审核日志ID列表', type: [Number], example: [1, 2, 3] })
  @IsNumber({}, { each: true })
  ids!: number[]
}

export class BatchRejectDto {
  @ApiProperty({ description: '审核日志ID列表', type: [Number], example: [1, 2, 3] })
  @IsNumber({}, { each: true })
  ids!: number[]

  @ApiProperty({ description: '拒绝原因', example: '内容违规' })
  @ValidateString({ maxLength: 500 })
  reason!: string
}

export class QueryAuditHistoryDto {
  @ApiProperty({ description: '审核对象类型', example: 1, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  objectType?: AuditObjectTypeEnum

  @ApiProperty({ description: '审核状态', example: 1, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  auditStatus?: AuditStatusEnum

  @ApiProperty({ description: '审核人ID', example: 1, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  auditBy?: number

  @ApiProperty({ description: '开始时间', example: '2024-01-01', required: false })
  @IsOptional()
  @IsString()
  startTime?: string

  @ApiProperty({ description: '结束时间', example: '2024-12-31', required: false })
  @IsOptional()
  @IsString()
  endTime?: string

  @ApiProperty({ description: '页码', example: 1, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number

  @ApiProperty({ description: '每页数量', example: 20, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  pageSize?: number
}

export class SensitiveWordDto {
  @ApiProperty({ description: '敏感词ID', example: 1 })
  id!: number

  @ApiProperty({ description: '敏感词', example: '测试' })
  word!: string

  @ApiProperty({ description: '替换词', example: '***' })
  replaceWord?: string

  @ApiProperty({ description: '是否启用', example: true })
  isEnabled!: boolean

  @ApiProperty({ description: '备注', example: '政治敏感词' })
  remark?: string

  @ApiProperty({ description: '创建时间', example: '2024-01-01T00:00:00.000Z' })
  createdAt!: Date
}

export class SensitiveWordPageDto {
  @ApiProperty({ description: '敏感词列表', type: [SensitiveWordDto] })
  list!: SensitiveWordDto[]

  @ApiProperty({ description: '总数', example: 100 })
  total!: number

  @ApiProperty({ description: '页码', example: 1 })
  page!: number

  @ApiProperty({ description: '每页数量', example: 20 })
  pageSize!: number
}

export class AuditQueueDto {
  @ApiProperty({ description: '审核日志ID', example: 1 })
  id!: number

  @ApiProperty({ description: '审核对象类型', example: 1 })
  objectType!: AuditObjectTypeEnum

  @ApiProperty({ description: '审核对象类型名称', example: '主题' })
  objectTypeName!: string

  @ApiProperty({ description: '审核对象ID', example: 1 })
  objectId!: number

  @ApiProperty({ description: '内容', example: '这是一个测试主题' })
  content!: string

  @ApiProperty({ description: '作者ID', example: 1 })
  authorId!: number

  @ApiProperty({ description: '作者用户名', example: 'zhangsan' })
  authorUsername!: string

  @ApiProperty({ description: '审核状态', example: 0 })
  auditStatus!: AuditStatusEnum

  @ApiProperty({ description: '审核状态名称', example: '待审核' })
  auditStatusName!: string

  @ApiProperty({ description: '审核原因', example: '内容违规' })
  auditReason?: string

  @ApiProperty({ description: '审核人ID', example: 1 })
  auditBy?: number

  @ApiProperty({ description: '审核时间', example: '2024-01-01T00:00:00.000Z' })
  auditAt?: Date

  @ApiProperty({ description: '创建时间', example: '2024-01-01T00:00:00.000Z' })
  createdAt!: Date
}

export class AuditQueuePageDto {
  @ApiProperty({ description: '审核队列列表', type: [AuditQueueDto] })
  list!: AuditQueueDto[]

  @ApiProperty({ description: '总数', example: 100 })
  total!: number

  @ApiProperty({ description: '页码', example: 1 })
  page!: number

  @ApiProperty({ description: '每页数量', example: 20 })
  pageSize!: number
}

export class AuditHistoryDto {
  @ApiProperty({ description: '审核日志ID', example: 1 })
  id!: number

  @ApiProperty({ description: '审核对象类型', example: 1 })
  objectType!: AuditObjectTypeEnum

  @ApiProperty({ description: '审核对象类型名称', example: '主题' })
  objectTypeName!: string

  @ApiProperty({ description: '审核对象ID', example: 1 })
  objectId!: number

  @ApiProperty({ description: '内容', example: '这是一个测试主题' })
  content!: string

  @ApiProperty({ description: '作者ID', example: 1 })
  authorId!: number

  @ApiProperty({ description: '作者用户名', example: 'zhangsan' })
  authorUsername!: string

  @ApiProperty({ description: '审核状态', example: 1 })
  auditStatus!: AuditStatusEnum

  @ApiProperty({ description: '审核状态名称', example: '已通过' })
  auditStatusName!: string

  @ApiProperty({ description: '审核原因', example: '内容违规' })
  auditReason?: string

  @ApiProperty({ description: '审核人ID', example: 1 })
  auditBy!: number

  @ApiProperty({ description: '审核人用户名', example: 'admin' })
  auditByUsername!: string

  @ApiProperty({ description: '审核时间', example: '2024-01-01T00:00:00.000Z' })
  auditAt!: Date

  @ApiProperty({ description: '创建时间', example: '2024-01-01T00:00:00.000Z' })
  createdAt!: Date
}

export class AuditHistoryPageDto {
  @ApiProperty({ description: '审核历史列表', type: [AuditHistoryDto] })
  list!: AuditHistoryDto[]

  @ApiProperty({ description: '总数', example: 100 })
  total!: number

  @ApiProperty({ description: '页码', example: 1 })
  page!: number

  @ApiProperty({ description: '每页数量', example: 20 })
  pageSize!: number
}
