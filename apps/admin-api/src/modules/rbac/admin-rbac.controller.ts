import { AuditActionTypeEnum } from '@libs/observability/audit/audit-action.constant'
import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/platform/decorators'
import { IdDto, UpdateEnabledStatusDto } from '@libs/platform/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AdminPermission } from '../../common/decorators/admin-permission.decorator'
import { ApiAuditDoc } from '../../common/decorators/api-audit-doc.decorator'
import { AdminRbacService } from './admin-rbac.service'
import {
  AdminMenuCreateDto,
  AdminMenuDragReorderDto,
  AdminMenuDto,
  AdminMenuUpdateDto,
  AdminPermissionDto,
  AdminRbacBootstrapDto,
  AdminRoleCreateDto,
  AdminRoleDetailDto,
  AdminRoleDto,
  AdminRoleMenuBindDto,
  AdminRolePageDto,
  AdminRolePermissionBindDto,
  AdminRoleUpdateDto,
} from './dto/admin-rbac.dto'

@ApiTags('系统管理/RBAC')
@Controller('admin/rbac')
export class AdminRbacController {
  constructor(private readonly rbacService: AdminRbacService) {}

  @Get('bootstrap')
  @AdminPermission({
    code: 'system:menu:current',
    name: '获取当前菜单权限',
    groupCode: 'system:menu',
  })
  @ApiDoc({
    summary: '获取当前管理员菜单与权限',
    model: AdminRbacBootstrapDto,
  })
  // 返回当前管理员可访问的菜单树和权限码集合。
  async bootstrap(@CurrentUser('sub') adminUserId: number) {
    return this.rbacService.getCurrentBootstrap(adminUserId)
  }

  @Get('role/page')
  @AdminPermission({
    code: 'system:role:page',
    name: '分页查询角色',
    groupCode: 'system:role',
  })
  @ApiPageDoc({
    summary: '分页查询角色',
    model: AdminRoleDto,
  })
  // 按后台角色管理权限分页查询角色。
  async pageRoles(@Query() query: AdminRolePageDto) {
    return this.rbacService.pageRoles(query)
  }

  @Get('role/list')
  @AdminPermission({
    code: 'system:role:list',
    name: '查询角色列表',
    groupCode: 'system:role',
  })
  @ApiDoc({
    summary: '查询角色列表',
    model: AdminRoleDto,
    isArray: true,
  })
  // 查询可用于授权配置的角色列表。
  async listRoles() {
    return this.rbacService.listRoles()
  }

  @Get('role/detail')
  @AdminPermission({
    code: 'system:role:detail',
    name: '查询角色详情',
    groupCode: 'system:role',
  })
  @ApiDoc({
    summary: '查询角色详情',
    model: AdminRoleDetailDto,
  })
  // 查询指定角色的基础信息与已绑定权限、菜单。
  async roleDetail(@Query() query: IdDto) {
    return this.rbacService.getRoleDetail(query.id)
  }

  @Post('role/create')
  @AdminPermission({
    code: 'system:role:create',
    name: '创建角色',
    groupCode: 'system:role',
  })
  @ApiAuditDoc({
    summary: '创建角色',
    model: Boolean,
    audit: { actionType: AuditActionTypeEnum.CREATE },
  })
  // 在系统角色管理边界内创建后台角色。
  async createRole(@Body() body: AdminRoleCreateDto) {
    return this.rbacService.createRole(body)
  }

  @Post('role/update')
  @AdminPermission({
    code: 'system:role:update',
    name: '更新角色',
    groupCode: 'system:role',
  })
  @ApiAuditDoc({
    summary: '更新角色',
    model: Boolean,
    audit: { actionType: AuditActionTypeEnum.UPDATE },
  })
  // 更新指定后台角色的可维护基础信息。
  async updateRole(@Body() body: AdminRoleUpdateDto) {
    return this.rbacService.updateRole(body)
  }

  @Post('role/delete')
  @AdminPermission({
    code: 'system:role:delete',
    name: '删除角色',
    groupCode: 'system:role',
  })
  @ApiAuditDoc({
    summary: '删除角色',
    model: Boolean,
    audit: { actionType: AuditActionTypeEnum.DELETE },
  })
  // 删除指定非内置后台角色并清理其授权关系。
  async deleteRole(@Body() body: IdDto) {
    return this.rbacService.deleteRole(body.id)
  }

  @Post('role/update-status')
  @AdminPermission({
    code: 'system:role:update-status',
    name: '更新角色状态',
    groupCode: 'system:role',
  })
  @ApiAuditDoc({
    summary: '更新角色状态',
    model: Boolean,
    audit: { actionType: AuditActionTypeEnum.UPDATE },
  })
  // 启用或停用指定后台角色。
  async updateRoleStatus(@Body() body: UpdateEnabledStatusDto) {
    return this.rbacService.updateRoleStatus(body.id, body.isEnabled)
  }

