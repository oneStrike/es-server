import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ClientUserService } from '@/modules/client/users/user.service';

@ApiTags('客户端用户模块')
@Controller('client/user')
export class ClientUserController {
  constructor(private readonly userService: ClientUserService) {}

  @Get('getClientUserPage')
  getUsers() {
    return this.userService.getUsers();
  }
}
