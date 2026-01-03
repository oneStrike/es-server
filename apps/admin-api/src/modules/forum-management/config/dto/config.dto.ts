import { ApiProperty } from '@nestjs/swagger'
import { IsBoolean, IsNumber, IsOptional, IsString, ValidateString } from '@libs/base/validator'

export class CreatePointRuleDto {
  @ApiProperty({ description: '规则名称', example: '每日签到' })
  @ValidateString({ maxLength: 50 })
  name!: string

  @ApiProperty({ description: '规则代码', example: 'daily_sign_in' })
  @ValidateString({ maxLength: 50 })
  code!: string

  @ApiProperty({ description: '积分值', example: 10 })
  @IsNumber()
  pointValue!: number

  @ApiProperty({ description: '每日限制次数', example: 1, required: false })
  @IsOptional()
  @IsNumber()
  dailyLimit?: number

  @ApiProperty({ description: '是否启用', example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean

  @ApiProperty({ description: '备注', example: '用户每日签到可获得10积分', required: false })
  @IsOptional()
  @ValidateString({ maxLength: 500 })
  remark?: string
}

export class UpdatePointRuleDto {
  @ApiProperty({ description: '规则ID', example: 1 })
  @IsNumber()
  id!: number

  @ApiProperty({ description: '规则名称', example: '每日签到', required: false })
  @IsOptional()
  @ValidateString({ maxLength: 50 })
  name?: string

  @ApiProperty({ description: '规则代码', example: 'daily_sign_in', required: false })
  @IsOptional()
  @ValidateString({ maxLength: 50 })
  code?: string

  @ApiProperty({ description: '积分值', example: 10, required: false })
  @IsOptional()
  @IsNumber()
  pointValue?: number

  @ApiProperty({ description: '每日限制次数', example: 1, required: false })
  @IsOptional()
  @IsNumber()
  dailyLimit?: number

  @ApiProperty({ description: '是否启用', example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean

  @ApiProperty({ description: '备注', example: '用户每日签到可获得10积分', required: false })
  @IsOptional()
  @ValidateString({ maxLength: 500 })
  remark?: string
}

export class QueryPointRuleDto {
  @ApiProperty({ description: '规则名称', example: '签到', required: false })
  @IsOptional()
  @IsString()
  name?: string

  @ApiProperty({ description: '规则代码', example: 'daily_sign_in', required: false })
  @IsOptional()
  @IsString()
  code?: string

  @ApiProperty({ description: '是否启用', example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean

  @ApiProperty({ description: '页码', example: 1, required: false })
  @IsOptional()
  @IsNumber()
  page?: number

  @ApiProperty({ description: '每页数量', example: 10, required: false })
  @IsOptional()
  @IsNumber()
  pageSize?: number

  @ApiProperty({ description: '排序字段', example: 'id', required: false })
  @IsOptional()
  @IsString()
  orderBy?: string

  @ApiProperty({ description: '排序方式', example: 'desc', required: false })
  @IsOptional()
  @IsString()
  orderDirection?: string
}

export class BasePointRuleDto {
  @ApiProperty({ description: '规则ID', example: 1 })
  id!: number

  @ApiProperty({ description: '规则名称', example: '每日签到' })
  name!: string

  @ApiProperty({ description: '规则代码', example: 'daily_sign_in' })
  code!: string

  @ApiProperty({ description: '积分值', example: 10 })
  pointValue!: number

  @ApiProperty({ description: '每日限制次数', example: 1 })
  dailyLimit!: number

  @ApiProperty({ description: '是否启用', example: true })
  isEnabled!: boolean

  @ApiProperty({ description: '备注', example: '用户每日签到可获得10积分' })
  remark!: string

  @ApiProperty({ description: '创建时间', example: '2024-01-01T00:00:00.000Z' })
  createdAt!: Date

  @ApiProperty({ description: '更新时间', example: '2024-01-01T00:00:00.000Z' })
  updatedAt!: Date
}

export class CreateLevelRuleDto {
  @ApiProperty({ description: '等级名称', example: '初级会员' })
  @ValidateString({ maxLength: 50 })
  name!: string

  @ApiProperty({ description: '等级级别', example: 1 })
  @IsNumber()
  level!: number

  @ApiProperty({ description: '所需积分', example: 0 })
  @IsNumber()
  requiredPoints!: number

  @ApiProperty({ description: '每日发帖限制', example: 10, required: false })
  @IsOptional()
  @IsNumber()
  dailyPostLimit?: number

  @ApiProperty({ description: '每日回复限制', example: 50, required: false })
  @IsOptional()
  @IsNumber()
  dailyReplyLimit?: number

  @ApiProperty({ description: '是否启用', example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean

  @ApiProperty({ description: '备注', example: '新用户默认等级', required: false })
  @IsOptional()
  @ValidateString({ maxLength: 500 })
  remark?: string
}

export class UpdateLevelRuleDto {
  @ApiProperty({ description: '规则ID', example: 1 })
  @IsNumber()
  id!: number

  @ApiProperty({ description: '等级名称', example: '初级会员', required: false })
  @IsOptional()
  @ValidateString({ maxLength: 50 })
  name?: string

  @ApiProperty({ description: '等级级别', example: 1, required: false })
  @IsOptional()
  @IsNumber()
  level?: number

  @ApiProperty({ description: '所需积分', example: 0, required: false })
  @IsOptional()
  @IsNumber()
  requiredPoints?: number

  @ApiProperty({ description: '每日发帖限制', example: 10, required: false })
  @IsOptional()
  @IsNumber()
  dailyPostLimit?: number

  @ApiProperty({ description: '每日回复限制', example: 50, required: false })
  @IsOptional()
  @IsNumber()
  dailyReplyLimit?: number

  @ApiProperty({ description: '是否启用', example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean

  @ApiProperty({ description: '备注', example: '新用户默认等级', required: false })
  @IsOptional()
  @ValidateString({ maxLength: 500 })
  remark?: string
}

export class QueryLevelRuleDto {
  @ApiProperty({ description: '等级名称', example: '会员', required: false })
  @IsOptional()
  @IsString()
  name?: string

  @ApiProperty({ description: '是否启用', example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean

  @ApiProperty({ description: '页码', example: 1, required: false })
  @IsOptional()
  @IsNumber()
  page?: number

  @ApiProperty({ description: '每页数量', example: 10, required: false })
  @IsOptional()
  @IsNumber()
  pageSize?: number

  @ApiProperty({ description: '排序字段', example: 'level', required: false })
  @IsOptional()
  @IsString()
  orderBy?: string

  @ApiProperty({ description: '排序方式', example: 'asc', required: false })
  @IsOptional()
  @IsString()
  orderDirection?: string
}

export class BaseLevelRuleDto {
  @ApiProperty({ description: '规则ID', example: 1 })
  id!: number

  @ApiProperty({ description: '等级名称', example: '初级会员' })
  name!: string

  @ApiProperty({ description: '等级级别', example: 1 })
  level!: number

  @ApiProperty({ description: '所需积分', example: 0 })
  requiredPoints!: number

  @ApiProperty({ description: '每日发帖限制', example: 10 })
  dailyPostLimit!: number

  @ApiProperty({ description: '每日回复限制', example: 50 })
  dailyReplyLimit!: number

  @ApiProperty({ description: '是否启用', example: true })
  isEnabled!: boolean

  @ApiProperty({ description: '备注', example: '新用户默认等级' })
  remark!: string

  @ApiProperty({ description: '创建时间', example: '2024-01-01T00:00:00.000Z' })
  createdAt!: Date

  @ApiProperty({ description: '更新时间', example: '2024-01-01T00:00:00.000Z' })
  updatedAt!: Date
}

export class CreateBadgeDto {
  @ApiProperty({ description: '徽章名称', example: '活跃用户' })
  @ValidateString({ maxLength: 50 })
  name!: string

  @ApiProperty({ description: '徽章图标', example: 'active-user.png' })
  @ValidateString({ maxLength: 200 })
  icon!: string

  @ApiProperty({ description: '徽章描述', example: '连续签到7天获得', required: false })
  @IsOptional()
  @ValidateString({ maxLength: 500 })
  description?: string

  @ApiProperty({ description: '获得条件', example: '连续签到7天' })
  @ValidateString({ maxLength: 500 })
  condition!: string

  @ApiProperty({ description: '是否启用', example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean

  @ApiProperty({ description: '排序', example: 1, required: false })
  @IsOptional()
  @IsNumber()
  order?: number

  @ApiProperty({ description: '备注', example: '活跃用户徽章', required: false })
  @IsOptional()
  @ValidateString({ maxLength: 500 })
  remark?: string
}

export class UpdateBadgeDto {
  @ApiProperty({ description: '徽章ID', example: 1 })
  @IsNumber()
  id!: number

  @ApiProperty({ description: '徽章名称', example: '活跃用户', required: false })
  @IsOptional()
  @ValidateString({ maxLength: 50 })
  name?: string

  @ApiProperty({ description: '徽章图标', example: 'active-user.png', required: false })
  @IsOptional()
  @ValidateString({ maxLength: 200 })
  icon?: string

  @ApiProperty({ description: '徽章描述', example: '连续签到7天获得', required: false })
  @IsOptional()
  @ValidateString({ maxLength: 500 })
  description?: string

  @ApiProperty({ description: '获得条件', example: '连续签到7天', required: false })
  @IsOptional()
  @ValidateString({ maxLength: 500 })
  condition?: string

  @ApiProperty({ description: '是否启用', example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean

  @ApiProperty({ description: '排序', example: 1, required: false })
  @IsOptional()
  @IsNumber()
  order?: number

  @ApiProperty({ description: '备注', example: '活跃用户徽章', required: false })
  @IsOptional()
  @ValidateString({ maxLength: 500 })
  remark?: string
}

export class QueryBadgeDto {
  @ApiProperty({ description: '徽章名称', example: '活跃', required: false })
  @IsOptional()
  @IsString()
  name?: string

  @ApiProperty({ description: '是否启用', example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean

  @ApiProperty({ description: '页码', example: 1, required: false })
  @IsOptional()
  @IsNumber()
  page?: number

  @ApiProperty({ description: '每页数量', example: 10, required: false })
  @IsOptional()
  @IsNumber()
  pageSize?: number

  @ApiProperty({ description: '排序字段', example: 'order', required: false })
  @IsOptional()
  @IsString()
  orderBy?: string

  @ApiProperty({ description: '排序方式', example: 'asc', required: false })
  @IsOptional()
  @IsString()
  orderDirection?: string
}

export class BaseBadgeDto {
  @ApiProperty({ description: '徽章ID', example: 1 })
  id!: number

  @ApiProperty({ description: '徽章名称', example: '活跃用户' })
  name!: string

  @ApiProperty({ description: '徽章图标', example: 'active-user.png' })
  icon!: string

  @ApiProperty({ description: '徽章描述', example: '连续签到7天获得' })
  description!: string

  @ApiProperty({ description: '获得条件', example: '连续签到7天' })
  condition!: string

  @ApiProperty({ description: '是否启用', example: true })
  isEnabled!: boolean

  @ApiProperty({ description: '排序', example: 1 })
  order!: number

  @ApiProperty({ description: '备注', example: '活跃用户徽章' })
  remark!: string

  @ApiProperty({ description: '创建时间', example: '2024-01-01T00:00:00.000Z' })
  createdAt!: Date

  @ApiProperty({ description: '更新时间', example: '2024-01-01T00:00:00.000Z' })
  updatedAt!: Date
}

export class UpdateSystemConfigDto {
  @ApiProperty({ description: '配置ID', example: 1 })
  @IsNumber()
  id!: number

  @ApiProperty({ description: '配置值', example: 'true', required: false })
  @IsOptional()
  @ValidateString({ maxLength: 1000 })
  configValue?: string

  @ApiProperty({ description: '是否启用', example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean

  @ApiProperty({ description: '备注', example: '系统基础配置', required: false })
  @IsOptional()
  @ValidateString({ maxLength: 500 })
  remark?: string
}

export class BaseSystemConfigDto {
  @ApiProperty({ description: '配置ID', example: 1 })
  id!: number

  @ApiProperty({ description: '配置键', example: 'enable_registration' })
  configKey!: string

  @ApiProperty({ description: '配置名称', example: '开启注册' })
  configName!: string

  @ApiProperty({ description: '配置值', example: 'true' })
  configValue!: string

  @ApiProperty({ description: '配置类型', example: 'boolean' })
  configType!: string

  @ApiProperty({ description: '是否启用', example: true })
  isEnabled!: boolean

  @ApiProperty({ description: '备注', example: '系统基础配置' })
  remark!: string

  @ApiProperty({ description: '创建时间', example: '2024-01-01T00:00:00.000Z' })
  createdAt!: Date

  @ApiProperty({ description: '更新时间', example: '2024-01-01T00:00:00.000Z' })
  updatedAt!: Date
}
