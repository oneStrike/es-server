import {
  AdminMessageNotificationTemplateDto,
  CreateNotificationTemplateDto,
  QueryNotificationTemplatePageDto,
  UpdateNotificationTemplateDto,
  UpdateNotificationTemplateEnabledDto,
} from '@libs/message/notification'
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators'
import { IdDto } from '@libs/platform/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Audit } from '../../common/decorators/audit.decorator'
import { AuditActionTypeEnum } from '../system/audit/audit.constant'
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
  @ApiDoc({
    summary: '创建通知模板',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.CREATE,
    content: '创建通知模板',
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
  @ApiDoc({
    summary: '更新通知模板',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.UPDATE,
    content: '更新通知模板',
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
  @ApiDoc({
    summary: '更新通知模板启用状态',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.UPDATE,
    content: '更新通知模板启用状态',
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
  @ApiDoc({
    summary: '删除通知模板',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.DELETE,
    content: '删除通知模板',
  })
  async deleteNotificationTemplate(@Body() body: IdDto) {
    return this.messageTemplateService.deleteNotificationTemplate(body.id)
  }
}
