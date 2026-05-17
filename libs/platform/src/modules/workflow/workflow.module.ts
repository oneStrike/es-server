import { Global, Module } from '@nestjs/common'
import { WorkflowRegistry } from './workflow.registry'
import { WorkflowService } from './workflow.service'
import { WorkflowWorker } from './workflow.worker'

/**
 * 通用工作流模块。
 * 提供任务、attempt、事件、claim、取消和重试的通用执行能力。
 */
@Global()
@Module({
  providers: [WorkflowRegistry, WorkflowService, WorkflowWorker],
  exports: [WorkflowRegistry, WorkflowService],
})
export class WorkflowModule {}
