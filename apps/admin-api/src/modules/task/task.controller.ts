import type { JwtUserInfoInterface } from '@libs/base/types'
import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/base/decorators'
import { IdDto } from '@libs/base/dto'
import {
  BaseTaskAssignmentDto,
  BaseTaskDto,
  CreateTaskDto,
  QueryTaskAssignmentDto,
  QueryTaskDto,
  TaskService,
  UpdateTaskDto,
  UpdateTaskStatusDto,
} from '@libs/task'
import { Body, Controller, Get, ParseIntPipe, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('任务管理')
@Controller('admin/task')
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Post('/create')
  @ApiDoc({
    summary: '创建任务',
    model: IdDto,
  })
  async create(
    @Body() body: CreateTaskDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.taskService.createTask(body, user)
  }

  @Post('/update')
  @ApiDoc({
    summary: '更新任务',
    model: IdDto,
  })
  async update(
    @Body() body: UpdateTaskDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.taskService.updateTask(body, user)
  }

  @Post('/update-status')
  @ApiDoc({
    summary: '更新任务状态',
    model: IdDto,
  })
  async updateStatus(@Body() body: UpdateTaskStatusDto) {
    return this.taskService.updateTaskStatus(body)
  }

  @Post('/delete')
  @ApiDoc({
    summary: '删除任务',
    model: IdDto,
  })
  async delete(@Body() body: IdDto) {
    return this.taskService.deleteTask(body.id)
  }

  @Get('/page')
  @ApiPageDoc({
    summary: '分页查询任务',
    model: BaseTaskDto,
  })
  async findPage(@Query() query: QueryTaskDto) {
    return this.taskService.getTaskPage(query)
  }

  @Get('/detail')
  @ApiDoc({
    summary: '查询任务详情',
    model: BaseTaskDto,
  })
  async findDetail(@Query('id', ParseIntPipe) id: number) {
    return this.taskService.getTaskDetail(id)
  }

  @Get('/assignment/page')
  @ApiPageDoc({
    summary: '分页查询任务领取记录',
    model: BaseTaskAssignmentDto,
  })
  async findAssignmentPage(@Query() query: QueryTaskAssignmentDto) {
    return this.taskService.getTaskAssignmentPage(query)
  }
}
