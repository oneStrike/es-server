import { AdminRbacService } from '@libs/identity/admin-rbac.service'
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
} from '@libs/identity/dto/admin-rbac.dto'
import { AuditActionTypeEnum } from '@libs/observability/audit/audit-action.constant'
import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/platform/decorators'
import { IdDto, UpdateEnabledStatusDto } from '@libs/platform/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AdminPermission } from '../../common/decorators/admin-permission.decorator'
import { ApiAuditDoc } from '../../common/decorators/api-audit-doc.decorator'

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
  async dragReorderMenu(@Body() body: AdminMenuDragReorderDto) {
    return this.rbacService.dragReorderMenu(body)
  }
}
