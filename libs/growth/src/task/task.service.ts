import type {
  TaskEventProgressInput,
} from './task.type'
import { Injectable } from '@nestjs/common'
import {
  ClaimTaskDto,
  CreateTaskDto,
  QueryAvailableTaskDto,
  QueryMyTaskDto,
  QueryTaskAssignmentDto,
  QueryTaskAssignmentReconciliationDto,
  QueryTaskDto,
  TaskCompleteDto,
  TaskProgressDto,
  UpdateTaskDto,
  UpdateTaskStatusDto,
} from './dto/task.dto'
import { TaskDefinitionService } from './task-definition.service'
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
  constructor(
    private readonly taskDefinitionFacade: TaskDefinitionService,
    protected readonly taskExecutionService: TaskExecutionService,
    private readonly taskRuntimeFacade: TaskRuntimeService,
  ) {}

  /**
   * 分页查询任务列表（管理端）。
   */
  async getTaskPage(queryDto: QueryTaskDto) {
    return this.taskDefinitionFacade.getTaskPage(queryDto)
  }

  /**
   * 获取任务详情（管理端）。
   */
  async getTaskDetail(id: number) {
    return this.taskDefinitionFacade.getTaskDetail(id)
  }

  /**
   * 创建任务（管理端）。
   */
  async createTask(dto: CreateTaskDto, adminUserId: number) {
    return this.taskDefinitionFacade.createTask(dto, adminUserId)
  }

  /**
   * 更新任务（管理端）。
   */
  async updateTask(dto: UpdateTaskDto, adminUserId: number) {
    return this.taskDefinitionFacade.updateTask(dto, adminUserId)
  }

  /**
   * 更新任务状态（管理端）。
   */
  async updateTaskStatus(dto: UpdateTaskStatusDto) {
    return this.taskDefinitionFacade.updateTaskStatus(dto)
  }

  /**
   * 删除任务（管理端）。
   */
  async deleteTask(id: number) {
    return this.taskDefinitionFacade.deleteTask(id)
  }

  /**
   * 分页查询任务分配列表（管理端）。
   */
  async getTaskAssignmentPage(queryDto: QueryTaskAssignmentDto) {
    return this.taskExecutionService.getTaskAssignmentPage(queryDto)
  }

  /**
   * 分页查询任务奖励与通知对账视图（管理端）。
   */
  async getTaskAssignmentReconciliationPage(
    queryDto: QueryTaskAssignmentReconciliationDto,
  ) {
    return this.taskExecutionService.getTaskAssignmentReconciliationPage(queryDto)
  }

  /**
   * 按 assignment 维度重放任务奖励结算。
   * 仅供通用奖励补偿服务内部调用，不作为独立 HTTP 接口暴露。
   */
  async retryTaskAssignmentReward(assignmentId: number, isRetry = false) {
    return this.taskExecutionService.retryTaskAssignmentReward(
      assignmentId,
      isRetry,
    )
  }

  /**
   * 批量补偿已完成任务奖励。
   * 仅供任务运行时 cron 复用，不再对外暴露独立管理端接口。
   */
  async retryCompletedAssignmentRewardsBatch(limit = 100) {
    return this.taskExecutionService.retryCompletedAssignmentRewardsBatch(limit)
  }

  /**
   * 获取可领取任务列表（应用端）。
   */
  async getAvailableTasks(queryDto: QueryAvailableTaskDto, userId: number) {
    return this.taskExecutionService.getAvailableTasks(queryDto, userId)
  }

  /**
   * 获取我的任务列表（应用端）。
   */
  async getMyTasks(queryDto: QueryMyTaskDto, userId: number) {
    return this.taskExecutionService.getMyTasks(queryDto, userId)
  }

  /**
   * 获取用户中心任务摘要。
   */
  async getUserTaskSummary(userId: number) {
    return this.taskExecutionService.getUserTaskSummary(userId)
  }

  /**
   * 领取任务（应用端）。
   */
  async claimTask(dto: ClaimTaskDto, userId: number) {
    return this.taskExecutionService.claimTask(dto, userId)
  }

  /**
   * 上报任务进度（应用端）。
   */
  async reportProgress(dto: TaskProgressDto, userId: number) {
    return this.taskExecutionService.reportProgress(dto, userId)
  }

  /**
   * 完成任务（应用端）。
   */
  async completeTask(dto: TaskCompleteDto, userId: number) {
    return this.taskExecutionService.completeTask(dto, userId)
  }

  /**
   * 消费业务事件并推进事件型任务。
   */
  async consumeEventProgress(input: TaskEventProgressInput) {
    return this.taskExecutionService.consumeEventProgress(input)
  }

  /**
   * 立即执行一次 assignment 过期收口。
   */
  async expireAssignments() {
    return this.taskRuntimeFacade.expireAssignments()
  }

  /**
   * 立即执行一次已完成任务奖励补偿。
   */
  async retryCompletedAssignmentRewards() {
    return this.taskRuntimeFacade.retryCompletedAssignmentRewards()
  }

  /**
   * 立即执行一次“即将过期”提醒扫描。
   */
  async notifyExpiringSoonAssignments() {
    return this.taskRuntimeFacade.notifyExpiringSoonAssignments()
  }
}
