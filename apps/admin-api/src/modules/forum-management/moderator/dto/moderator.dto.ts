import { ApiProperty } from '@nestjs/swagger'
import { ModeratorPermissionEnum } from '../moderator.constant'
import { IsArray, IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator'
import { Type } from 'class-transformer'
import { ValidateNumber } from '@libs/base/dto'

export class CreateModeratorDto {
  @ApiProperty({ description: '用户ID', example: 1 })
  @ValidateNumber()
  userId!: number

  @ApiProperty({ description: '权限列表', type: [Number], example: [1, 2, 4, 8] })
  @IsArray()
  @IsNumber({}, { each: true })
  permissions!: ModeratorPermissionEnum[]

  @ApiProperty({ description: '是否启用', example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean

  @ApiProperty({ description: '备注', example: '资深版主', required: false })
  @IsOptional()
  @IsString()
  remark?: string
}

export class UpdateModeratorDto {
  @ApiProperty({ description: '版主ID', example: 1 })
  @ValidateNumber()
  id!: number

  @ApiProperty({ description: '权限列表', type: [Number], example: [1, 2, 4, 8], required: false })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  permissions?: ModeratorPermissionEnum[]

  @ApiProperty({ description: '是否启用', example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean

  @ApiProperty({ description: '备注', example: '资深版主', required: false })
  @IsOptional()
  @IsString()
  remark?: string
}

export class RemoveModeratorDto {
  @ApiProperty({ description: '版主ID', example: 1 })
  @ValidateNumber()
  id!: number
}

export class AssignModeratorSectionDto {
  @ApiProperty({ description: '版主ID', example: 1 })
  @ValidateNumber()
  moderatorId!: number

  @ApiProperty({ description: '板块ID列表', type: [Number], example: [1, 2, 3] })
  @IsArray()
  @IsNumber({}, { each: true })
  sectionIds!: number[]
}

export class QueryModeratorDto {
  @ApiProperty({ description: '用户ID', example: 1, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  userId?: number

  @ApiProperty({ description: '用户名', example: 'zhangsan', required: false })
  @IsOptional()
  @IsString()
  username?: string

  @ApiProperty({ description: '是否启用', example: true, required: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isEnabled?: boolean

  @ApiProperty({ description: '板块ID', example: 1, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sectionId?: number

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

export class QueryModeratorActionLogDto {
  @ApiProperty({ description: '版主ID', example: 1, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  moderatorId?: number

  @ApiProperty({ description: '操作类型', example: 'pin_topic', required: false })
  @IsOptional()
  @IsString()
  actionType?: string

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

export class ModeratorDto {
  @ApiProperty({ description: '版主ID', example: 1 })
  id!: number

  @ApiProperty({ description: '用户ID', example: 1 })
  userId!: number

  @ApiProperty({ description: '用户名', example: 'zhangsan' })
  username!: string

  @ApiProperty({ description: '昵称', example: '张三' })
  nickname!: string

  @ApiProperty({ description: '头像', example: 'https://example.com/avatar.jpg' })
  avatar?: string

  @ApiProperty({ description: '权限列表', type: [Number], example: [1, 2, 4, 8] })
  permissions!: ModeratorPermissionEnum[]

  @ApiProperty({ description: '权限名称列表', example: ['置顶', '加精', '锁定', '删除'] })
  permissionNames!: string[]

  @ApiProperty({ description: '是否启用', example: true })
  isEnabled!: boolean

  @ApiProperty({ description: '备注', example: '资深版主' })
  remark?: string

  @ApiProperty({ description: '管理的板块列表', type: [Object] })
  sections!: Array<{
    id: number
    name: string
  }>

  @ApiProperty({ description: '创建时间', example: '2024-01-01T00:00:00.000Z' })
  createdAt!: Date
}

export class ModeratorPageDto {
  @ApiProperty({ description: '版主列表', type: [ModeratorDto] })
  list!: ModeratorDto[]

  @ApiProperty({ description: '总数', example: 100 })
  total!: number

  @ApiProperty({ description: '页码', example: 1 })
  page!: number

  @ApiProperty({ description: '每页数量', example: 20 })
  pageSize!: number
}

export class ModeratorActionLogDto {
  @ApiProperty({ description: '日志ID', example: 1 })
  id!: number

  @ApiProperty({ description: '版主ID', example: 1 })
  moderatorId!: number

  @ApiProperty({ description: '版主用户名', example: 'zhangsan' })
  moderatorUsername!: string

  @ApiProperty({ description: '操作类型', example: 'pin_topic' })
  actionType!: string

  @ApiProperty({ description: '操作描述', example: '置顶主题' })
  actionDescription!: string

  @ApiProperty({ description: '目标类型', example: 'topic' })
  targetType!: string

  @ApiProperty({ description: '目标ID', example: 1 })
  targetId!: number

  @ApiProperty({ description: '操作前数据', example: '{}' })
  beforeData?: string

  @ApiProperty({ description: '操作后数据', example: '{}' })
  afterData?: string

  @ApiProperty({ description: '操作时间', example: '2024-01-01T00:00:00.000Z' })
  createdAt!: Date
}

export class ModeratorActionLogPageDto {
  @ApiProperty({ description: '操作日志列表', type: [ModeratorActionLogDto] })
  list!: ModeratorActionLogDto[]

  @ApiProperty({ description: '总数', example: 100 })
  total!: number

  @ApiProperty({ description: '页码', example: 1 })
  page!: number

  @ApiProperty({ description: '每页数量', example: 20 })
  pageSize!: number
}
