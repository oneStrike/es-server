import type {
  CreateNotificationTemplateInput,
  QueryNotificationTemplatePageInput,
  UpdateNotificationTemplateEnabledInput,
  UpdateNotificationTemplateInput,
} from '@libs/message/notification'
import {
  getMessageNotificationTypeLabel,
  MessageNotificationTemplateService,
} from '@libs/message/notification'
import { Injectable } from '@nestjs/common'

/**
 * 管理端通知模板服务
 * 负责拼装管理端返回视图，底层配置与渲染逻辑仍复用消息域模板服务
 */
@Injectable()
export class MessageTemplateService {
  constructor(
    private readonly messageNotificationTemplateService: MessageNotificationTemplateService,
  ) {}

  /**
   * 获取通知模板分页
   * 在表字段基础上补充通知类型中文标签，方便管理端直接展示
   */
  async getNotificationTemplatePage(query: QueryNotificationTemplatePageInput) {
    const page
      = await this.messageNotificationTemplateService.getNotificationTemplatePage(
        query,
      )

    return {
      ...page,
      list: page.list.map((item) => this.mapTemplateView(item)),
    }
  }

  /**
   * 获取通知模板详情
   * 详情页与分页项使用同一映射口径，避免管理端两套文案解释
   */
  async getNotificationTemplateDetail(id: number) {
    const template
      = await this.messageNotificationTemplateService.getNotificationTemplateDetail(
        id,
      )
    return this.mapTemplateView(template)
  }

  /**
   * 创建通知模板
   * 模板键由底层服务根据通知类型稳定推导
   */
  async createNotificationTemplate(input: CreateNotificationTemplateInput) {
    return this.messageNotificationTemplateService.createNotificationTemplate(
      input,
    )
  }

  /**
   * 更新通知模板
   * 管理端仅透传可编辑字段，实际约束由消息域模板服务统一执行
   */
  async updateNotificationTemplate(input: UpdateNotificationTemplateInput) {
    return this.messageNotificationTemplateService.updateNotificationTemplate(
      input,
    )
  }

  /**
   * 更新通知模板启用状态
   * 供运营快速停用异常模板，而不需要改动正文配置
   */
  async updateNotificationTemplateEnabled(
    input: UpdateNotificationTemplateEnabledInput,
  ) {
    return this.messageNotificationTemplateService.updateNotificationTemplateEnabled(
      input,
    )
  }

  /**
   * 删除通知模板
   * 删除后通知主链路会自动回退到业务 fallback 文案
   */
  async deleteNotificationTemplate(id: number) {
    return this.messageNotificationTemplateService.deleteNotificationTemplate(id)
  }

  /**
   * 映射管理端通知模板视图
   * 在稳定表字段上补充 label，避免每个调用方重复做枚举解释
   */
  private mapTemplateView(
    template: Awaited<
      ReturnType<MessageNotificationTemplateService['getNotificationTemplateDetail']>
    >,
  ) {
    return {
      ...template,
      notificationTypeLabel: getMessageNotificationTypeLabel(
        template.notificationType,
      ),
    }
  }
}
