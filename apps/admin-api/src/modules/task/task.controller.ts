import {
  BaseTaskAssignmentDto,
  BaseTaskDto,
  TaskService,
} from '@libs/growth'
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
  CreateTaskDto,
  QueryTaskAssignmentDto,
  QueryTaskDto,
  UpdateTaskDto,
  UpdateTaskStatusDto,
} from './dto/task.dto'

@ApiTags('任务管理/任务配置')
@Controller('admin/task')
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Post('create')
  @ApiDoc({
    summary: '创建任务',
    model: Boolean,
  })
  async create(
    @Body() body: CreateTaskDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.taskService.createTask(body, userId)
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
    return this.taskService.updateTask(body, userId)
  }

  @Post('update-status')
  @ApiDoc({
    summary: '更新任务状态',
    model: Boolean,
  })
  async updateStatus(@Body() body: UpdateTaskStatusDto) {
    return this.taskService.updateTaskStatus(body)
  }

  @Post('delete')
  @ApiDoc({
    summary: '删除任务',
    model: Boolean,
  })
  async delete(@Body() body: IdDto) {
    return this.taskService.deleteTask(body.id)
  }

  @Get('page')
  @ApiPageDoc({
    summary: '分页查询任务',
    model: BaseTaskDto,
  })
  async findPage(@Query() query: QueryTaskDto) {
    return this.taskService.getTaskPage(query)
  }

  @Get('detail')
  @ApiDoc({
    summary: '查询任务详情',
    model: BaseTaskDto,
  })
  async findDetail(@Query('id', ParseIntPipe) id: number) {
    return this.taskService.getTaskDetail(id)
  }

  @Get('assignment/page')
  @ApiPageDoc({
    summary: '分页查询任务领取记录',
    model: BaseTaskAssignmentDto,
  })
  async findAssignmentPage(@Query() query: QueryTaskAssignmentDto) {
    return this.taskService.getTaskAssignmentPage(query)
  }
}
