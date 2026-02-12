import type { JwtUserInfoInterface } from '@libs/base/types'
import { ApiDoc, CurrentUser } from '@libs/base/decorators'
import { UserGrowthOverviewDto } from '@libs/user/growth-overview'
import { Controller, Get } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { BaseAppUserDto } from '../auth/dto/auth.dto'
import { UserService } from './user.service'

@ApiTags('用户模块')
@Controller('app/user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('profile')
  @ApiDoc({
    summary: '获取用户信息',
    model: BaseAppUserDto,
  })
  async getProfile(@CurrentUser() user: JwtUserInfoInterface) {
    return this.userService.getUserProfile(user.sub)
  }

  @Get('growth/overview')
  @ApiDoc({
    summary: '获取成长概览',
    model: UserGrowthOverviewDto,
  })
  async getGrowthOverview(@CurrentUser() user: JwtUserInfoInterface) {
    return this.userService.getUserGrowthOverview(user.sub)
  }
}
