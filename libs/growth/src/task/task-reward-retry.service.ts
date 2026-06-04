import { Injectable } from '@nestjs/common'
import { TaskExecutionService } from './task-execution.service'

/**
 * 任务奖励补偿重试端口。
 *
 * 仅暴露 task reward repair 能力，避免通用成长补偿依赖完整 TaskService 门面。
 */
@Injectable()
export class TaskRewardRetryService {
  constructor(private readonly taskExecutionService: TaskExecutionService) {}

  // 按任务实例维度重试奖励结算。
  async retryTaskInstanceReward(instanceId: number) {
    return this.taskExecutionService.retryTaskInstanceReward(instanceId)
  }

  // 批量补偿已完成但奖励未成功的任务实例。
  async retryCompletedTaskRewardsBatch(limit = 100) {
    return this.taskExecutionService.retryCompletedTaskRewardsBatch(limit)
  }
}
