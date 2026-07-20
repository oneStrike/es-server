import {
  ArrayProperty,
  BooleanProperty,
  DateProperty,
  EnumProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseDto, IdDto, PageDto } from '@libs/platform/dto'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'
import { AdminMenuType, AdminPermissionSource } from '../admin-rbac.constant'

/**
 * 管理端角色摘要 DTO。
 */
export class AdminRoleSummaryDto {
  @NumberProperty({
    description: '角色id',
    example: 1,
    required: true,
    validation: false,
  })
  id!: number

  @StringProperty({
    description: '角色编码',
    example: 'super_admin',
    required: true,
    validation: false,
  })
  code!: string

  @StringProperty({
    description: '角色名称',
    example: '超级管理员',
    required: true,
    validation: false,
  })
  name!: string

  @BooleanProperty({
    description: '是否系统内置角色',
    example: true,
    required: true,
    validation: false,
  })
  isSystem!: boolean

  @BooleanProperty({
    description: '是否启用',
    example: true,
    required: true,
    validation: false,
  })
  isEnabled!: boolean
}

/**
 * 管理端角色 DTO。
 */
export class AdminRoleDto extends BaseDto {
  @StringProperty({
    description: '角色编码',
    example: 'content_operator',
    required: true,
    maxLength: 80,
  })
  code!: string

  @StringProperty({
    description: '角色名称',
    example: '内容运营',
    required: true,
    maxLength: 80,
  })
  name!: string

  @StringProperty({
    description: '角色说明',
    example: '负责内容配置与审核',
    required: true,
    nullable: true,
    maxLength: 300,
  })
  description!: string | null

  @BooleanProperty({
    description: '是否系统内置角色',
    example: false,
    required: true,
    validation: false,
  })
  isSystem!: boolean

  @BooleanProperty({
    description: '是否启用',
    example: true,
    required: true,
  })
  isEnabled!: boolean

  @NumberProperty({
    description: '排序值',
    example: 10,
    required: true,
  })
  sortOrder!: number
}

/**
 * 管理端角色详情 DTO。
 */
export class AdminRoleDetailDto extends AdminRoleDto {
  @ArrayProperty({
    description: '权限id集合',
    itemType: 'number',
    example: [1, 2],
    required: true,
    validation: false,
  })
  permissionIds!: number[]

  @ArrayProperty({
    description: '菜单id集合',
    itemType: 'number',
    example: [1, 2],
    required: true,
    validation: false,
  })
  menuIds!: number[]
}

/**
 * 创建角色必填字段块。
 */
class AdminRoleCreateRequiredFieldsDto extends PickType(AdminRoleDto, [
  'code',
  'name',
] as const) {}

/**
 * 创建角色可选字段块。
 */
class AdminRoleCreateOptionalFieldsDto extends PartialType(
  PickType(AdminRoleDto, ['description', 'isEnabled', 'sortOrder'] as const),
) {}

/**
 * 创建管理端角色 DTO。
 */
export class AdminRoleCreateDto extends IntersectionType(
  AdminRoleCreateRequiredFieldsDto,
  AdminRoleCreateOptionalFieldsDto,
) {}

/**
 * 更新管理端角色 DTO。
 */
export class AdminRoleUpdateDto extends IntersectionType(
  IdDto,
  PartialType(
    PickType(AdminRoleDto, ['name', 'description', 'sortOrder'] as const),
  ),
) {}

/**
 * 管理端角色分页 DTO。
 */
export class AdminRolePageDto extends IntersectionType(
  PartialType(PickType(AdminRoleDto, ['code', 'name', 'isEnabled'] as const)),
  PageDto,
) {}

/**
 * 角色绑定权限 DTO。
 */
export class AdminRolePermissionBindDto extends IdDto {
  @ArrayProperty({
    description: '权限id集合',
    itemType: 'number',
    example: [1, 2],
    required: true,
  })
  permissionIds!: number[]
}

/**
 * 角色绑定菜单 DTO。
 */
export class AdminRoleMenuBindDto extends IdDto {
  @ArrayProperty({
    description: '菜单id集合',
    itemType: 'number',
    example: [1, 2],
    required: true,
  })
  menuIds!: number[]
}

