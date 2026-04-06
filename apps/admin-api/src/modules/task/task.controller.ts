import { AdminTaskAssignmentPageResponseDto, AdminTaskAssignmentReconciliationPageResponseDto, AdminTaskPageResponseDto, CreateTaskDto, QueryTaskAssignmentDto, QueryTaskAssignmentReconciliationDto, QueryTaskDto, RetryCompletedTaskRewardsDto, RetryCompletedTaskRewardsResponseDto, UpdateTaskDto, UpdateTaskStatusDto } from '@libs/growth/task/dto/task.dto';
import { TaskService } from '@libs/growth/task/task.service';
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators/api-doc.decorator';
import { CurrentUser } from '@libs/platform/decorators/current-user.decorator';
import { IdDto } from '@libs/platform/dto/base.dto';
import {
  Body,
  Controller,
  Get,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ApiAuditDoc } from '../../common/decorators/api-audit-doc.decorator'
import { AuditActionTypeEnum } from '../system/audit/audit.constant'

@ApiTags('任务管理/任务配置')
@Controller('admin/task')
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Post('create')
  @ApiAuditDoc({
    summary: '创建任务',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.CREATE,
    },
  })
  async create(
    @Body() body: CreateTaskDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.taskService.createTask(body, userId)
  }

  @Post('update')
  @ApiAuditDoc({
    summary: '更新任务',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async update(
    @Body() body: UpdateTaskDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.taskService.updateTask(body, userId)
  }

  @Post('update-status')
  @ApiAuditDoc({
    summary: '更新任务状态',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async updateStatus(@Body() body: UpdateTaskStatusDto) {
    return this.taskService.updateTaskStatus(body)
  }

  @Post('delete')
  @ApiAuditDoc({
    summary: '删除任务',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.DELETE,
    },
  })
  async delete(@Body() body: IdDto) {
    return this.taskService.deleteTask(body.id)
  }

  @Get('page')
  @ApiPageDoc({
    summary: '分页查询任务',
    model: AdminTaskPageResponseDto,
  })
  async findPage(@Query() query: QueryTaskDto) {
    return this.taskService.getTaskPage(query)
  }

  @Get('detail')
  @ApiDoc({
    summary: '查询任务详情',
    model: AdminTaskPageResponseDto,
  })
  async findDetail(@Query('id', ParseIntPipe) id: number) {
    return this.taskService.getTaskDetail(id)
  }

  @Get('assignment/page')
  @ApiPageDoc({
    summary: '分页查询任务领取记录',
    model: AdminTaskAssignmentPageResponseDto,
  })
  async findAssignmentPage(@Query() query: QueryTaskAssignmentDto) {
    return this.taskService.getTaskAssignmentPage(query)
  }

  @Get('assignment/reconciliation/page')
  @ApiPageDoc({
    summary: '分页查询任务奖励与通知对账视图',
    model: AdminTaskAssignmentReconciliationPageResponseDto,
  })
  async findAssignmentReconciliationPage(
    @Query() query: QueryTaskAssignmentReconciliationDto,
  ) {
    return this.taskService.getTaskAssignmentReconciliationPage(query)
  }

  @Post('assignment/retry-reward')
  @ApiAuditDoc({
    summary: '重试单条任务奖励结算',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async retryAssignmentReward(@Body() body: IdDto) {
    return this.taskService.retryTaskAssignmentReward(body.id)
  }

  @Post('assignment/retry-reward/batch')
  @ApiAuditDoc({
    summary: '批量扫描并重试待补偿任务奖励',
    model: RetryCompletedTaskRewardsResponseDto,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async retryCompletedRewards(@Body() body: RetryCompletedTaskRewardsDto) {
    return this.taskService.retryCompletedAssignmentRewardsBatch(body.limit)
  }
}
