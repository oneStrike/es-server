import { Module } from '@nestjs/common'
import { ForumPointService } from './point.service'

/**
 * 积分模块
 * 提供论坛积分管理的完整功能
 */
@Module({
  imports: [],
  providers: [ForumPointService],
  exports: [ForumPointService],
})
export class ForumPointModule {}
