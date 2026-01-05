import { Module } from '@nestjs/common'
import { PointModule } from '../point/point.module'
import { UserService } from './user.service'

/**
 * 搜索模块
 * 提供论坛搜索的完整功能
 */
@Module({
  imports: [PointModule],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
