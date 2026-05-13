import { Global, Module } from '@nestjs/common'
import { BackgroundTaskRegistry } from './background-task.registry'
import { BackgroundTaskService } from './background-task.service'
import { BackgroundTaskWorker } from './background-task.worker'

/**
 * 通用后台任务模块。
 * 作为平台能力提供持久任务状态机、处理器注册表和 worker，不包含业务处理器。
 */
@Global()
@Module({
  providers: [
    BackgroundTaskRegistry,
    BackgroundTaskService,
    BackgroundTaskWorker,
  ],
  exports: [BackgroundTaskRegistry, BackgroundTaskService],
})
export class BackgroundTaskModule {}
