import { Module } from '@nestjs/common'
import { PointService } from './point.service'

/**
 * 积分模块
 * 提供论坛积分管理的完整功能
 */
@Module({
  imports: [],
  providers: [PointService],
  exports: [PointService],
})
export class PointModule {}
