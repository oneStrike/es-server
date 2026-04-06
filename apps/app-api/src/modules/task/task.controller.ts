import { AvailableTaskPageItemDto, ClaimTaskDto, MyTaskPageItemDto, QueryAvailableTaskDto, QueryMyTaskDto, TaskCompleteDto, TaskProgressDto } from '@libs/growth/task/dto/task.dto';
import { TaskService } from '@libs/growth/task/task.service';
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators/api-doc.decorator';
import { CurrentUser } from '@libs/platform/decorators/current-user.decorator';
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('任务')
@Controller('app/task')
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Get('page')
  @ApiPageDoc({
    summary: '分页查询可领取任务',
    model: AvailableTaskPageItemDto,
  })
  async getAvailable(
    @Query() query: QueryAvailableTaskDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.taskService.getAvailableTasks(query, userId)
  }

  @Get('my/page')
  @ApiPageDoc({
    summary: '分页查询我的任务',
    model: MyTaskPageItemDto,
  })
  async getMyTasks(
    @Query() query: QueryMyTaskDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.taskService.getMyTasks(query, userId)
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
    return this.taskService.claimTask(body, userId)
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
    return this.taskService.reportProgress(body, userId)
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
    return this.taskService.completeTask(body, userId)
  }
}
