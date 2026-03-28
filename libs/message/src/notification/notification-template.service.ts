import type { SQL } from 'drizzle-orm'
import type {
  CreateNotificationTemplateInput,
  NotificationTemplateRenderContext,
  NotificationTemplateRenderResult,
  QueryNotificationTemplatePageInput,
  RenderNotificationTemplateInput,
  UpdateNotificationTemplateEnabledInput,
  UpdateNotificationTemplateInput,
} from './notification-template.type'
import { DrizzleService } from '@db/core'
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { and, eq } from 'drizzle-orm'
import {
  getMessageNotificationTemplateDefinition,
  getMessageNotificationTemplateKey,
  MessageNotificationTypeEnum,
} from './notification.constant'

const TEMPLATE_PLACEHOLDER_REGEXP = /\{\{\s*([\w.]+)\s*\}\}/g

/**
 * 通知模板服务
 * 负责模板配置 CRUD、稳定模板键推导以及通知文案渲染与 fallback
 */
@Injectable()
export class MessageNotificationTemplateService {
  private readonly logger = new Logger(MessageNotificationTemplateService.name)

  constructor(private readonly drizzle: DrizzleService) {}

  private get db() {
    return this.drizzle.db
  }

  private get notificationTemplate() {
    return this.drizzle.schema.notificationTemplate
  }

  /**
   * 分页查询通知模板
   * 当前仅支持按通知类型、模板键和启用状态筛选
   */
  async getNotificationTemplatePage(query: QueryNotificationTemplatePageInput) {
    const conditions: SQL[] = []

    if (query.notificationType !== undefined) {
      this.ensureSupportedNotificationType(query.notificationType)
      conditions.push(
        eq(this.notificationTemplate.notificationType, query.notificationType),
      )
    }
    if (query.templateKey?.trim()) {
      conditions.push(
        eq(this.notificationTemplate.templateKey, query.templateKey.trim()),
      )
    }
    if (query.isEnabled !== undefined) {
      conditions.push(eq(this.notificationTemplate.isEnabled, query.isEnabled))
    }

    return this.drizzle.ext.findPagination(this.notificationTemplate, {
      where: conditions.length > 0 ? and(...conditions) : undefined,
      pageIndex: query.pageIndex,
      pageSize: query.pageSize,
      orderBy: [
        { updatedAt: 'desc' as const },
        { id: 'asc' as const },
      ],
    })
  }

  /**
   * 获取通知模板详情
   * 不存在时抛出显式业务异常，便于管理端直接展示
   */
  async getNotificationTemplateDetail(id: number) {
    const template = await this.db.query.notificationTemplate.findFirst({
      where: { id },
    })
    if (!template) {
      throw new NotFoundException('通知模板不存在')
    }
    return template
  }

  /**
   * 创建通知模板
   * 模板键始终由通知类型推导，避免管理端写入漂移键值
   */
  async createNotificationTemplate(input: CreateNotificationTemplateInput) {
    const notificationType = this.ensureSupportedNotificationType(
      input.notificationType,
    )
    const templateKey = getMessageNotificationTemplateKey(notificationType)

    try {
      await this.drizzle.withErrorHandling(() =>
        this.db.insert(this.notificationTemplate).values({
          notificationType,
          templateKey,
          titleTemplate: this.normalizeTemplateText(
            input.titleTemplate,
            '通知标题模板不能为空',
          ),
          contentTemplate: this.normalizeTemplateText(
            input.contentTemplate,
            '通知正文模板不能为空',
          ),
          isEnabled: input.isEnabled ?? true,
          remark: this.normalizeRemark(input.remark),
        }),
      )
    } catch (error) {
      if (this.drizzle.isUniqueViolation(error)) {
        throw new BadRequestException('该通知类型的模板已存在')
      }
      throw error
    }

    return true
  }

