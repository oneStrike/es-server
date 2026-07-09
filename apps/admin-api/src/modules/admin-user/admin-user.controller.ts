import {
  AdminAccountUpdateDto,
  AdminCurrentUserDto,
  AdminSelfProfileUpdateDto,
  AdminUserDetailDto,
  AdminUserListItemDto,
  ChangePasswordDto,
  ResetAdminUserPasswordResultDto,
  UserPageDto,
  UserRegisterDto,
} from '@libs/identity/dto/admin-user.dto'
import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/platform/decorators'

import { IdDto } from '@libs/platform/dto'
import { AuditActionTypeEnum } from '@libs/platform/modules/audit/audit-action.constant'
import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AdminPermission } from '../../common/decorators/admin-permission.decorator'
import { ApiAuditDoc } from '../../common/decorators/api-audit-doc.decorator'
import { AdminSelfProfileLegacyFieldsGuard } from './admin-self-profile-legacy-fields.guard'
import { AdminUserService } from './admin-user.service'

/**
 * 管理端用户控制器。
 * 提供管理员账号的注册、查询、密码管理与解锁接口。
 */
@ApiTags('认证与账号/管理员账号')
@Controller('admin/system-user')
export class AdminUserController {
  constructor(private readonly adminUserService: AdminUserService) {}

  // 注册新管理员账号。
  @Post('create')
  @AdminPermission({
    code: 'system:user:create',
    name: '用户注册',
    groupCode: 'system:user',
  })
  @ApiAuditDoc({
    summary: '用户注册',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.CREATE,
    },
  })
  async register(
    @Body() body: UserRegisterDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.adminUserService.register(userId, body)
  }

  // 更新当前登录管理员资料。
  @Post('profile/update')
  @UseGuards(AdminSelfProfileLegacyFieldsGuard)
  @AdminPermission({
    code: 'system:user:profile:update',
    name: '更新当前用户资料',
    groupCode: 'system:user',
  })
  @ApiAuditDoc({
    summary: '更新当前用户资料',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async updateSelfProfile(
    @Body() body: AdminSelfProfileUpdateDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.adminUserService.updateSelfProfile(userId, body)
  }

  // 更新指定管理员账号信息与角色。
  @Post('update')
  @AdminPermission({
    code: 'system:user:update',
    name: '更新管理员账号',
    groupCode: 'system:user',
  })
  @ApiAuditDoc({
    summary: '更新管理员账号',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async updateAdminAccount(
    @Body() body: AdminAccountUpdateDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.adminUserService.updateAdminAccount(userId, body)
  }

  // 获取当前登录管理员信息。
  @Get('profile')
  @AdminPermission({
    code: 'system:user:profile',
    name: '获取当前用户信息',
    groupCode: 'system:user',
  })
  @ApiDoc({
    summary: '获取当前用户信息',
    model: AdminCurrentUserDto,
  })
  async getUserInfo(@CurrentUser('sub') userId: number) {
    return this.adminUserService.getCurrentUserInfo(userId)
  }

  // 按 ID 获取管理员用户信息。
  @Get('detail')
  @AdminPermission({
    code: 'system:user:detail',
    name: '根据ID获取用户信息',
    groupCode: 'system:user',
  })
  @ApiDoc({
    summary: '根据ID获取用户信息',
    model: AdminUserDetailDto,
  })
  async getUserById(@Query() query: IdDto) {
    return this.adminUserService.getUserDetail(query.id)
  }

  // 分页查询管理员用户列表。
  @Get('page')
  @AdminPermission({
    code: 'system:user:page',
    name: '获取管理端用户分页列表',
    groupCode: 'system:user',
  })
  @ApiPageDoc({
    summary: '获取管理端用户分页列表',
    model: AdminUserListItemDto,
  })
  async getUsers(@Query() query: UserPageDto) {
    return this.adminUserService.getUsers(query)
  }

  // 修改当前管理员密码。
  @Post('password/change')
  @AdminPermission({
    code: 'system:user:password:change',
    name: '修改密码',
    groupCode: 'system:user',
  })
  @ApiAuditDoc({
    summary: '修改密码',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
      content: '用户修改账户密码',
    },
  })
  async changePassword(
    @Body() body: ChangePasswordDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.adminUserService.changePassword(userId, body)
  }

  // 重置指定管理员密码为临时密码。
  @Post('password/reset')
  @AdminPermission({
    code: 'system:user:password:reset',
    name: '重置用户密码',
    groupCode: 'system:user',
  })
  @ApiAuditDoc({
    summary: '重置用户密码',
    model: ResetAdminUserPasswordResultDto,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async resetPassword(
    @Body() query: IdDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.adminUserService.resetPassword(userId, query.id)
  }

  // 解锁指定管理员的登录锁定状态。
  @Post('unlock')
  @AdminPermission({
    code: 'system:user:unlock',
    name: '解锁指定用户的锁定状态',
    groupCode: 'system:user',
  })
  @ApiAuditDoc({
    summary: '解锁指定用户的锁定状态',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async unlockUser(@Body() query: IdDto, @CurrentUser('sub') userId: number) {
    return this.adminUserService.unlockUser(userId, query.id)
  }
}
