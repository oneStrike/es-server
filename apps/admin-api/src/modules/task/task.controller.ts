import {
  CreateTaskDefinitionDto,
  UpdateTaskDefinitionDto,
  UpdateTaskDefinitionStatusDto,
} from '@libs/growth/task/dto/task-admin.dto'
import {
  BaseTaskEventFailureDto,
  QueryTaskEventFailurePageDto,
  RetryTaskEventFailureBatchDto,
  TaskEventFailureRetryBatchResultDto,
  TaskEventFailureRetryResultDto,
} from '@libs/growth/task/dto/task-event-failure.dto'
import {
  QueryTaskDefinitionPageDto,
  QueryTaskInstancePageDto,
  QueryTaskReconciliationPageDto,
} from '@libs/growth/task/dto/task-query.dto'
import {
  RetryTaskRewardBatchDto,
  TaskRewardRetryBatchResultDto,
  TaskRewardRetryResultDto,
} from '@libs/growth/task/dto/task-reward-retry.dto'
import { TaskTemplateOptionsResponseDto } from '@libs/growth/task/dto/task-template.dto'
import {
  AdminTaskDefinitionDetailDto,
  AdminTaskDefinitionListItemDto,
  AdminTaskInstancePageItemDto,
  AdminTaskReconciliationItemDto,
} from '@libs/growth/task/dto/task-view.dto'
import { TaskRewardRetryService } from '@libs/growth/task/task-reward-retry.service'
import { TaskService } from '@libs/growth/task/task.service'
import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/platform/decorators'

import { IdDto } from '@libs/platform/dto'
import { AuditActionTypeEnum } from '@libs/platform/modules/audit/audit-action.constant'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiBody, ApiTags } from '@nestjs/swagger'
import { ApiAuditDoc } from '../../common/decorators/api-audit-doc.decorator'

@ApiTags('任务管理/任务配置')
@Controller('admin/task')
export class TaskController {
  // 注入任务域门面服务。
  constructor(
    private readonly taskService: TaskService,
    private readonly taskRewardRetryService: TaskRewardRetryService,
  ) {}

  // 创建一条任务定义。
  @Post('create')
  @ApiAuditDoc({
    summary: '创建任务',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.CREATE,
    },
  })
  async create(
    @Body() body: CreateTaskDefinitionDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.taskService.createTaskDefinition(body, userId)
  }

  // 更新一条任务定义。
  @Post('update')
  @ApiAuditDoc({
    summary: '更新任务',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async update(
    @Body() body: UpdateTaskDefinitionDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.taskService.updateTaskDefinition(body, userId)
  }

  // 更新一条任务定义的状态。
  @Post('update-status')
  @ApiAuditDoc({
    summary: '更新任务状态',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async updateStatus(@Body() body: UpdateTaskDefinitionStatusDto) {
    return this.taskService.updateTaskDefinitionStatus(body.id, body.status)
  }

  // 软删除一条任务定义。
  @Post('delete')
  @ApiAuditDoc({
    summary: '删除任务',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.DELETE,
    },
  })
  async delete(@Body() body: IdDto) {
    return this.taskService.deleteTaskDefinition(body.id)
  }

  // 查询任务可选事件模板。
  @Get('template-options')
  @ApiDoc({
    summary: '查询 task 可消费事件模板选项',
    model: TaskTemplateOptionsResponseDto,
  })
  async findTemplateOptions() {
    return this.taskService.getTaskTemplateOptions()
  }

  // 分页查询任务定义列表。
  @Get('page')
  @ApiPageDoc({
    summary: '分页查询任务',
    model: AdminTaskDefinitionListItemDto,
  })
  async findPage(@Query() query: QueryTaskDefinitionPageDto) {
    return this.taskService.getTaskDefinitionPage(query)
  }

  // 查询任务定义详情。
  @Get('detail')
  @ApiDoc({
    summary: '查询任务详情',
    model: AdminTaskDefinitionDetailDto,
  })
  async findDetail(@Query() query: IdDto) {
    return this.taskService.getTaskDefinitionDetail(query.id)
  }

  // 分页查询任务实例列表。
  @Get('instance/page')
  @ApiPageDoc({
    summary: '分页查询任务实例记录',
    model: AdminTaskInstancePageItemDto,
  })
  async findInstancePage(@Query() query: QueryTaskInstancePageDto) {
    return this.taskService.getTaskInstancePage(query)
  }

  // 分页查询任务奖励与通知对账视图。
  @Get('instance/reconciliation/page')
  @ApiPageDoc({
    summary: '分页查询任务奖励与通知对账视图',
    model: AdminTaskReconciliationItemDto,
  })
  async findInstanceReconciliationPage(
    @Query() query: QueryTaskReconciliationPageDto,
  ) {
    return this.taskService.getTaskInstanceReconciliationPage(query)
  }

  // 按任务实例维度重试奖励补偿。
  @Post('instance/reward/retry')
  @ApiAuditDoc({
    summary: '重试单条任务实例奖励补偿',
    model: TaskRewardRetryResultDto,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async retryTaskInstanceReward(@Body() body: IdDto) {
    return this.taskRewardRetryService.retryTaskInstanceReward(body.id)
  }

  // 批量重试待补偿的任务奖励，必须由当前筛选或选中实例限定范围。
  @Post('instance/reward/retry-pending/batch')
  @ApiAuditDoc({
    summary: '批量重试待补偿的任务实例奖励',
    model: TaskRewardRetryBatchResultDto,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  @ApiBody({ type: RetryTaskRewardBatchDto, required: false })
  async retryPendingTaskRewardsBatch(@Body() body?: RetryTaskRewardBatchDto) {
    return this.taskRewardRetryService.retryCompletedTaskRewardsBatch(
      body ?? {},
    )
  }

  // 分页查询任务事件消费失败事实。
  @Get('event-failure/page')
  @ApiPageDoc({
    summary: '分页查询任务事件消费失败事实',
    model: BaseTaskEventFailureDto,
  })
  async findEventFailurePage(@Query() query: QueryTaskEventFailurePageDto) {
    return this.taskService.getTaskEventFailurePage(query)
  }

  // 重试单条任务事件消费失败事实。
  @Post('event-failure/retry')
  @ApiAuditDoc({
    summary: '重试单条任务事件消费失败事实',
    model: TaskEventFailureRetryResultDto,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async retryTaskEventFailure(@Body() body: IdDto) {
    return this.taskService.retryTaskEventFailure(body.id)
  }

  // 批量重试待处理的任务事件消费失败事实。
  @Post('event-failure/retry-pending/batch')
  @ApiAuditDoc({
    summary: '批量重试待处理的任务事件消费失败事实',
    model: TaskEventFailureRetryBatchResultDto,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  @ApiBody({ type: RetryTaskEventFailureBatchDto, required: false })
  async retryPendingTaskEventFailuresBatch(
    @Body() body?: RetryTaskEventFailureBatchDto,
  ) {
    return this.taskService.retryPendingTaskEventFailuresBatch(body ?? {})
  }
}