  /**
   * 更新通知模板
   * 若通知类型变化，会同步重算模板键并保持一类通知一份模板的约束
   */
  async updateNotificationTemplate(input: UpdateNotificationTemplateInput) {
    await this.getNotificationTemplateDetail(input.id)

    const updateData: Partial<typeof this.notificationTemplate.$inferInsert> = {}
    if (input.notificationType !== undefined) {
      const notificationType = this.ensureSupportedNotificationType(
        input.notificationType,
      )
      updateData.notificationType = notificationType
      updateData.templateKey = getMessageNotificationTemplateKey(notificationType)
    }
    if (input.titleTemplate !== undefined) {
      updateData.titleTemplate = this.normalizeTemplateText(
        input.titleTemplate,
        '通知标题模板不能为空',
      )
    }
    if (input.contentTemplate !== undefined) {
      updateData.contentTemplate = this.normalizeTemplateText(
        input.contentTemplate,
        '通知正文模板不能为空',
      )
    }
    if (input.isEnabled !== undefined) {
      updateData.isEnabled = input.isEnabled
    }
    if (input.remark !== undefined) {
      updateData.remark = this.normalizeRemark(input.remark)
    }

    if (Object.keys(updateData).length === 0) {
      return true
    }

    try {
      const result = await this.drizzle.withErrorHandling(() =>
        this.db
          .update(this.notificationTemplate)
          .set(updateData)
          .where(eq(this.notificationTemplate.id, input.id)),
      )
      this.drizzle.assertAffectedRows(result, '通知模板不存在')
    } catch (error) {
      if (this.drizzle.isUniqueViolation(error)) {
        throw new BadRequestException('该通知类型的模板已存在')
      }
      throw error
    }

    return true
  }

