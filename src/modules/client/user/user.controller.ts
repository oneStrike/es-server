import { Controller, Get } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '@/common/decorators/current-user.decorator'
import { ClientUserService } from '@/modules/client/user/user.service'

@ApiTags('客户端用户模块')
@Controller('client/user')
export class ClientUserController {
  constructor(private readonly userService: ClientUserService) {}

  @Get('getClientUserPage')
  async getUsers(@CurrentUser() user) {
    return user
  }
}
