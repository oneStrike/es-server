import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators'
import { AuditActionTypeEnum } from '@libs/platform/modules/audit/audit-action.constant'
import {
  WorkflowItemDto,
  WorkflowItemPageRequestDto,
  WorkflowJobDetailDto,
  WorkflowJobDto,
  WorkflowJobIdDto,
  WorkflowJobPageRequestDto,
  WorkflowNotificationListRequestDto,
  WorkflowNotificationListResponseDto,
  WorkflowRecordDto,
  WorkflowRecordPageRequestDto,
  WorkflowRetryItemsDto,
  WorkflowTypeOptionsResponseDto,
} from '@libs/platform/modules/workflow/dto'
import { WorkflowService } from '@libs/platform/modules/workflow/workflow.service'
import { HttpCode, Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ApiAuditDoc } from '../../common/decorators/api-audit-doc.decorator'

@ApiTags('系统管理/工作流')
@Controller('admin/workflow')
export class AdminWorkflowController {
  // 初始化工作流 controller 依赖。
  constructor(private readonly workflowService: WorkflowService) {}

  @Get('page')
  @ApiPageDoc({
    summary: '分页查询工作流任务',
    model: WorkflowJobDto,
  })
  // 分页查询工作流任务。
  async getJobPage(@Query() query: WorkflowJobPageRequestDto) {
    return this.workflowService.getJobPage(query)
  }

  @Get('detail')
  @ApiDoc({
    summary: '查询工作流任务详情',
    model: WorkflowJobDetailDto,
  })
  // 查询工作流任务详情。
  async getJobDetail(@Query() query: WorkflowJobIdDto) {
    return this.workflowService.getJobDetail(query)
  }

  @Get('record/page')
  @ApiPageDoc({
    summary: '分页查询工作流处理记录',
    model: WorkflowRecordDto,
  })
  // 分页查询工作流处理记录。
  async getRecordPage(@Query() query: WorkflowRecordPageRequestDto) {
    return this.workflowService.getJobRecordPage(query)
  }

  @Get('notification/list')
  @ApiDoc({
    summary: '查询工作流通知列表',
    model: WorkflowNotificationListResponseDto,
  })
  // 查询后台全局工作流通知事实。
  async getNotificationList(
    @Query() query: WorkflowNotificationListRequestDto,
  ) {
    return this.workflowService.getNotificationList(query)
  }

  @Get('item/page')
  @ApiPageDoc({
    summary: '分页查询工作流条目',
    model: WorkflowItemDto,
  })
  // 分页查询工作流通用条目。
  async getItemPage(@Query() query: WorkflowItemPageRequestDto) {
    return this.workflowService.getItemPage(query)
  }

  @Get('type-options')
  @ApiDoc({
    summary: '查询工作流类型选项',
    model: WorkflowTypeOptionsResponseDto,
  })
  // 查询后台可用的工作流类型选项。
  async getWorkflowTypeOptions() {
    return this.workflowService.getWorkflowTypeOptions()
  }

  @Post('cancel')
  @HttpCode(200)
  @ApiAuditDoc({
    summary: '取消工作流任务',
    model: WorkflowJobDto,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  // 取消工作流任务。
  async cancelJob(@Body() body: WorkflowJobIdDto) {
    return this.workflowService.cancelJob(body)
  }

  @Post('archive')
  @HttpCode(200)
  @ApiAuditDoc({
    summary: '归档工作流任务',
    model: WorkflowJobDto,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  // 归档终态工作流任务；仅隐藏默认列表，不清理 retained resource。
  async archiveJob(@Body() body: WorkflowJobIdDto) {
    return this.workflowService.archiveJob(body)
  }

  @Post('retry-items')
  @HttpCode(200)
  @ApiAuditDoc({
    summary: '重试工作流失败条目',
    model: WorkflowJobDto,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  // 在原工作流任务下重试选中的失败条目。
  async retryItems(@Body() body: WorkflowRetryItemsDto) {
    return this.workflowService.retryItems(body)
  }

  @Post('expire')
  @HttpCode(200)
  @ApiAuditDoc({
    summary: '过期清理工作流 retained resource',
    model: WorkflowJobDto,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  // 过期清理失败工作流保留的临时资源。
  async expireJob(@Body() body: WorkflowJobIdDto) {
    return this.workflowService.expireJob(body)
  }
}
