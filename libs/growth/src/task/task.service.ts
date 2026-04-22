import type { TaskEventProgressInput } from './types/task.type'
import { IdDto } from '@libs/platform/dto/base.dto'
import { Injectable } from '@nestjs/common'
import {
  CreateTaskDefinitionDto,
  QueryTaskDefinitionPageDto,
  QueryTaskInstancePageDto,
  QueryTaskReconciliationPageDto,
  UpdateTaskDefinitionDto,
} from './dto/task-admin.dto'
import {
  QueryAvailableTaskPageDto,
  QueryMyTaskPageDto,
  TaskProgressDto,
} from './dto/task-query.dto'
import { TaskDefinitionService } from './task-definition.service'
import { TaskEventTemplateRegistry } from './task-event-template.registry'
import { TaskExecutionService } from './task-execution.service'
import { TaskRuntimeService } from './task-runtime.service'

/**
 * 任务域正式门面服务。
 *
 * 统一向 controller、用户中心和外部桥接服务暴露 task 域入口，内部只负责
 * 收口依赖并委托给分域 service，不承载执行细节和底层共享 helper。
 */
@Injectable()
export class TaskService {
  // 注入任务域门面对外暴露所需的各子服务。
  constructor(
    private readonly taskDefinitionService: TaskDefinitionService,
    private readonly taskEventTemplateRegistry: TaskEventTemplateRegistry,
    private readonly taskExecutionService: TaskExecutionService,
    private readonly taskRuntimeService: TaskRuntimeService,
  ) {}

  // 分页查询任务头列表。
  async getTaskDefinitionPage(params: QueryTaskDefinitionPageDto) {
    return this.taskDefinitionService.getTaskDefinitionPage(params)
  }

  // 查询任务头详情。
  async getTaskDefinitionDetail(id: number) {
    return this.taskDefinitionService.getTaskDefinitionDetail(id)
  }

  // 创建任务头。
  async createTaskDefinition(
    input: CreateTaskDefinitionDto,
    adminUserId: number,
  ) {
    return this.taskDefinitionService.createTaskDefinition(input, adminUserId)
  }

  // 更新任务头。
  async updateTaskDefinition(
    input: UpdateTaskDefinitionDto,
    adminUserId: number,
  ) {
    return this.taskDefinitionService.updateTaskDefinition(input, adminUserId)
  }

  // 更新任务头状态。
  async updateTaskDefinitionStatus(id: number, status: number) {
    return this.taskDefinitionService.updateTaskDefinitionStatus(id, status)
  }

  // 删除任务头。
  async deleteTaskDefinition(id: number) {
    return this.taskDefinitionService.deleteTaskDefinition(id)
  }

  // 获取 task 可消费事件模板列表。
  async getTaskTemplateOptions() {
    return {
      list: this.taskEventTemplateRegistry.listTemplates().map((template) => {
        const { eventCode: _eventCode, ...rest } = template
        return rest
      }),
    }
  }

  // 分页查询任务实例列表。
  async getTaskInstancePage(queryDto: QueryTaskInstancePageDto) {
    return this.taskExecutionService.getTaskInstancePage(queryDto)
  }

  // 分页查询任务奖励与通知对账视图。
  async getTaskInstanceReconciliationPage(
    queryDto: QueryTaskReconciliationPageDto,
  ) {
    return this.taskExecutionService.getTaskReconciliationPage(queryDto)
  }

  // 按实例维度重放任务奖励结算。
  async retryTaskInstanceReward(instanceId: number) {
    return this.taskExecutionService.retryTaskInstanceReward(instanceId)
  }

  // 批量补偿已完成任务奖励。
  async retryCompletedTaskRewardsBatch(limit = 100) {
    return this.taskExecutionService.retryCompletedTaskRewardsBatch(limit)
  }

  // 获取可领取任务列表。
  async getAvailableTasks(queryDto: QueryAvailableTaskPageDto, userId: number) {
    return this.taskExecutionService.getAvailableTasks(queryDto, userId)
  }

  // 获取我的任务列表。
  async getMyTasks(queryDto: QueryMyTaskPageDto, userId: number) {
    return this.taskExecutionService.getMyTasks(queryDto, userId)
  }

  // 获取用户中心任务摘要。
  async getUserTaskSummary(userId: number) {
    return this.taskExecutionService.getUserTaskSummary(userId)
  }

  // 领取任务。
  async claimTask(dto: IdDto, userId: number) {
    return this.taskExecutionService.claimTask(dto, userId)
  }

  // 上报任务进度。
  async reportProgress(dto: TaskProgressDto, userId: number) {
    return this.taskExecutionService.reportProgress(dto, userId)
  }

  // 完成任务。
  async completeTask(dto: IdDto, userId: number) {
    return this.taskExecutionService.completeTask(dto, userId)
  }

  // 消费业务事件并推进事件型任务。
  async consumeEventProgress(input: TaskEventProgressInput) {
    return this.taskExecutionService.consumeEventProgress(input)
  }

  // 立即执行一次任务实例过期收口。
  async expireTaskInstances() {
    return this.taskRuntimeService.expireTaskInstances()
  }

  // 立即执行一次已完成任务奖励补偿。
  async retryCompletedTaskRewards() {
    return this.taskRuntimeService.retryCompletedTaskRewards()
  }

  // 立即执行一次“即将过期”提醒扫描。
  async notifyExpiringSoonTaskInstances() {
    return this.taskRuntimeService.notifyExpiringSoonTaskInstances()
  }
}
