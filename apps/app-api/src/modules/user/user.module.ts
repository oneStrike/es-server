import { UserBadgeModule } from '@libs/user/badge'
import { UserBalanceModule } from '@libs/user/balance'
import { UserLevelRuleModule } from '@libs/user/level-rule'
import { UserPointModule } from '@libs/user/point'
import { Module } from '@nestjs/common'
import { UserController } from './user.controller'
import { UserService } from './user.service'

@Module({
  imports: [UserLevelRuleModule, UserBadgeModule, UserBalanceModule, UserPointModule],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