  @Post('role/bind-permissions')
  @AdminPermission({
    code: 'system:role:bind-permissions',
    name: '绑定角色权限',
    groupCode: 'system:role',
  })
  @ApiAuditDoc({
    summary: '绑定角色权限',
    model: Boolean,
    audit: { actionType: AuditActionTypeEnum.UPDATE },
  })
  // 重置指定角色可使用的后台权限码集合。
  async bindRolePermissions(@Body() body: AdminRolePermissionBindDto) {
    return this.rbacService.bindRolePermissions(body)
  }

  @Post('role/bind-menus')
  @AdminPermission({
    code: 'system:role:bind-menus',
    name: '绑定角色菜单',
    groupCode: 'system:role',
  })
  @ApiAuditDoc({
    summary: '绑定角色菜单',
    model: Boolean,
    audit: { actionType: AuditActionTypeEnum.UPDATE },
  })
  // 重置指定角色可访问的后台菜单集合。
  async bindRoleMenus(@Body() body: AdminRoleMenuBindDto) {
    return this.rbacService.bindRoleMenus(body)
  }

  @Get('permission/list')
  @AdminPermission({
    code: 'system:permission:list',
    name: '查询权限清单',
    groupCode: 'system:permission',
  })
  @ApiDoc({
    summary: '查询权限清单',
    model: AdminPermissionDto,
    isArray: true,
  })
  // 查询后台已注册的权限清单供角色授权使用。
  async listPermissions() {
    return this.rbacService.listPermissions()
  }

  @Get('menu/tree')
  @AdminPermission({
    code: 'system:menu:tree',
    name: '查询菜单树',
    groupCode: 'system:menu',
  })
  @ApiDoc({
    summary: '查询菜单树',
    model: AdminMenuDto,
    isArray: true,
  })
  // 查询后台菜单树供菜单管理和授权配置使用。
  async menuTree() {
    return this.rbacService.menuTree()
  }

  @Post('menu/create')
  @AdminPermission({
    code: 'system:menu:create',
    name: '创建菜单',
    groupCode: 'system:menu',
  })
  @ApiAuditDoc({
    summary: '创建菜单',
    model: Boolean,
    audit: { actionType: AuditActionTypeEnum.CREATE },
  })
  // 在系统菜单管理边界内创建后台菜单节点。
  async createMenu(@Body() body: AdminMenuCreateDto) {
    return this.rbacService.createMenu(body)
  }

  @Post('menu/update')
  @AdminPermission({
    code: 'system:menu:update',
    name: '更新菜单',
    groupCode: 'system:menu',
  })
  @ApiAuditDoc({
    summary: '更新菜单',
    model: Boolean,
    audit: { actionType: AuditActionTypeEnum.UPDATE },
  })
  // 更新指定后台菜单节点的配置。
  async updateMenu(@Body() body: AdminMenuUpdateDto) {
    return this.rbacService.updateMenu(body)
  }

  @Post('menu/delete')
  @AdminPermission({
    code: 'system:menu:delete',
    name: '删除菜单',
    groupCode: 'system:menu',
  })
  @ApiAuditDoc({
    summary: '删除菜单',
    model: Boolean,
    audit: { actionType: AuditActionTypeEnum.DELETE },
  })
  // 删除无子节点的后台菜单并清理角色菜单绑定。
  async deleteMenu(@Body() body: IdDto) {
    return this.rbacService.deleteMenu(body.id)
  }

  @Post('menu/update-status')
  @AdminPermission({
    code: 'system:menu:update-status',
    name: '更新菜单状态',
    groupCode: 'system:menu',
  })
  @ApiAuditDoc({
    summary: '更新菜单状态',
    model: Boolean,
    audit: { actionType: AuditActionTypeEnum.UPDATE },
  })
  // 启用或停用指定后台菜单节点。
  async updateMenuStatus(@Body() body: UpdateEnabledStatusDto) {
    return this.rbacService.updateMenuStatus(body.id, body.isEnabled)
  }

  @Post('menu/drag-reorder')
  @AdminPermission({
    code: 'system:menu:drag-reorder',
    name: '拖拽调整菜单',
    groupCode: 'system:menu',
  })
  @ApiAuditDoc({
    summary: '拖拽调整菜单',
    model: Boolean,
    audit: { actionType: AuditActionTypeEnum.UPDATE },
  })
  // 按拖拽结果调整后台菜单节点的父级与排序。
  async dragReorderMenu(@Body() body: AdminMenuDragReorderDto) {
    return this.rbacService.dragReorderMenu(body)
  }
}
