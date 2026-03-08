/**
 * 用户模块
 *
 * 该模块负责用户中心相关功能，包括：
 * - 用户基本信息管理
 * - 用户论坛资料管理
 * - 用户积分和经验值管理
 * - 用户徽章管理
 * - 用户资产统计
 */
import { MessageModule } from '@libs/message'
import {
  UserExperienceModule,
  UserPointModule,
} from '@libs/user'
import { Module } from '@nestjs/common'
import { UserController } from './user.controller'
import { UserService } from './user.service'

@Module({
  imports: [
    UserPointModule, // 用户积分模块
    UserExperienceModule, // 用户经验模块
    MessageModule, // 消息模块
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
