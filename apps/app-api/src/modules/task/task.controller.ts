import {
  TaskAssignmentService,
} from '@libs/growth/task'
import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/platform/decorators'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import {
  AppTaskPageResponseDto,
  ClaimTaskDto,
  MyTaskPageResponseDto,
  QueryAppTaskDto,
  QueryMyTaskDto,
  TaskCompleteDto,
  TaskProgressDto,
} from './dto/task.dto'

@ApiTags('任务')
@Controller('app/task')
export class TaskController {
  constructor(private readonly taskAssignmentService: TaskAssignmentService) {}

  @Get('page')
  @ApiPageDoc({
    summary: '分页查询可领取任务',
    model: AppTaskPageResponseDto,
  })
  async getAvailable(
    @Query() query: QueryAppTaskDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.taskAssignmentService.getAvailableTasks(query, userId)
  }

  @Get('my/page')
  @ApiPageDoc({
    summary: '分页查询我的任务',
    model: MyTaskPageResponseDto,
  })
  async getMyTasks(
    @Query() query: QueryMyTaskDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.taskAssignmentService.getMyTasks(query, userId)
  }

  @Post('claim')
  @ApiDoc({
    summary: '领取任务',
    model: Boolean,
  })
  async claim(
    @Body() body: ClaimTaskDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.taskAssignmentService.claimTask(body, userId)
  }

  @Post('progress')
  @ApiDoc({
    summary: '上报任务进度',
    model: Boolean,
  })
  async progress(
    @Body() body: TaskProgressDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.taskAssignmentService.reportProgress(body, userId)
  }

  @Post('complete')
  @ApiDoc({
    summary: '完成任务',
    model: Boolean,
  })
  async complete(
    @Body() body: TaskCompleteDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.taskAssignmentService.completeTask(body, userId)
  }
}
