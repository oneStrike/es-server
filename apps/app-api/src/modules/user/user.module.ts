import { Module } from '@nestjs/common'
import { ProfileModule } from '@libs/forum/profile'
import { UserController } from './user.controller'
import { UserService } from './user.service'

@Module({
  imports: [ForumProfileModule],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
