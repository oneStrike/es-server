import { CryptoModule } from '@libs/crypto'
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
