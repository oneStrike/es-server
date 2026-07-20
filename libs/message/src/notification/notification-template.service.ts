import type { SQL } from 'drizzle-orm'
import type {
  CreateNotificationTemplateDto,
  PreviewNotificationTemplateDto,
  QueryNotificationTemplatePageDto,
  UpdateNotificationTemplateDto,
  UpdateNotificationTemplateEnabledDto,
} from './dto/notification-template.dto'
import type { NotificationUserSnapshot } from './notification-contract.type'
import type {
  NotificationTemplateContextValue,
  NotificationTemplateRenderContext,
  NotificationTemplateRenderResult,
  RenderNotificationTemplateInput,
} from './notification-template.type'
import type { MessageNotificationCategoryKey } from './notification.type'
import { DrizzleService, PostgresErrorCode, toPageResult } from '@db/core'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { buildDateOnlyRangeInAppTimeZone } from '@libs/platform/utils'
import { Injectable, Logger } from '@nestjs/common'
import { and, eq, gte, lt } from 'drizzle-orm'
import { MESSAGE_NOTIFICATION_CATEGORY_KEYS } from './notification.constant'

const TEMPLATE_PLACEHOLDER_REGEXP = /\{\{\s*([\w.]+)\s*\}\}/g
const NOTIFICATION_TEMPLATE_PLACEHOLDER_ALLOWLIST: Record<
  MessageNotificationCategoryKey,
  ReadonlySet<string>
