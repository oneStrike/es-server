import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/platform/decorators'
import { AuditActionTypeEnum } from '@libs/platform/modules/audit/audit-action.constant'
import { BackgroundTaskService } from '@libs/platform/modules/background-task/background-task.service'
import {
  BackgroundTaskDto,
  BackgroundTaskIdDto,
  BackgroundTaskNotificationDto,
  BackgroundTaskPageRequestDto,
} from '@libs/platform/modules/background-task/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ApiAuditDoc } from '../../common/decorators/api-audit-doc.decorator'

@ApiTags('系统管理/后台任务')
@Controller('admin/background-task')
export class AdminBackgroundTaskController {
  // 初始化后台任务 controller 依赖。
  constructor(private readonly backgroundTaskService: BackgroundTaskService) {}

  @Get('page')
  @ApiPageDoc({
    summary: '分页查询后台任务',
    model: BackgroundTaskDto,
  })
  // 分页查询后台任务。
  async getTaskPage(@Query() query: BackgroundTaskPageRequestDto) {
    return this.backgroundTaskService.getTaskPage(query)
  }

  @Get('my/page')
  @ApiPageDoc({
    summary: '分页查询我的后台任务通知',
    model: BackgroundTaskNotificationDto,
  })
  // 分页查询当前后台管理员的轻量后台任务通知。
  async getMyTaskPage(
    @Query() query: BackgroundTaskPageRequestDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.backgroundTaskService.getMyTaskPage(query, userId)
  }

  @Get('detail')
  @ApiDoc({
    summary: '查询后台任务详情',
    model: BackgroundTaskDto,
  })
  // 查询后台任务详情。
  async getTaskDetail(@Query() query: BackgroundTaskIdDto) {
    return this.backgroundTaskService.getTaskDetail(query)
  }

  @Post('cancel')
  @ApiAuditDoc({
    summary: '取消后台任务',
    model: BackgroundTaskDto,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  // 取消后台任务。
  async cancelTask(@Body() body: BackgroundTaskIdDto) {
    return this.backgroundTaskService.cancelTask(body)
  }

  @Post('retry')
  @ApiAuditDoc({
    summary: '重试后台任务',
    model: BackgroundTaskDto,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  // 重试后台任务。
  async retryTask(@Body() body: BackgroundTaskIdDto) {
    return this.backgroundTaskService.retryTask(body)
  }
}
