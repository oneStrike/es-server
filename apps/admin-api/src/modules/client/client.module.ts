import { Module } from '@nestjs/common'
import { ClientAuthModule } from './auth/auth.module'
import { ClientUserModule } from './user/user.module'

@Module({
  imports: [ClientAuthModule, ClientUserModule],
  controllers: [],
})
export class ClientModule {}
