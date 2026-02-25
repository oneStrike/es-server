import { Global, Module } from '@nestjs/common'
import { CounterService } from './counter.service'

/**
 * 计数处理器模块
 */
@Global()
@Module({
  providers: [CounterService],
  exports: [CounterService],
})
export class CounterModule {}
