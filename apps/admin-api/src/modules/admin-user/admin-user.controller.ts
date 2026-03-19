import type { JwtUserInfoInterface } from '@libs/platform/types'

import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/platform/decorators'
import { IdDto } from '@libs/platform/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Audit } from '../../common/decorators/audit.decorator'
import { AuditActionTypeEnum } from '../system/audit/audit.constant'
import { AdminUserService } from './admin-user.service'
import {
  BaseUserDto,
  ChangePasswordDto,
  UpdateUserDto,
  UserPageDto,
  UserRegisterDto,
} from './dto/admin-user.dto'

/**
 * 管理端用户控制器
 * 提供用户管理相关的 RESTful API 接口
 */
@ApiTags('认证与账号/管理员账号')
@Controller('admin/system-user')
export class AdminUserController {
  constructor(private readonly adminUserService: AdminUserService) {}

  /**
   * 用户注册接口
   */
  @Post('create')
  @ApiDoc({
    summary: '用户注册',
    model: Boolean,
  })
  async register(
    @Body() body: UserRegisterDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.adminUserService.register(user.sub, body)
  }

  /**
   * 更新用户信息接口
   */
  @Post('profile/update')
  @ApiDoc({
    summary: '更新用户信息',
    model: Boolean,
  })
  async updateUserInfo(
    @Body() body: UpdateUserDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.adminUserService.updateUserInfo(user.sub, body)
  }

  /**
   * 获取当前用户信息接口
   */
  @Get('profile')
  @ApiDoc({
    summary: '获取当前用户信息',
    model: BaseUserDto,
  })
  async getUserInfo(@CurrentUser() user: JwtUserInfoInterface) {
    return this.adminUserService.getUserInfo(user.sub)
  }

  /**
   * 根据ID获取用户信息接口
   */
  @Get('detail')
  @ApiDoc({
    summary: '根据ID获取用户信息',
    model: BaseUserDto,
  })
  async getUserById(@Query() query: IdDto) {
    return this.adminUserService.getUserInfo(query.id)
  }

  /**
   * 获取管理端用户分页列表接口
   */
  @Get('page')
  @ApiPageDoc({
    summary: '获取管理端用户分页列表',
    model: BaseUserDto,
  })
  async getUsers(@Query() query: UserPageDto) {
    return this.adminUserService.getUsers(query)
  }

  /**
   * 修改密码接口
   */
  @Post('password/change')
  @ApiDoc({
    summary: '修改密码',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.UPDATE,
    content: '用户修改账户密码',
  })
  async changePassword(
    @Body() body: ChangePasswordDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.adminUserService.changePassword(user.sub, body)
  }

  /*
   * 重置用户密码为默认密码接口
   */
  @Post('password/reset')
  @ApiDoc({
    summary: '重置用户密码为默认密码',
    model: Boolean,
  })
  async resetPassword(
    @Body() query: IdDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.adminUserService.resetPassword(user.sub, query.id)
  }

  /**
   * 解锁指定用户的锁定状态接口
   */
  @Post('unlock')
  @ApiDoc({
    summary: '解锁指定用户的锁定状态',
    model: Boolean,
  })
  async unlockUser(@Body() query: IdDto) {
    return this.adminUserService.unlockUser(query.id)
  }
}
