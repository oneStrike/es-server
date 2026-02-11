import { Module } from '@nestjs/common'
import { UserPointService } from './point.service'

/**
 * 积分模块
 * 提供用户积分管理的完整功能
 */
@Module({
  imports: [],
  providers: [UserPointService],
  exports: [UserPointService],
})
export class UserPointModule {}
