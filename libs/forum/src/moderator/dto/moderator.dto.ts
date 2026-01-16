import {
  ValidateArray,
  ValidateBoolean,
  ValidateEnum,
  ValidateNumber,
  ValidateString,
} from '@libs/base/decorators'
import {
  BaseDto,
  IdDto,
  OMIT_BASE_FIELDS,
  PageDto,
  UserIdDto,
} from '@libs/base/dto'
import {
  ApiProperty,
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
import {
  ForumModeratorPermissionEnum,
  ForumModeratorRoleTypeEnum,
} from '../moderator.constant'

/**
 * 版主模块数据传输对象
 * 包含版主管理、板块分配、操作日志等相关 DTO
 */

/**
 * 版主基础数据传输对象
 * 定义版主的基本属性，包括用户ID、角色类型、权限列表等
 * 其他版主相关的DTO可以继承此类
 */
export class BaseForumModeratorDto extends IntersectionType(
  BaseDto,
  UserIdDto,
) {
  @ValidateEnum({
    description: '版主角色类型',
    example: ForumModeratorRoleTypeEnum.SUPER,
    required: true,
    enum: ForumModeratorRoleTypeEnum,
  })
  roleType!: ForumModeratorRoleTypeEnum

  @ValidateArray({
    description: '权限列表',
    itemType: 'number',
    example: [1, 2, 3, 4, 5, 6],
    required: true,
  })
  permissions!: ForumModeratorPermissionEnum[]

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
    maxLength: 500,
  })
  remark?: string
}

/**
 * 创建版主数据传输对象
 * 用于创建新版主时的请求参数
 */
export class CreateForumModeratorDto extends OmitType(
  BaseForumModeratorDto,
  OMIT_BASE_FIELDS,
) {
  @ValidateArray({
    description: '板块ID列表',
    itemType: 'number',
    example: [1, 2, 3],
    required: true,
  })
  sectionIds!: number[]
}

/**
 * 更新版主数据传输对象
 * 用于更新版主信息时的请求参数，需要包含版主ID
 */
export class UpdateForumModeratorDto extends IntersectionType(
  CreateForumModeratorDto,
  IdDto,
) {}

/**
 * 分配板块数据传输对象
 * 用于将板块分配给版主，并设置权限继承和自定义权限
 */
export class AssignForumModeratorSectionDto extends PickType(
  CreateForumModeratorDto,
  ['permissions', 'sectionIds'],
) {
  @ValidateNumber({
    description: '版主ID',
    example: 1,
    required: true,
    min: 1,
  })
  moderatorId!: number
}

/**
 * 查询版主数据传输对象
 * 用于分页查询版主列表，支持按用户ID、用户名、板块ID等条件筛选
 */
export class QueryForumModeratorDto extends IntersectionType(
  PageDto,
  PartialType(PickType(BaseForumModeratorDto, ['isEnabled', 'profileId'])),
) {
  @ValidateString({
    description: '用户名',
    example: 'zhangsan',
    required: false,
  })
  nickname?: string

  @ValidateNumber({
    description: '板块ID',
    example: 1,
    required: false,
    min: 1,
  })
  sectionId?: number
}

/**
 * 查询版主操作日志数据传输对象
 * 用于分页查询版主的操作日志，支持按版主ID、操作类型、目标类型和时间范围筛选
 */
export class QueryForumModeratorActionLogDto extends IntersectionType(
  PageDto,
  PartialType(PickType(AssignForumModeratorSectionDto, ['moderatorId'])),
) {
  @ValidateNumber({
    description:
      '操作类型（1=置顶主题, 2=取消置顶, 3=加精主题, 4=取消加精, 5=锁定主题, 6=解锁主题, 7=删除主题, 8=移动主题, 9=审核主题, 10=删除回复）',
    example: 1,
    required: false,
    min: 1,
  })
  actionType?: number

  @ValidateNumber({
    description: '目标类型（1=主题, 2=回复）',
    example: 1,
    required: false,
    min: 1,
  })
  targetType?: number
}

/**
 * 版主响应数据传输对象
 * 用于返回版主详细信息，包含用户基本信息、权限列表和管理的板块列表
 */
export class ForumModeratorDto extends BaseForumModeratorDto {
  @ValidateNumber({
    description: '用户ID',
    example: 1,
    required: true,
    min: 1,
  })
  userId!: number

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
    example: [1, 2, 4, 8, 16, 32],
    required: true,
  })
  permissions!: ForumModeratorPermissionEnum[]

  @ValidateArray({
    description: '权限名称列表',
    itemType: 'string',
    example: ['置顶', '加精', '锁定', '删除', '审核', '移动'],
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
    maxLength: 500,
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
    inheritFromParent: boolean
    customPermissions: ForumModeratorPermissionEnum[]
    finalPermissions: ForumModeratorPermissionEnum[]
  }>
}

/**
 * 版主分页响应数据传输对象
 * 用于返回分页的版主列表数据
 */
export class ForumModeratorPageDto {
  @ApiProperty({ description: '版主列表', type: [ForumModeratorDto] })
  list!: ForumModeratorDto[]

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

/**
 * 版主操作日志数据传输对象
 * 用于记录版主的操作行为，包括操作类型、目标信息和操作时间等
 */
export class ForumModeratorActionLogDto {
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

  @ValidateNumber({
    description:
      '操作类型（1=置顶主题, 2=取消置顶, 3=加精主题, 4=取消加精, 5=锁定主题, 6=解锁主题, 7=删除主题, 8=移动主题, 9=审核主题, 10=删除回复）',
    example: 1,
    required: true,
    min: 1,
  })
  actionType!: number

  @ValidateString({
    description: '操作描述',
    example: '置顶主题',
    required: true,
    maxLength: 200,
  })
  actionDescription!: string

  @ValidateNumber({
    description: '目标类型（1=主题, 2=回复）',
    example: 1,
    required: true,
    min: 1,
  })
  targetType!: number

  @ValidateNumber({
    description: '目标ID',
    example: 1,
    required: true,
    min: 1,
  })
  targetId!: number

  @ValidateString({
    description: '操作前数据（JSON格式）',
    example: '{}',
    required: false,
  })
  beforeData?: string

  @ValidateString({
    description: '操作后数据（JSON格式）',
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

/**
 * 版主操作日志分页响应数据传输对象
 * 用于返回分页的版主操作日志列表数据
 */
export class ModeratorActionLogPageDto {
  @ApiProperty({
    description: '操作日志列表',
    type: [ForumModeratorActionLogDto],
  })
  list!: ForumModeratorActionLogDto[]

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
