import { Module } from '@nestjs/common'
import { WorkCounterService } from '../work/counter/work-counter.service'

/**
 * 内容域作品计数模块
 * 作为独立的轻量 public API 暴露作品计数 owner service。
 */
@Module({
  providers: [WorkCounterService],
  exports: [WorkCounterService],
})
export class WorkCounterModule {}
