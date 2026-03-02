import { UserBadgeModule } from '@libs/user/badge'
import { UserLevelRuleModule } from '@libs/user/level-rule'
import { UserPointModule } from '@libs/user/point'
import { Module } from '@nestjs/common'
import { UserController } from './user.controller'
import { UserService } from './user.service'

@Module({
  imports: [UserLevelRuleModule, UserBadgeModule, UserPointModule],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
