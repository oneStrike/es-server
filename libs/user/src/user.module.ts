import { DrizzleModule } from '@db/core'
import { Module } from '@nestjs/common'
import { UserService } from './user.service'

@Module({
  imports: [DrizzleModule],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
