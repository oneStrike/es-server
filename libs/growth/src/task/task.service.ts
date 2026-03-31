import type {
  ClaimTaskInput,
  CreateTaskInput,
  QueryAppTaskInput,
  QueryMyTaskInput,
  QueryTaskAssignmentPageInput,
  QueryTaskAssignmentReconciliationPageInput,
  QueryTaskPageInput,
  TaskCompleteInput,
  TaskEventProgressInput,
  TaskProgressInput,
  UpdateTaskInput,
  UpdateTaskStatusInput,
} from './task.type'
import { DrizzleService } from '@db/core'
import { MessageOutboxService } from '@libs/message/outbox'
import { Injectable } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { UserGrowthRewardService } from '../growth-reward/growth-reward.service'
import { TaskAssignmentService } from './task-assignment.service'
import { TaskConfigService } from './task-config.service'
import { TaskEventService } from './task-event.service'
import { TaskReadService } from './task-read.service'
import { TaskRewardService } from './task-reward.service'
import { TaskRuntimeService } from './task-runtime.service'
import { TaskServiceSupport } from './task.service.support'

/**
 * 任务服务兼容层。
 *
 * 当前正式运行时依赖已经切到分域 service；该类仅保留给既有 task 单测和
 * 临时兼容调用使用。实现上直接委托正式分域 service 的方法体，不再依赖旧的
 * operation 风格拆分文件。
 */
@Injectable()
export class TaskService extends TaskServiceSupport {
  constructor(
    drizzle: DrizzleService,
    userGrowthRewardService: UserGrowthRewardService,
    messageOutboxService: MessageOutboxService,
  ) {
    super(drizzle, userGrowthRewardService, messageOutboxService)
  }

  /**
   * 分页查询任务列表（管理端）。
   */
  async getTaskPage(queryDto: QueryTaskPageInput) {
    return TaskReadService.prototype.getTaskPage.call(this, queryDto)
  }

  /**
   * 获取任务详情（管理端）。
   */
  async getTaskDetail(id: number) {
    return TaskReadService.prototype.getTaskDetail.call(this, id)
  }

  /**
   * 创建任务（管理端）。
   */
  async createTask(dto: CreateTaskInput, adminUserId: number) {
    return TaskConfigService.prototype.createTask.call(this, dto, adminUserId)
  }

  /**
   * 更新任务（管理端）。
   */
  async updateTask(dto: UpdateTaskInput, adminUserId: number) {
    return TaskConfigService.prototype.updateTask.call(this, dto, adminUserId)
  }

  /**
   * 更新任务状态（管理端）。
   */
  async updateTaskStatus(dto: UpdateTaskStatusInput) {
    return TaskConfigService.prototype.updateTaskStatus.call(this, dto)
  }

  /**
   * 删除任务（管理端）。
   */
  async deleteTask(id: number) {
    return TaskConfigService.prototype.deleteTask.call(this, id)
  }

  /**
   * 分页查询任务分配列表（管理端）。
   */
  async getTaskAssignmentPage(queryDto: QueryTaskAssignmentPageInput) {
    return TaskReadService.prototype.getTaskAssignmentPage.call(this, queryDto)
  }

  /**
   * 分页查询任务奖励与通知对账视图（管理端）。
   */
  async getTaskAssignmentReconciliationPage(
    queryDto: QueryTaskAssignmentReconciliationPageInput,
  ) {
    return TaskReadService.prototype.getTaskAssignmentReconciliationPage.call(
      this,
      queryDto,
    )
  }

  /**
   * 重试单条任务奖励结算。
   */
  async retryTaskAssignmentReward(assignmentId: number) {
    return TaskRewardService.prototype.retryTaskAssignmentReward.call(
      this,
      assignmentId,
    )
  }

  /**
   * 批量补偿已完成任务奖励。
   */
  async retryCompletedAssignmentRewardsBatch(limit = 100) {
    return TaskRewardService.prototype.retryCompletedAssignmentRewardsBatch.call(
      this,
      limit,
    )
  }

  /**
   * 获取可领取任务列表（应用端）。
   */
  async getAvailableTasks(queryDto: QueryAppTaskInput, userId: number) {
    return TaskAssignmentService.prototype.getAvailableTasks.call(
      this,
      queryDto,
      userId,
    )
  }

  /**
   * 获取我的任务列表（应用端）。
   */
  async getMyTasks(queryDto: QueryMyTaskInput, userId: number) {
    return TaskAssignmentService.prototype.getMyTasks.call(
      this,
      queryDto,
      userId,
    )
  }

  /**
   * 获取用户中心任务摘要。
   */
  async getUserTaskSummary(userId: number) {
    return TaskAssignmentService.prototype.getUserTaskSummary.call(this, userId)
  }

  /**
   * 领取任务（应用端）。
   */
  async claimTask(dto: ClaimTaskInput, userId: number) {
    return TaskAssignmentService.prototype.claimTask.call(this, dto, userId)
  }

  /**
   * 上报任务进度（应用端）。
   */
  async reportProgress(dto: TaskProgressInput, userId: number) {
    return TaskAssignmentService.prototype.reportProgress.call(this, dto, userId)
  }

  /**
   * 完成任务（应用端）。
   */
  async completeTask(dto: TaskCompleteInput, userId: number) {
    return TaskAssignmentService.prototype.completeTask.call(this, dto, userId)
  }

  /**
   * 消费业务事件并推进事件型任务。
   */
  async consumeEventProgress(input: TaskEventProgressInput) {
    return TaskEventService.prototype.consumeEventProgress.call(this, input)
  }

  /**
   * 定时过期任务分配。
   */
  @Cron('0 */5 * * * *')
  async expireAssignments() {
    return TaskRuntimeService.prototype.expireAssignments.call(this)
  }

  /**
   * 定时补偿已完成任务奖励。
   */
  @Cron('30 */5 * * * *')
  async retryCompletedAssignmentRewards() {
    await this.retryCompletedAssignmentRewardsBatch(100)
  }

  /**
   * 定时发送即将过期提醒。
   */
  @Cron('0 0 * * * *')
  async notifyExpiringSoonAssignments() {
    return TaskRuntimeService.prototype.notifyExpiringSoonAssignments.call(this)
  }
}
