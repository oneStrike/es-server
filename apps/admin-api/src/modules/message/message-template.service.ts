import type {
  CreateNotificationTemplateDto,
  PreviewNotificationTemplateDto,
  QueryNotificationTemplatePageDto,
  UpdateNotificationTemplateDto,
  UpdateNotificationTemplateEnabledDto,
} from '@libs/message/notification/dto/notification-template.dto'
import { MessageNotificationTemplateService } from '@libs/message/notification/notification-template.service'
import {
  getMessageNotificationCategoryLabel,
  isMessageNotificationCategoryKey,
} from '@libs/message/notification/notification.constant'
import { Injectable } from '@nestjs/common'

/**
 * 管理端通知模板服务。
 * 负责拼装管理端返回视图，底层配置与渲染逻辑复用消息域模板服务。
 */
@Injectable()
export class MessageTemplateService {
  constructor(
    private readonly messageNotificationTemplateService: MessageNotificationTemplateService,
  ) {}

  // 获取通知模板分页，补充通知分类中文标签。
  async getNotificationTemplatePage(query: QueryNotificationTemplatePageDto) {
    const page =
      await this.messageNotificationTemplateService.getNotificationTemplatePage(
        query,
      )

    return {
      ...page,
      list: page.list.map((item) => this.mapTemplateView(item)),
    }
  }

  // 获取通知模板详情，与分页项使用同一映射口径。
  async getNotificationTemplateDetail(id: number) {
    const template =
      await this.messageNotificationTemplateService.getNotificationTemplateDetail(
        id,
      )
    return this.mapTemplateView(template)
  }

  // 创建通知模板，模板键由底层服务根据通知类型推导。
  async createNotificationTemplate(input: CreateNotificationTemplateDto) {
    return this.messageNotificationTemplateService.createNotificationTemplate(
      input,
    )
  }

  // 更新通知模板，管理端仅透传可编辑字段。
  async updateNotificationTemplate(input: UpdateNotificationTemplateDto) {
    return this.messageNotificationTemplateService.updateNotificationTemplate(
      input,
    )
  }

  // 更新通知模板启用状态，供运营快速停用异常模板。
  async updateNotificationTemplateEnabled(
    input: UpdateNotificationTemplateEnabledDto,
  ) {
    return this.messageNotificationTemplateService.updateNotificationTemplateEnabled(
      input,
    )
  }

  // 预览通知模板，使用消息域真实渲染逻辑。
  async previewNotificationTemplate(input: PreviewNotificationTemplateDto) {
    const result =
      await this.messageNotificationTemplateService.previewNotificationTemplate(
        input,
      )
    return {
      title: result.title,
      content: result.content,
      usedTemplate: result.usedTemplate,
      fallbackReason: result.fallbackReason,
      categoryLabel: this.getCategoryLabel(result.categoryKey),
    }
  }

  // 映射管理端通知模板视图，在稳定表字段上补充 categoryLabel。
  private mapTemplateView(
    template: Awaited<
      ReturnType<
        MessageNotificationTemplateService['getNotificationTemplateDetail']
      >
    >,
  ) {
    return {
      ...template,
      categoryLabel: this.getCategoryLabel(template.categoryKey),
    }
  }

  // 获取通知分类中文标签，未知分类返回带 key 的提示。
  private getCategoryLabel(categoryKey: string) {
    if (!isMessageNotificationCategoryKey(categoryKey)) {
      return `未知分类(${categoryKey})`
    }
    return getMessageNotificationCategoryLabel(
      categoryKey,
    )
  }
}
