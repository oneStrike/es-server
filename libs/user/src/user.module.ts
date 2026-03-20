import { DrizzleModule } from '@db/core'
import { Module } from '@nestjs/common'
import { AppUserCountService } from './app-user-count.service'
import { UserService } from './user.service'

@Module({
  imports: [DrizzleModule],
  providers: [AppUserCountService, UserService],
  exports: [AppUserCountService, UserService],
})
export class UserModule {}
