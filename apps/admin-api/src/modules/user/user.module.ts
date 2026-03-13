import { CryptoModule } from '@libs/platform/modules'
import { Module } from '@nestjs/common'
import { UserController } from './user.controller'
import { UserService } from './user.service'

@Module({
  imports: [CryptoModule],
  controllers: [UserController],
  providers: [UserService],
  exports: [],
})
export class UserModule {}
