import { Injectable } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { WorkflowService } from './workflow.service'

/**
 * 通用工作流 worker。
 * 周期性 claim 待处理 attempt，并清理过期草稿。
 */
@Injectable()
export class WorkflowWorker {
  // 初始化工作流 worker 依赖。
  constructor(private readonly workflowService: WorkflowService) {}

  // 消费待处理工作流 attempt。
  @Cron('*/5 * * * * *')
  async consumePendingAttempts() {
    await this.workflowService.consumePendingAttempts()
  }
}