/**
 * 管理端权限 DTO。
 */
export class AdminPermissionDto extends BaseDto {
  @StringProperty({
    description: '权限编码',
    example: 'system:user:create',
    required: true,
    validation: false,
  })
  code!: string

  @StringProperty({
    description: '权限名称',
    example: '创建管理员账号',
    required: true,
    validation: false,
  })
  name!: string

  @StringProperty({
    description: '权限分组编码',
    example: 'system:user',
    required: true,
    validation: false,
  })
  groupCode!: string

  @StringProperty({
    description: '权限说明',
    example: '允许创建管理端账号',
    required: true,
    nullable: true,
    validation: false,
  })
  description!: string | null

  @EnumProperty({
    description: '权限来源（1=后端接口装饰器同步）',
    enum: AdminPermissionSource,
    example: AdminPermissionSource.API,
    required: true,
    validation: false,
  })
  source!: AdminPermissionSource

  @BooleanProperty({
    description: '是否启用',
    example: true,
    required: true,
    validation: false,
  })
  isEnabled!: boolean
}

/**
 * 管理端菜单 DTO。
 */
export class AdminMenuDto extends BaseDto {
  @StringProperty({
    description: '菜单编码',
    example: 'system_accounts',
    required: true,
    maxLength: 120,
  })
  code!: string

  @NumberProperty({
    description: '父级菜单id',
    example: 1,
    required: true,
    nullable: true,
  })
  parentId!: number | null

  @EnumProperty({
    description: '菜单类型（1=目录；2=菜单）',
    enum: AdminMenuType,
    example: AdminMenuType.MENU,
    required: true,
  })
  type!: AdminMenuType

  @StringProperty({
    description: '菜单标题',
    example: '账号管理',
    required: true,
    maxLength: 80,
  })
  title!: string

  @StringProperty({
    description: '路由路径',
    example: '/system-manager/accounts',
    required: true,
    maxLength: 200,
  })
  path!: string

  @StringProperty({
    description: '路由名称',
    example: 'SystemAccountManager',
    required: true,
    nullable: true,
    maxLength: 120,
  })
  name!: string | null

  @StringProperty({
    description: '前端组件键',
    example: '/system-manager/account-manager/index',
    required: true,
    nullable: true,
    maxLength: 240,
  })
  component!: string | null

  @StringProperty({
    description: '重定向路径',
    example: '/system-manager/profile',
    required: true,
    nullable: true,
    maxLength: 200,
  })
  redirect!: string | null

  @StringProperty({
    description: '图标',
    example: 'lucide:settings',
    required: true,
    nullable: true,
    maxLength: 80,
  })
  icon!: string | null

  @NumberProperty({
    description: '排序值',
    example: 10,
    required: true,
  })
  sortOrder!: number

  @BooleanProperty({
    description: '是否显示',
    example: true,
    required: true,
  })
  isVisible!: boolean

  @BooleanProperty({
    description: '是否启用',
    example: true,
    required: true,
  })
  isEnabled!: boolean

  @BooleanProperty({
    description: '是否缓存页面',
    example: false,
    required: true,
  })
  keepAlive!: boolean

  @StringProperty({
    description: '外链地址',
    example: 'https://example.com',
    required: true,
    nullable: true,
    maxLength: 300,
  })
  externalLink!: string | null

  @ArrayProperty({
    description: '子菜单',
    itemClass: AdminMenuDto,
    required: true,
    validation: false,
  })
  children!: AdminMenuDto[]
}

/**
 * 创建菜单必填字段块。
 */
class AdminMenuCreateRequiredFieldsDto extends PickType(AdminMenuDto, [
  'code',
  'type',
  'title',
  'path',
] as const) {}

/**
 * 创建菜单可选字段块。
 */
class AdminMenuCreateOptionalFieldsDto extends PartialType(
  PickType(AdminMenuDto, [
    'parentId',
    'name',
    'component',
    'redirect',
    'icon',
    'sortOrder',
    'isVisible',
    'isEnabled',
    'keepAlive',
    'externalLink',
  ] as const),
) {}

