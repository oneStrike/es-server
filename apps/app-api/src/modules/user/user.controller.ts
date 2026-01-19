import { ApiDoc, CurrentUser } from '@libs/base/decorators'
import { JwtUserInfoInterface } from '@libs/base/types'
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
}
