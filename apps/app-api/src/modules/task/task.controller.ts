import type { JwtUserInfoInterface } from '@libs/base/types'
import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/base/decorators'
import {
  BaseTaskAssignmentDto,
  BaseTaskDto,
  ClaimTaskDto,
  QueryAppTaskDto,
  QueryMyTaskDto,
  TaskCompleteDto,
  TaskProgressDto,
  TaskService,
} from '@libs/task'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('任务模块')
@Controller('app/task')
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Get('/page')
  @ApiPageDoc({
    summary: '分页查询可领取任务',
    model: BaseTaskDto,
  })
  async getAvailable(
    @Query() query: QueryAppTaskDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.taskService.getAvailableTasks(query, user.sub)
  }

  @Get('/my/page')
  @ApiPageDoc({
    summary: '分页查询我的任务',
    model: BaseTaskAssignmentDto,
  })
  async getMyTasks(
    @Query() query: QueryMyTaskDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.taskService.getMyTasks(query, user.sub)
  }

  @Post('/claim')
  @ApiDoc({
    summary: '领取任务',
    model: BaseTaskAssignmentDto,
  })
  async claim(
    @Body() body: ClaimTaskDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.taskService.claimTask(body, user.sub)
  }

  @Post('/progress')
  @ApiDoc({
    summary: '上报任务进度',
    model: BaseTaskAssignmentDto,
  })
  async progress(
    @Body() body: TaskProgressDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.taskService.reportProgress(body, user.sub)
  }

  @Post('/complete')
  @ApiDoc({
    summary: '完成任务',
    model: BaseTaskAssignmentDto,
  })
  async complete(
    @Body() body: TaskCompleteDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.taskService.completeTask(body, user.sub)
  }
}
