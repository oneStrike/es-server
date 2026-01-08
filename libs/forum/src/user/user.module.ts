import { Module } from '@nestjs/common'
import { PointModule } from '../point/point.module'
import { UserService } from './user.service'

/**
 * 用户模块
 * 提供论坛用户管理的完整功能
 */
@Module({
  imports: [PointModule],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
