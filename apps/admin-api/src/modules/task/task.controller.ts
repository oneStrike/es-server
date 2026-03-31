import {
  TaskConfigService,
  TaskReadService,
  TaskRewardService,
} from '@libs/growth/task'
import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/platform/decorators'
import { IdDto } from '@libs/platform/dto'
import {
  Body,
  Controller,
  Get,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import {
  AdminTaskAssignmentPageResponseDto,
  AdminTaskAssignmentReconciliationPageResponseDto,
  AdminTaskPageResponseDto,
  CreateTaskDto,
  QueryTaskAssignmentDto,
  QueryTaskAssignmentReconciliationDto,
  QueryTaskDto,
  RetryCompletedTaskRewardsDto,
  RetryCompletedTaskRewardsResponseDto,
  RetryTaskAssignmentRewardDto,
  UpdateTaskDto,
  UpdateTaskStatusDto,
} from './dto/task.dto'

@ApiTags('任务管理/任务配置')
@Controller('admin/task')
export class TaskController {
  constructor(
    private readonly taskConfigService: TaskConfigService,
    private readonly taskReadService: TaskReadService,
    private readonly taskRewardService: TaskRewardService,
  ) {}

  @Post('create')
  @ApiDoc({
    summary: '创建任务',
    model: Boolean,
  })
  async create(
    @Body() body: CreateTaskDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.taskConfigService.createTask(body, userId)
  }

  @Post('update')
  @ApiDoc({
    summary: '更新任务',
    model: Boolean,
  })
  async update(
    @Body() body: UpdateTaskDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.taskConfigService.updateTask(body, userId)
  }

  @Post('update-status')
  @ApiDoc({
    summary: '更新任务状态',
    model: Boolean,
  })
  async updateStatus(@Body() body: UpdateTaskStatusDto) {
    return this.taskConfigService.updateTaskStatus(body)
  }

  @Post('delete')
  @ApiDoc({
    summary: '删除任务',
    model: Boolean,
  })
  async delete(@Body() body: IdDto) {
    return this.taskConfigService.deleteTask(body.id)
  }

  @Get('page')
  @ApiPageDoc({
    summary: '分页查询任务',
    model: AdminTaskPageResponseDto,
  })
  async findPage(@Query() query: QueryTaskDto) {
    return this.taskReadService.getTaskPage(query)
  }

  @Get('detail')
  @ApiDoc({
    summary: '查询任务详情',
    model: AdminTaskPageResponseDto,
  })
  async findDetail(@Query('id', ParseIntPipe) id: number) {
    return this.taskReadService.getTaskDetail(id)
  }

  @Get('assignment/page')
  @ApiPageDoc({
    summary: '分页查询任务领取记录',
    model: AdminTaskAssignmentPageResponseDto,
  })
  async findAssignmentPage(@Query() query: QueryTaskAssignmentDto) {
    return this.taskReadService.getTaskAssignmentPage(query)
  }

  @Get('assignment/reconciliation/page')
  @ApiPageDoc({
    summary: '分页查询任务奖励与通知对账视图',
    model: AdminTaskAssignmentReconciliationPageResponseDto,
  })
  async findAssignmentReconciliationPage(
    @Query() query: QueryTaskAssignmentReconciliationDto,
  ) {
    return this.taskReadService.getTaskAssignmentReconciliationPage(query)
  }

  @Post('assignment/retry-reward')
  @ApiDoc({
    summary: '重试单条任务奖励结算',
    model: Boolean,
  })
  async retryAssignmentReward(@Body() body: RetryTaskAssignmentRewardDto) {
    return this.taskRewardService.retryTaskAssignmentReward(body.id)
  }

  @Post('assignment/retry-reward/batch')
  @ApiDoc({
    summary: '批量扫描并重试待补偿任务奖励',
    model: RetryCompletedTaskRewardsResponseDto,
  })
  async retryCompletedRewards(@Body() body: RetryCompletedTaskRewardsDto) {
    return this.taskRewardService.retryCompletedAssignmentRewardsBatch(body.limit)
  }
}
