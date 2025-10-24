import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ApiDoc, ApiPageDoc } from '@/common/decorators/api-doc.decorator'
import { CurrentUser } from '@/common/decorators/current-user.decorator'
import { Public } from '@/common/decorators/public.decorator'
import { IdDto } from '@/common/dto/id.dto'
import {
  UpdateUserDto,
  UserDto,
  UserPageDto,
  UserRegisterDto,
} from '@/modules/admin/user/dto/user.dto'
import { AdminUserService } from '@/modules/admin/user/user.service'

/**
 * 管理端用户控制器
 * 提供用户管理相关的 RESTful API 接口
 */
@ApiTags('管理端用户模块')
@Controller('admin/user')
export class AdminUserController {
  constructor(private readonly userService: AdminUserService) {}

  /**
   * 用户注册接口
   */
  @Post('register')
  @ApiDoc({
    summary: '用户注册',
    model: IdDto,
  })
  @Public()
  async register(@Body() body: UserRegisterDto) {
    return this.userService.register(body)
  }

  /**
   * 更新用户信息接口
   * 根据当前用户身份更新其基本信息（如昵称、头像等）
   * @param body 包含要更新的用户信息的对象
   * @param user 当前登录用户的身份信息
   * @returns 更新后的用户信息
   */
  @Post('update-info')
  @ApiDoc({
    summary: '更新用户信息',
    model: UserDto,
  })
  async updateUserInfo(@Body() body: UpdateUserDto, @CurrentUser() user) {
    return this.userService.updateUserInfo(Number.parseInt(user.sub), body)
  }

  /**
   * 获取当前用户信息接口
   * 返回当前登录用户的详细信息
   * @param user 当前登录用户的身份信息
   * @returns 当前用户的完整信息
   */
  @Get('info')
  @ApiDoc({
    summary: '获取当前用户信息',
    model: UserDto,
  })
  async getUserInfo(@CurrentUser() user) {
    return this.userService.getUserInfo(Number.parseInt(user.sub))
  }

  /**
   * 根据ID获取用户信息接口
   * 返回指定ID的用户详细信息
   * @param query 包含用户ID的查询参数对象
   * @returns 指定ID的用户完整信息
   */
  @Get('info-by-id')
  @ApiDoc({
    summary: '根据ID获取用户信息',
    model: UserDto,
  })
  async getUserById(@Query() query: IdDto) {
    return this.userService.getUserInfo(query.id)
  }

  /**
   * 获取管理端用户分页列表接口
   */
  @Get('page')
  @ApiPageDoc({
    summary: '获取管理端用户分页列表',
    model: UserDto,
  })
  async getUsers(@Query() query: UserPageDto) {
    return this.userService.getUsers(query)
  }

  /**
   * 删除用户接口
   */
  @Post('delete')
  @ApiDoc({
    summary: '删除用户',
    model: IdDto,
  })
  async deleteUser(@Body() query: IdDto) {
    return this.userService.adminUser.delete({ where: { id: query.id } })
  }
}
