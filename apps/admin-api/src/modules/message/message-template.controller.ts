import { AdminMessageNotificationTemplateDto, CreateNotificationTemplateDto, QueryNotificationTemplatePageDto, UpdateNotificationTemplateDto, UpdateNotificationTemplateEnabledDto } from '@libs/message/notification/dto/notification-template.dto';
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators/api-doc.decorator';
import { IdDto } from '@libs/platform/dto/base.dto';
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AuditActionTypeEnum } from '../../common/audit/audit-action.constant'
import { ApiAuditDoc } from '../../common/decorators/api-audit-doc.decorator'
import { MessageTemplateService } from './message-template.service'

/**
 * 管理端通知模板控制器
 * 仅暴露模板配置 CRUD，不承载通知接收人、幂等或偏好判断
 */
@ApiTags('消息中心/通知模板')
@Controller('admin/message/notification-templates')
export class MessageTemplateController {
  constructor(private readonly messageTemplateService: MessageTemplateService) {}

  /**
   * 获取通知模板分页
   */
  @Get('page')
  @ApiPageDoc({
    summary: '分页查询通知模板',
    model: AdminMessageNotificationTemplateDto,
  })
  async getNotificationTemplatePage(
    @Query() query: QueryNotificationTemplatePageDto,
  ) {
    return this.messageTemplateService.getNotificationTemplatePage(query)
  }

  /**
   * 获取通知模板详情
   */
  @Get('detail')
  @ApiDoc({
    summary: '获取通知模板详情',
    model: AdminMessageNotificationTemplateDto,
  })
  async getNotificationTemplateDetail(@Query() query: IdDto) {
    return this.messageTemplateService.getNotificationTemplateDetail(query.id)
  }

  /**
   * 创建通知模板
   */
  @Post('create')
  @ApiAuditDoc({
    summary: '创建通知模板',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.CREATE,
    },
  })
  async createNotificationTemplate(
    @Body() body: CreateNotificationTemplateDto,
  ) {
    return this.messageTemplateService.createNotificationTemplate(body)
  }

  /**
   * 更新通知模板
   */
  @Post('update')
  @ApiAuditDoc({
    summary: '更新通知模板',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async updateNotificationTemplate(
    @Body() body: UpdateNotificationTemplateDto,
  ) {
    return this.messageTemplateService.updateNotificationTemplate(body)
  }

  /**
   * 更新通知模板启用状态
   */
  @Post('update-enabled')
  @ApiAuditDoc({
    summary: '更新通知模板启用状态',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async updateNotificationTemplateEnabled(
    @Body() body: UpdateNotificationTemplateEnabledDto,
  ) {
    return this.messageTemplateService.updateNotificationTemplateEnabled(body)
  }

  /**
   * 删除通知模板
   */
  @Post('delete')
  @ApiAuditDoc({
    summary: '删除通知模板',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.DELETE,
    },
  })
  async deleteNotificationTemplate(@Body() body: IdDto) {
    return this.messageTemplateService.deleteNotificationTemplate(body.id)
  }
}
