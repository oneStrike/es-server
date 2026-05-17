import { ContentImportService } from '@libs/content/work/content-import/content-import.service'
import {
  ContentImportItemDto,
  ContentImportItemPageRequestDto,
} from '@libs/content/work/content-import/dto/content-import.dto'
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators'
import { AuditActionTypeEnum } from '@libs/platform/modules/audit/audit-action.constant'
import {
  WorkflowExpireDto,
  WorkflowJobDetailDto,
  WorkflowJobDto,
  WorkflowJobIdDto,
  WorkflowJobPageRequestDto,
  WorkflowRetryItemsDto,
} from '@libs/platform/modules/workflow/dto'
import { WorkflowService } from '@libs/platform/modules/workflow/workflow.service'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ApiAuditDoc } from '../../common/decorators/api-audit-doc.decorator'

@ApiTags('系统管理/工作流')
@Controller('admin/workflow')
export class AdminWorkflowController {
  // 初始化工作流 controller 依赖。
  constructor(
    private readonly workflowService: WorkflowService,
    private readonly contentImportService: ContentImportService,
  ) {}

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

  @Get('item/page')
  @ApiPageDoc({
    summary: '分页查询工作流内容导入条目',
    model: ContentImportItemDto,
  })
  // 分页查询内容导入条目。
  async getItemPage(@Query() query: ContentImportItemPageRequestDto) {
    return this.contentImportService.getItemPage(query)
  }

  @Post('cancel')
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

  @Post('retry-items')
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
  @ApiAuditDoc({
    summary: '过期清理工作流 retained resource',
    model: WorkflowJobDto,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  // 过期清理失败工作流保留的临时资源。
  async expireJob(@Body() body: WorkflowExpireDto) {
    return this.workflowService.expireJob(body)
  }
}