  /**
   * 更新通知模板启用状态
   * 单独拆出开关接口，方便运营不改文案时直接停用模板
   */
  async updateNotificationTemplateEnabled(
    input: UpdateNotificationTemplateEnabledInput,
  ) {
    const result = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.notificationTemplate)
        .set({ isEnabled: input.isEnabled })
        .where(eq(this.notificationTemplate.id, input.id)),
    )
    this.drizzle.assertAffectedRows(result, '通知模板不存在')
    return true
  }

  /**
   * 删除通知模板
   * 删除后通知主链路仍会继续使用业务方 fallback 文案发送
   */
  async deleteNotificationTemplate(id: number) {
    const result = await this.drizzle.withErrorHandling(() =>
      this.db
        .delete(this.notificationTemplate)
        .where(eq(this.notificationTemplate.id, id)),
    )
    this.drizzle.assertAffectedRows(result, '通知模板不存在')
    return true
  }

  /**
   * 渲染通知文案
   * 模板缺失、禁用或渲染失败时统一回退到 outbox payload 中的 fallback 文案
   */
  async renderNotificationTemplate(
    input: RenderNotificationTemplateInput,
  ): Promise<NotificationTemplateRenderResult> {
    const notificationType = this.ensureSupportedNotificationType(input.type)
    const templateKey = getMessageNotificationTemplateKey(notificationType)
    const fallback = {
      title: input.title,
      content: input.content,
      templateKey,
      usedTemplate: false,
    } satisfies NotificationTemplateRenderResult

    const template = await this.db.query.notificationTemplate.findFirst({
      where: {
        notificationType,
        isEnabled: true,
      },
    })
    if (!template) {
      return {
        ...fallback,
        fallbackReason: 'missing_or_disabled',
      }
    }

    try {
      const context = this.buildRenderContext(input, templateKey)
      return {
        title: this.renderTemplateText(
          template.titleTemplate,
          context,
          'titleTemplate',
          200,
        ),
        content: this.renderTemplateText(
          template.contentTemplate,
          context,
          'contentTemplate',
          1000,
        ),
        templateId: template.id,
        templateKey,
        usedTemplate: true,
      }
    } catch (error) {
      this.logger.warn(
        `notification template render failed: templateKey=${templateKey}, templateId=${template.id}, reason=${this.stringifyError(error)}`,
      )
      return {
        ...fallback,
        templateId: template.id,
        fallbackReason: 'render_failed',
      }
    }
  }

  /**
   * 构建模板渲染上下文
   * 仅暴露当前通知 payload 的最小字段，避免模板层侵入业务主链路判断
   */
  private buildRenderContext(
    input: RenderNotificationTemplateInput,
    templateKey: string,
  ): NotificationTemplateRenderContext {
    return {
      notificationType: input.type,
      templateKey,
      receiverUserId: input.receiverUserId,
      actorUserId: input.actorUserId,
      targetType: input.targetType,
      targetId: input.targetId,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      aggregateKey: input.aggregateKey,
      aggregateCount: input.aggregateCount,
      expiredAt: input.expiredAt,
      payload: input.payload,
    }
  }

  /**
   * 渲染单个模板字符串
   * 当前仅支持 `{{path.to.value}}` 形式的轻量变量替换；变量缺失时视为模板异常
   */
  private renderTemplateText(
    templateText: string,
    context: NotificationTemplateRenderContext,
    fieldName: 'titleTemplate' | 'contentTemplate',
    maxLength: number,
  ) {
    const rendered = templateText.replace(
      TEMPLATE_PLACEHOLDER_REGEXP,
      (_fullMatch, path: string) => {
        const value = this.resolveContextValue(context, path)
        if (value === undefined || value === null) {
          throw new TypeError(`模板变量缺失: ${path}`)
        }
        if (typeof value === 'object') {
          throw new TypeError(`模板变量不支持对象值: ${path}`)
        }
        return String(value)
      },
    )

    if (rendered.length > maxLength) {
      throw new Error(`${fieldName} 渲染结果超过长度限制`)
    }

    return rendered
  }

  /**
   * 解析模板变量路径
   * 仅支持按对象属性逐级读取，不做函数调用或表达式求值
   */
  private resolveContextValue(
    context: NotificationTemplateRenderContext,
    path: string,
  ) {
    return path.split('.').reduce<unknown>((current, key) => {
      if (current === undefined || current === null) {
        return undefined
      }
      if (typeof current !== 'object') {
        return undefined
      }
      return (current as Record<string, unknown>)[key]
    }, context)
  }

  /**
   * 规范化模板文本
   * 空白字符串会被拒绝，避免写入无法使用的模板内容
   */
  private normalizeTemplateText(value: string, errorMessage: string) {
    const normalized = value.trim()
    if (!normalized) {
      throw new BadRequestException(errorMessage)
    }
    return normalized
  }

  /**
   * 规范化备注字段
   * 空字符串统一回写为 null，避免在表中混入无意义空值
   */
  private normalizeRemark(value?: string | null) {
    if (value === undefined) {
      return undefined
    }
    const normalized = value?.trim()
    return normalized || null
  }

  /**
   * 校验通知类型是否已注册模板定义
   * 以统一定义层阻断模板键与通知类型的漂移
   */
  private ensureSupportedNotificationType(value: unknown) {
    const notificationType = Number(value)
    if (!Number.isInteger(notificationType)) {
      throw new BadRequestException('通知类型非法')
    }
    try {
      getMessageNotificationTemplateDefinition(
        notificationType as MessageNotificationTypeEnum,
      )
    } catch {
      throw new BadRequestException('通知类型非法')
    }
    return notificationType as MessageNotificationTypeEnum
  }

  /**
   * 序列化模板渲染异常
   * 仅用于 warning 日志，避免异常对象影响主链路 fallback
   */
  private stringifyError(error: unknown) {
    if (error instanceof Error) {
      return error.message
    }
    if (typeof error === 'string') {
      return error
    }
    try {
      return JSON.stringify(error)
    } catch {
      return 'unknown error'
    }
  }
}
