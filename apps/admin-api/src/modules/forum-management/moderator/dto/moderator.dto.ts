import {
  ValidateArray,
  ValidateBoolean,
  ValidateNumber,
  ValidateString,
} from '@libs/base/decorators'
import { BaseDto, IdDto, PageDto } from '@libs/base/dto'
import {
  ApiProperty,
  IntersectionType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
import { ModeratorPermissionEnum } from '../moderator.constant'

export class CreateModeratorDto {
  @ValidateNumber({
    description: '用户ID',
    example: 1,
    required: true,
    min: 1,
  })
  userId!: number

  @ValidateArray({
    description: '权限列表',
    itemType: 'number',
    example: [1, 2, 4, 8],
    required: true,
  })
  permissions!: ModeratorPermissionEnum[]

  @ValidateBoolean({
    description: '是否启用',
    example: true,
    required: false,
    default: true,
  })
  isEnabled?: boolean

  @ValidateString({
    description: '备注',
    example: '资深版主',
    required: false,
    maxLength: 200,
  })
  remark?: string
}

export class UpdateModeratorDto extends IntersectionType(
  PartialType(CreateModeratorDto),
  IdDto,
) {}

export class RemoveModeratorDto extends IdDto {}

export class AssignModeratorSectionDto {
  @ValidateNumber({
    description: '版主ID',
    example: 1,
    required: true,
    min: 1,
  })
  moderatorId!: number

  @ValidateArray({
    description: '板块ID列表',
    itemType: 'number',
    example: [1, 2, 3],
    required: true,
  })
  sectionIds!: number[]

  @ValidateNumber({
    description: '自定义权限位掩码',
    example: 0,
    required: false,
    min: 0,
  })
  customPermissionMask?: number
}

export class QueryModeratorDto extends IntersectionType(
  PageDto,
  PartialType(PickType(BaseModeratorDto, ['isEnabled'])),
) {
  @ValidateNumber({
    description: '用户ID',
    example: 1,
    required: false,
    min: 1,
  })
  userId?: number

  @ValidateString({
    description: '用户名',
    example: 'zhangsan',
    required: false,
  })
  username?: string

  @ValidateNumber({
    description: '板块ID',
    example: 1,
    required: false,
    min: 1,
  })
  sectionId?: number
}

export class QueryModeratorActionLogDto extends PageDto {
  @ValidateNumber({
    description: '版主ID',
    example: 1,
    required: false,
    min: 1,
  })
  moderatorId?: number

  @ValidateString({
    description: '操作类型',
    example: 'pin_topic',
    required: false,
  })
  actionType?: string

  @ValidateString({
    description: '开始时间',
    example: '2024-01-01',
    required: false,
    type: 'ISO8601',
  })
  startTime?: string

  @ValidateString({
    description: '结束时间',
    example: '2024-12-31',
    required: false,
    type: 'ISO8601',
  })
  endTime?: string
}

export class BaseModeratorDto extends BaseDto {
  @ValidateNumber({
    description: '用户ID',
    example: 1,
    required: true,
    min: 1,
  })
  userId!: number

  @ValidateString({
    description: '用户名',
    example: 'zhangsan',
    required: true,
  })
  username!: string

  @ValidateString({
    description: '昵称',
    example: '张三',
    required: true,
  })
  nickname!: string

  @ValidateString({
    description: '头像',
    example: 'https://example.com/avatar.jpg',
    required: false,
  })
  avatar?: string

  @ValidateArray({
    description: '权限列表',
    itemType: 'number',
    example: [1, 2, 4, 8],
    required: true,
  })
  permissions!: ModeratorPermissionEnum[]

  @ValidateArray({
    description: '权限名称列表',
    itemType: 'string',
    example: ['置顶', '加精', '锁定', '删除'],
    required: true,
  })
  permissionNames!: string[]

  @ValidateBoolean({
    description: '是否启用',
    example: true,
    required: true,
  })
  isEnabled!: boolean

  @ValidateString({
    description: '备注',
    example: '资深版主',
    required: false,
    maxLength: 200,
  })
  remark?: string

  @ApiProperty({
    description: '管理的板块列表',
    type: [Object],
    required: true,
  })
  sections!: Array<{
    id: number
    name: string
    customPermissionMask: number
    finalPermissionMask: number
  }>
}

export class ModeratorDto extends BaseModeratorDto {}

export class ModeratorPageDto {
  @ApiProperty({ description: '版主列表', type: [ModeratorDto] })
  list!: ModeratorDto[]

  @ValidateNumber({
    description: '总数',
    example: 100,
    required: true,
    min: 0,
  })
  total!: number

  @ValidateNumber({
    description: '页码',
    example: 1,
    required: true,
    min: 0,
  })
  page!: number

  @ValidateNumber({
    description: '每页数量',
    example: 20,
    required: true,
    min: 1,
  })
  pageSize!: number
}

export class ModeratorActionLogDto {
  @ValidateNumber({
    description: '日志ID',
    example: 1,
    required: true,
    min: 1,
  })
  id!: number

  @ValidateNumber({
    description: '版主ID',
    example: 1,
    required: true,
    min: 1,
  })
  moderatorId!: number

  @ValidateString({
    description: '版主用户名',
    example: 'zhangsan',
    required: true,
  })
  moderatorUsername!: string

  @ValidateString({
    description: '操作类型',
    example: 'pin_topic',
    required: true,
  })
  actionType!: string

  @ValidateString({
    description: '操作描述',
    example: '置顶主题',
    required: true,
  })
  actionDescription!: string

  @ValidateString({
    description: '目标类型',
    example: 'topic',
    required: true,
  })
  targetType!: string

  @ValidateNumber({
    description: '目标ID',
    example: 1,
    required: true,
    min: 1,
  })
  targetId!: number

  @ValidateString({
    description: '操作前数据',
    example: '{}',
    required: false,
  })
  beforeData?: string

  @ValidateString({
    description: '操作后数据',
    example: '{}',
    required: false,
  })
  afterData?: string

  @ApiProperty({
    description: '操作时间',
    example: '2024-01-01T00:00:00.000Z',
    required: true,
  })
  createdAt!: Date
}

export class ModeratorActionLogPageDto {
  @ApiProperty({ description: '操作日志列表', type: [ModeratorActionLogDto] })
  list!: ModeratorActionLogDto[]

  @ValidateNumber({
    description: '总数',
    example: 100,
    required: true,
    min: 0,
  })
  total!: number

  @ValidateNumber({
    description: '页码',
    example: 1,
    required: true,
    min: 0,
  })
  page!: number

  @ValidateNumber({
    description: '每页数量',
    example: 20,
    required: true,
    min: 1,
  })
  pageSize!: number
}
