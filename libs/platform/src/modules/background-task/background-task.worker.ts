import { Injectable } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { BackgroundTaskService } from './background-task.service'

/**
 * 通用后台任务 worker。
 * 周期性 claim 可执行任务；过期 FINALIZING 会被自动回收并进入恢复回滚。
 */
@Injectable()
export class BackgroundTaskWorker {
  // 初始化后台任务 worker 依赖。
  constructor(private readonly backgroundTaskService: BackgroundTaskService) {}

  // 消费待处理、过期 processing 和过期 finalizing 任务。
  @Cron('*/5 * * * * *')
  async consumePendingTasks() {
    await this.backgroundTaskService.consumePendingTasks()
  }
}
