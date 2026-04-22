import {
  CreateTaskDefinitionDto,
  QueryTaskDefinitionPageDto,
  QueryTaskInstancePageDto,
  QueryTaskReconciliationPageDto,
  UpdateTaskDefinitionDto,
  UpdateTaskDefinitionStatusDto,
} from '@libs/growth/task/dto/task-admin.dto'
import { TaskTemplateOptionsResponseDto } from '@libs/growth/task/dto/task-template.dto'
import {
  AdminTaskDefinitionDetailDto,
  AdminTaskDefinitionListItemDto,
  AdminTaskReconciliationItemDto,
  TaskInstanceViewDto,
} from '@libs/growth/task/dto/task-view.dto'
import { TaskService } from '@libs/growth/task/task.service'
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators/api-doc.decorator'
import { CurrentUser } from '@libs/platform/decorators/current-user.decorator'
import { IdDto } from '@libs/platform/dto/base.dto'
import { AuditActionTypeEnum } from '@libs/platform/modules/audit/audit-action.constant'
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

@ApiTags('任务管理/任务配置')
@Controller('admin/task')
export class TaskController {
  // 注入任务域门面服务。
  constructor(private readonly taskService: TaskService) {}

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
  async findDetail(@Query('id', ParseIntPipe) id: number) {
    return this.taskService.getTaskDefinitionDetail(id)
  }

  // 分页查询任务实例列表。
  @Get('instance/page')
  @ApiPageDoc({
    summary: '分页查询任务实例记录',
    model: TaskInstanceViewDto,
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
}
