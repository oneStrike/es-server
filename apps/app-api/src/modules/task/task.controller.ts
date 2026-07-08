import {
  AppAvailableTaskPageItemDto,
  AppMyTaskPageItemDto,
} from '@libs/growth/task/dto/task-app.dto'
import {
  QueryAvailableTaskPageDto,
  QueryMyTaskPageDto,
  TaskProgressDto,
} from '@libs/growth/task/dto/task-query.dto'
import { TaskService } from '@libs/growth/task/task.service'
import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/platform/decorators'

import { IdDto } from '@libs/platform/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('任务')
@Controller('app/task')
export class TaskController {
  // 注入任务域门面服务。
  constructor(private readonly taskService: TaskService) {}

  // 分页查询当前用户可领取的任务。
  @Get('page')
  @ApiPageDoc({
    summary: '分页查询可领取任务',
    model: AppAvailableTaskPageItemDto,
  })
  async getAvailable(
    @Query() query: QueryAvailableTaskPageDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.taskService.getAvailableTasks(query, userId)
  }

  // 分页查询当前用户的任务实例。
  @Get('my/page')
  @ApiPageDoc({
    summary: '分页查询我的任务',
    model: AppMyTaskPageItemDto,
  })
  async getMyTasks(
    @Query() query: QueryMyTaskPageDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.taskService.getMyTasks(query, userId)
  }

  // 领取一条手动任务。
  @Post('claim')
  @ApiDoc({
    summary: '领取任务',
    model: Boolean,
  })
  async claim(@Body() body: IdDto, @CurrentUser('sub') userId: number) {
    return this.taskService.claimTask(body, userId)
  }

  // 上报一条手动任务进度。
  @Post('progress')
  @ApiDoc({
    summary: '上报任务进度',
    model: Boolean,
  })
  async progress(
    @Body() body: TaskProgressDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.taskService.reportProgress(body, userId)
  }

  // 手动完成一条任务实例。
  @Post('complete')
  @ApiDoc({
    summary: '完成任务',
    model: Boolean,
  })
  async complete(@Body() body: IdDto, @CurrentUser('sub') userId: number) {
    return this.taskService.completeTask(body, userId)
  }
}