> = {
  comment_reply: new Set(['actor.nickname', 'data.object.snippet']),
  comment_mention: new Set(['actor.nickname', 'data.object.snippet']),
  comment_like: new Set(['actor.nickname', 'data.object.snippet']),
  topic_like: new Set(['actor.nickname', 'data.object.title']),
  topic_favorited: new Set(['actor.nickname', 'data.object.title']),
  topic_commented: new Set(['actor.nickname', 'data.object.snippet']),
  topic_mentioned: new Set(['actor.nickname', 'data.object.title']),
  user_followed: new Set(['actor.nickname']),
  system_announcement: new Set(['title', 'content']),
  task_reminder: new Set(['title', 'content']),
}

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

  // 通知模板管理端的完整当前 contract，显式固定表字段以避免默认查询随 schema 演进扩张。
  private buildNotificationTemplateReadSelect() {
    return {
      id: this.notificationTemplate.id,
      categoryKey: this.notificationTemplate.categoryKey,
      titleTemplate: this.notificationTemplate.titleTemplate,
      contentTemplate: this.notificationTemplate.contentTemplate,
      isEnabled: this.notificationTemplate.isEnabled,
      remark: this.notificationTemplate.remark,
      createdAt: this.notificationTemplate.createdAt,
      updatedAt: this.notificationTemplate.updatedAt,
    }
  }

  private getNotificationTemplateReadColumns() {
    return {
      id: true,
      categoryKey: true,
      titleTemplate: true,
      contentTemplate: true,
      isEnabled: true,
      remark: true,
      createdAt: true,
      updatedAt: true,
    } as const
  }

  async getNotificationTemplatePage(query: QueryNotificationTemplatePageDto) {
    const conditions: SQL[] = []

    if (query.categoryKey !== undefined) {
      const categoryKey = this.ensureSupportedCategoryKey(query.categoryKey)
      conditions.push(eq(this.notificationTemplate.categoryKey, categoryKey))
    }
    if (query.isEnabled !== undefined) {
      conditions.push(eq(this.notificationTemplate.isEnabled, query.isEnabled))
    }
    const dateRange = buildDateOnlyRangeInAppTimeZone(
      query.startDate,
      query.endDate,
    )
    if (dateRange?.gte) {
      conditions.push(gte(this.notificationTemplate.updatedAt, dateRange.gte))
    }
    if (dateRange?.lt) {
      conditions.push(lt(this.notificationTemplate.updatedAt, dateRange.lt))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined
    const page = this.drizzle.buildPage(query)
    const orderQuery = this.drizzle.buildOrderBy(
      query.orderBy?.trim()
        ? query.orderBy
        : [{ updatedAt: 'desc' as const }, { id: 'desc' as const }],
      { table: this.notificationTemplate },
    )
    const [list, total] = await Promise.all([
      this.db
        .select(this.buildNotificationTemplateReadSelect())
        .from(this.notificationTemplate)
        .where(where)
        .orderBy(...orderQuery.orderBySql)
        .limit(page.limit)
        .offset(page.offset),
      this.db.$count(this.notificationTemplate, where),
    ])

    return toPageResult(list, total, page)
  }

  async getNotificationTemplateDetail(id: number) {
    const template = await this.db.query.notificationTemplate.findFirst({
      where: { id },
      columns: this.getNotificationTemplateReadColumns(),
    })
    if (!template) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '通知模板不存在',
      )
    }
    return template
  }

  async createNotificationTemplate(input: CreateNotificationTemplateDto) {
    const categoryKey = this.ensureSupportedCategoryKey(input.categoryKey)
    const titleTemplate = this.normalizeTemplateText(
      input.titleTemplate,
      '通知标题模板不能为空',
    )
    const contentTemplate = this.normalizeTemplateText(
      input.contentTemplate,
      '通知正文模板不能为空',
    )
    this.ensureTemplatePlaceholdersValid(
      categoryKey,
      titleTemplate,
      'titleTemplate',
    )
    this.ensureTemplatePlaceholdersValid(
      categoryKey,
      contentTemplate,
      'contentTemplate',
    )

    try {
      await this.drizzle.withErrorHandling(() =>
        this.db.insert(this.notificationTemplate).values({
          categoryKey,
          titleTemplate,
          contentTemplate,
          isEnabled: input.isEnabled ?? true,
          remark: this.normalizeRemark(input.remark),
        }),
      )
    } catch (error) {
      this.throwIfTemplateCategoryAlreadyExists(error)
      throw error
    }

    return true
  }

  async updateNotificationTemplate(input: UpdateNotificationTemplateDto) {
    const current = await this.getNotificationTemplateDetail(input.id)
    const currentCategoryKey = this.ensureSupportedCategoryKey(
      current.categoryKey,
    )
    const nextTitleTemplate =
      input.titleTemplate !== undefined
        ? this.normalizeTemplateText(
            input.titleTemplate,
            '通知标题模板不能为空',
          )
        : current.titleTemplate
    const nextContentTemplate =
      input.contentTemplate !== undefined
        ? this.normalizeTemplateText(
            input.contentTemplate,
            '通知正文模板不能为空',
          )
        : current.contentTemplate

    this.ensureTemplatePlaceholdersValid(
      currentCategoryKey,
      nextTitleTemplate,
      'titleTemplate',
    )
    this.ensureTemplatePlaceholdersValid(
      currentCategoryKey,
      nextContentTemplate,
      'contentTemplate',
    )

    const updateData: Partial<typeof this.notificationTemplate.$inferInsert> =
      {}
    if (input.titleTemplate !== undefined) {
      updateData.titleTemplate = nextTitleTemplate
    }
    if (input.contentTemplate !== undefined) {
      updateData.contentTemplate = nextContentTemplate
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
      await this.drizzle.withErrorHandling(
        () =>
          this.db
            .update(this.notificationTemplate)
            .set(updateData)
            .where(eq(this.notificationTemplate.id, input.id)),
        { notFound: '通知模板不存在' },
      )
    } catch (error) {
      this.throwIfTemplateCategoryAlreadyExists(error)
      throw error
    }

    return true
  }

  async updateNotificationTemplateEnabled(
    input: UpdateNotificationTemplateEnabledDto,
  ) {
    const current = await this.getNotificationTemplateDetail(input.id)
    this.ensureSupportedCategoryKey(current.categoryKey)
    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.notificationTemplate)
          .set({ isEnabled: input.isEnabled })
          .where(eq(this.notificationTemplate.id, input.id)),
      { notFound: '通知模板不存在' },
    )
    return true
  }

  async renderNotificationTemplate(
    input: RenderNotificationTemplateInput,
  ): Promise<NotificationTemplateRenderResult> {
    const categoryKey = this.ensureSupportedCategoryKey(input.categoryKey)
    const context = await this.buildRenderContext(input)
    const fallback = {
      title: input.title,
      content: input.content,
      categoryKey,
      actor: context.actor,
      usedTemplate: false,
    } satisfies NotificationTemplateRenderResult

    const template = await this.getEnabledNotificationTemplate(categoryKey)
    if (!template) {
      return {
        ...fallback,
        fallbackReason: 'missing_or_disabled',
      }
    }

    try {
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
        categoryKey,
        actor: context.actor,
        templateId: template.id,
        usedTemplate: true,
      }
    } catch (error) {
      this.logger.warn(
        `notification template render failed: categoryKey=${categoryKey}, templateId=${template.id}, reason=${this.stringifyError(error)}`,
      )
      return {
        ...fallback,
        templateId: template.id,
        fallbackReason: 'render_failed',
      }
    }
  }

  async previewNotificationTemplate(input: PreviewNotificationTemplateDto) {
    const categoryKey = this.ensureSupportedCategoryKey(input.categoryKey)
    const titleTemplate = this.normalizeTemplateText(
      input.titleTemplate,
      '通知标题模板不能为空',
    )
    const contentTemplate = this.normalizeTemplateText(
      input.contentTemplate,
      '通知正文模板不能为空',
    )
    this.ensureTemplatePlaceholdersValid(
      categoryKey,
      titleTemplate,
      'titleTemplate',
    )
    this.ensureTemplatePlaceholdersValid(
      categoryKey,
      contentTemplate,
      'contentTemplate',
    )

    const context = this.buildPreviewContext(categoryKey)
    try {
      return {
        title: this.renderTemplateText(
          titleTemplate,
          context,
          'titleTemplate',
          200,
        ),
        content: this.renderTemplateText(
          contentTemplate,
          context,
          'contentTemplate',
          1000,
        ),
        categoryKey,
        usedTemplate: true,
      } satisfies NotificationTemplateRenderResult
    } catch (error) {
      this.logger.warn(
        `notification template preview failed: categoryKey=${categoryKey}, reason=${this.stringifyError(error)}`,
      )
      return {
        title: context.title,
        content: context.content,
        categoryKey,
        usedTemplate: false,
        fallbackReason: 'render_failed',
      } satisfies NotificationTemplateRenderResult
    }
  }

  private async buildRenderContext(
    input: RenderNotificationTemplateInput,
  ): Promise<NotificationTemplateRenderContext> {
    let actor: NotificationUserSnapshot | undefined
    if (typeof input.actorUserId === 'number') {
      const actorRecord = await this.db.query.appUser.findFirst({
        where: {
          id: input.actorUserId,
        },
        columns: {
          id: true,
          nickname: true,
          avatarUrl: true,
        },
      })
      if (actorRecord) {
        actor = {
          id: actorRecord.id,
          nickname: actorRecord.nickname,
          avatarUrl: actorRecord.avatarUrl,
        }
      }
    }

    return {
      categoryKey: input.categoryKey,
      receiverUserId: input.receiverUserId,
      actorUserId: input.actorUserId,
      actor,
      title: input.title,
      content: input.content,
      expiresAt: input.expiresAt,
      data: input.data ?? null,
    }
  }

  private buildPreviewContext(
    categoryKey: MessageNotificationCategoryKey,
  ): NotificationTemplateRenderContext {
    return {
      categoryKey,
      receiverUserId: 10001,
      actorUserId: 10002,
      actor: {
        id: 10002,
        nickname: '示例用户',
        avatarUrl: null,
      },
      title: '示例通知标题',
      content: '示例通知正文',
      data: {
        object: {
          title: '示例作品标题',
          snippet: '这是一段用于预览模板变量的示例内容',
        },
        reminder: {
          kind: 'reward_granted',
        },
      },
    }
  }

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

  private resolveContextValue(
    context: NotificationTemplateRenderContext,
    path: string,
  ) {
    let current: NotificationTemplateContextValue = context

    for (const key of path.split('.')) {
      if (current === undefined || current === null) {
        return undefined
      }
      if (typeof current !== 'object') {
        return undefined
      }
      current = (current as Record<string, unknown>)[
        key
      ] as NotificationTemplateContextValue
    }

    return current
  }

  private normalizeTemplateText(value: string, errorMessage: string) {
    const normalized = value.trim()
    if (!normalized) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        errorMessage,
      )
    }
    return normalized
  }

  private async getEnabledNotificationTemplate(
    categoryKey: MessageNotificationCategoryKey,
  ) {
    return this.db.query.notificationTemplate.findFirst({
      where: {
        categoryKey,
        isEnabled: true,
      },
      columns: {
        id: true,
        titleTemplate: true,
        contentTemplate: true,
      },
    })
  }

  private throwIfTemplateCategoryAlreadyExists(error: unknown): void {
    const facts = this.drizzle.classifyError(error)
    if (
      facts?.sqlState !== PostgresErrorCode.UNIQUE_VIOLATION ||
      facts.constraint !== 'notification_template_category_key_key'
    ) {
      return
    }

    throw new BusinessException(
      BusinessErrorCode.RESOURCE_ALREADY_EXISTS,
      '该通知分类的模板已存在',
      { cause: error },
    )
  }

  private ensureTemplatePlaceholdersValid(
    categoryKey: MessageNotificationCategoryKey,
    templateText: string,
    fieldName: 'titleTemplate' | 'contentTemplate',
  ) {
    const allowedPlaceholders =
      NOTIFICATION_TEMPLATE_PLACEHOLDER_ALLOWLIST[categoryKey]
    const placeholders = new Set(
      Array.from(
        templateText.matchAll(TEMPLATE_PLACEHOLDER_REGEXP),
        (match) => match[1],
      ),
    )

    for (const path of placeholders) {
      if (!allowedPlaceholders.has(path)) {
        throw new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          `${fieldName} 存在当前通知分类不支持的占位符: ${path}`,
        )
      }
    }
  }

  private normalizeRemark(value?: string | null) {
    if (value === undefined) {
      return undefined
    }
    const normalized = value?.trim()
    return normalized || null
  }

  private ensureSupportedCategoryKey(
    value: unknown,
  ): MessageNotificationCategoryKey {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '通知分类非法',
      )
    }
    const categoryKey = value.trim() as MessageNotificationCategoryKey
    if (!MESSAGE_NOTIFICATION_CATEGORY_KEYS.includes(categoryKey)) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '通知分类非法',
      )
    }
    return categoryKey
  }

  private stringifyError(error: unknown): string {
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
