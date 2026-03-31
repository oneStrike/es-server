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
import { UserGrowthRewardService } from '../growth-reward/growth-reward.service'
import { TaskDefinitionService } from './task-definition.service'
import { TaskExecutionService } from './task-execution.service'
import { TaskRuntimeService } from './task-runtime.service'
import { TaskServiceSupport } from './task.service.support'

type TaskDefinitionFacade = Pick<
  TaskDefinitionService,
  'createTask' | 'updateTask' | 'updateTaskStatus' | 'deleteTask' | 'getTaskPage' | 'getTaskDetail'
>

type TaskExecutionFacade = Pick<
  TaskExecutionService,
  | 'getAvailableTasks'
  | 'getMyTasks'
  | 'getUserTaskSummary'
  | 'claimTask'
  | 'reportProgress'
  | 'completeTask'
  | 'consumeEventProgress'
  | 'getTaskAssignmentPage'
  | 'getTaskAssignmentReconciliationPage'
  | 'retryTaskAssignmentReward'
  | 'retryCompletedAssignmentRewardsBatch'
>

type TaskRuntimeFacade = Pick<
  TaskRuntimeService,
  'expireAssignments' | 'retryCompletedAssignmentRewards' | 'notifyExpiringSoonAssignments'
>

/**
 * 任务域正式门面服务。
 *
 * 统一向 controller、用户中心和外部桥接服务暴露 task 域入口，内部按职责委托
 * 给分域 service；手动 `new TaskService(...)` 的单测场景下，会回退到当前实例
 * 绑定的本地实现，避免测试代码必须引入 Nest DI 才能覆盖 task 主链路。
 */
@Injectable()
export class TaskService extends TaskServiceSupport {
  private readonly taskDefinitionFacade: TaskDefinitionFacade
  protected readonly taskExecutionService: TaskExecutionFacade
  private readonly taskRuntimeFacade: TaskRuntimeFacade

  constructor(
    drizzle: DrizzleService,
    userGrowthRewardService: UserGrowthRewardService,
    messageOutboxService: MessageOutboxService,
    taskDefinitionService?: TaskDefinitionService,
    taskExecutionService?: TaskExecutionService,
    taskRuntimeService?: TaskRuntimeService,
  ) {
    super(drizzle, userGrowthRewardService, messageOutboxService)

    this.taskDefinitionFacade = taskDefinitionService ?? {
      createTask: TaskDefinitionService.prototype.createTask.bind(this),
      updateTask: TaskDefinitionService.prototype.updateTask.bind(this),
      updateTaskStatus: TaskDefinitionService.prototype.updateTaskStatus.bind(
        this,
      ),
      deleteTask: TaskDefinitionService.prototype.deleteTask.bind(this),
      getTaskPage: TaskDefinitionService.prototype.getTaskPage.bind(this),
      getTaskDetail: TaskDefinitionService.prototype.getTaskDetail.bind(this),
    }
    this.taskExecutionService = taskExecutionService ?? {
      getAvailableTasks:
        TaskExecutionService.prototype.getAvailableTasks.bind(this),
      getMyTasks: TaskExecutionService.prototype.getMyTasks.bind(this),
      getUserTaskSummary:
        TaskExecutionService.prototype.getUserTaskSummary.bind(this),
      claimTask: TaskExecutionService.prototype.claimTask.bind(this),
      reportProgress: TaskExecutionService.prototype.reportProgress.bind(this),
      completeTask: TaskExecutionService.prototype.completeTask.bind(this),
      consumeEventProgress:
        TaskExecutionService.prototype.consumeEventProgress.bind(this),
      getTaskAssignmentPage:
        TaskExecutionService.prototype.getTaskAssignmentPage.bind(this),
      getTaskAssignmentReconciliationPage:
        TaskExecutionService.prototype.getTaskAssignmentReconciliationPage.bind(
          this,
        ),
      retryTaskAssignmentReward:
        TaskExecutionService.prototype.retryTaskAssignmentReward.bind(this),
      retryCompletedAssignmentRewardsBatch:
        TaskExecutionService.prototype.retryCompletedAssignmentRewardsBatch.bind(
          this,
        ),
    }
    this.taskRuntimeFacade = taskRuntimeService ?? {
      expireAssignments: TaskRuntimeService.prototype.expireAssignments.bind(
        this,
      ),
      retryCompletedAssignmentRewards:
        TaskRuntimeService.prototype.retryCompletedAssignmentRewards.bind(this),
      notifyExpiringSoonAssignments:
        TaskRuntimeService.prototype.notifyExpiringSoonAssignments.bind(this),
    }
  }

  /**
   * 分页查询任务列表（管理端）。
   */
  async getTaskPage(queryDto: QueryTaskPageInput) {
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
  async createTask(dto: CreateTaskInput, adminUserId: number) {
    return this.taskDefinitionFacade.createTask(dto, adminUserId)
  }

  /**
   * 更新任务（管理端）。
   */
  async updateTask(dto: UpdateTaskInput, adminUserId: number) {
    return this.taskDefinitionFacade.updateTask(dto, adminUserId)
  }

  /**
   * 更新任务状态（管理端）。
   */
  async updateTaskStatus(dto: UpdateTaskStatusInput) {
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
  async getTaskAssignmentPage(queryDto: QueryTaskAssignmentPageInput) {
    return this.taskExecutionService.getTaskAssignmentPage(queryDto)
  }

  /**
   * 分页查询任务奖励与通知对账视图（管理端）。
   */
  async getTaskAssignmentReconciliationPage(
    queryDto: QueryTaskAssignmentReconciliationPageInput,
  ) {
    return this.taskExecutionService.getTaskAssignmentReconciliationPage(queryDto)
  }

  /**
   * 重试单条任务奖励结算。
   */
  async retryTaskAssignmentReward(assignmentId: number) {
    return this.taskExecutionService.retryTaskAssignmentReward(assignmentId)
  }

  /**
   * 批量补偿已完成任务奖励。
   */
  async retryCompletedAssignmentRewardsBatch(limit = 100) {
    return this.taskExecutionService.retryCompletedAssignmentRewardsBatch(limit)
  }

  /**
   * 获取可领取任务列表（应用端）。
   */
  async getAvailableTasks(queryDto: QueryAppTaskInput, userId: number) {
    return this.taskExecutionService.getAvailableTasks(queryDto, userId)
  }

  /**
   * 获取我的任务列表（应用端）。
   */
  async getMyTasks(queryDto: QueryMyTaskInput, userId: number) {
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
  async claimTask(dto: ClaimTaskInput, userId: number) {
    return this.taskExecutionService.claimTask(dto, userId)
  }

  /**
   * 上报任务进度（应用端）。
   */
  async reportProgress(dto: TaskProgressInput, userId: number) {
    return this.taskExecutionService.reportProgress(dto, userId)
  }

  /**
   * 完成任务（应用端）。
   */
  async completeTask(dto: TaskCompleteInput, userId: number) {
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