/**
 * 创建管理端菜单 DTO。
 */
export class AdminMenuCreateDto extends IntersectionType(
  AdminMenuCreateRequiredFieldsDto,
  AdminMenuCreateOptionalFieldsDto,
) {}

/**
 * 更新管理端菜单 DTO。
 */
export class AdminMenuUpdateDto extends IntersectionType(
  IdDto,
  PartialType(AdminMenuCreateDto),
) {}

/**
 * 拖拽调整菜单顺序 DTO。
 */
export class AdminMenuDragReorderDto extends IdDto {
  @NumberProperty({
    description: '目标父级菜单id',
    example: 1,
    required: false,
    nullable: true,
  })
  parentId?: number | null

  @NumberProperty({
    description: '新的排序值',
    example: 10,
    required: true,
  })
  sortOrder!: number
}

/**
 * 当前登录管理员菜单 DTO。
 */
export class AdminCurrentMenuDto {
  @NumberProperty({
    description: '菜单id',
    example: 1,
    required: true,
    validation: false,
  })
  id!: number

  @StringProperty({
    description: '菜单编码',
    example: 'system_accounts',
    required: true,
    validation: false,
  })
  code!: string

  @StringProperty({
    description: '菜单标题',
    example: '账号管理',
    required: true,
    validation: false,
  })
  title!: string

  @StringProperty({
    description: '路由路径',
    example: '/system-manager/accounts',
    required: true,
    validation: false,
  })
  path!: string

  @NumberProperty({
    description: '父级菜单id',
    example: 1,
    required: true,
    nullable: true,
    validation: false,
  })
  parentId!: number | null

  @StringProperty({
    description: '路由名称',
    example: 'SystemAccountManager',
    required: true,
    nullable: true,
    validation: false,
  })
  name!: string | null

  @StringProperty({
    description: '前端组件键',
    example: '/system-manager/account-manager/index',
    required: true,
    nullable: true,
    validation: false,
  })
  component!: string | null

  @StringProperty({
    description: '重定向路径',
    example: '/system-manager/profile',
    required: true,
    nullable: true,
    validation: false,
  })
  redirect!: string | null

  @StringProperty({
    description: '图标',
    example: 'lucide:settings',
    required: true,
    nullable: true,
    validation: false,
  })
  icon!: string | null

  @NumberProperty({
    description: '排序值',
    example: 10,
    required: true,
    validation: false,
  })
  sortOrder!: number

  @BooleanProperty({
    description: '是否显示',
    example: true,
    required: true,
    validation: false,
  })
  isVisible!: boolean

  @BooleanProperty({
    description: '是否缓存页面',
    example: false,
    required: true,
    validation: false,
  })
  keepAlive!: boolean

  @ArrayProperty({
    description: '子菜单',
    itemClass: AdminCurrentMenuDto,
    required: true,
    validation: false,
  })
  children!: AdminCurrentMenuDto[]
}

/**
 * 当前登录管理员 RBAC 引导信息 DTO。
 */
export class AdminRbacBootstrapDto {
  @ArrayProperty({
    description: '角色编码列表',
    itemType: 'string',
    example: ['super_admin'],
    required: true,
    validation: false,
  })
  roleCodes!: string[]

  @BooleanProperty({
    description: '是否超级管理员',
    example: true,
    required: true,
    validation: false,
  })
  isSuperAdmin!: boolean

  @ArrayProperty({
    description: '权限编码列表',
    itemType: 'string',
    example: ['system:user:create'],
    required: true,
    validation: false,
  })
  accessCodes!: string[]

  @ArrayProperty({
    description: '菜单树',
    itemClass: AdminCurrentMenuDto,
    required: true,
    validation: false,
  })
  menus!: AdminCurrentMenuDto[]

  @NumberProperty({
    description: 'RBAC 权限版本',
    example: 1,
    required: true,
    validation: false,
  })
  revision!: number

  @DateProperty({
    description: '快照过期时间',
    example: '2024-01-01T00:00:00.000Z',
    required: true,
    validation: false,
  })
  expiresAt!: Date
}
