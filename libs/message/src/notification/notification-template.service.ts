import type { SQL } from 'drizzle-orm'
import type { NotificationUserSnapshot } from './notification-contract.type'
import type {
  NotificationTemplateRenderContext,
  NotificationTemplateRenderResult,
  RenderNotificationTemplateInput,
} from './notification-template.type'
import { DrizzleService } from '@db/core'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'
import {
  CreateNotificationTemplateDto,
  QueryNotificationTemplatePageDto,
  UpdateNotificationTemplateDto,
  UpdateNotificationTemplateEnabledDto,
} from './dto/notification-template.dto'
import {
  MESSAGE_NOTIFICATION_CATEGORY_KEYS,
  MessageNotificationCategoryKey,
} from './notification.constant'

const TEMPLATE_PLACEHOLDER_REGEXP = /\{\{\s*([\w.]+)\s*\}\}/g
const NOTIFICATION_TEMPLATE_CACHE_TTL_MS = 60 * 1000
const NOTIFICATION_TEMPLATE_ROOT_FIELD_ALLOWLIST = new Set([
  'categoryKey',
  'receiverUserId',
  'actorUserId',
  'title',
  'content',
  'expiresAt',
  'actor',
  'data',
])

interface NotificationTemplateCacheEntry {
  expiresAt: number
  template: {
    id: number
    titleTemplate: string
    contentTemplate: string
  } | null
}

type NotificationTemplateContextValue =
  | object
  | string
  | number
  | boolean
  | Date
  | undefined
  | null

@Injectable()
export class MessageNotificationTemplateService {
  private readonly logger = new Logger(MessageNotificationTemplateService.name)
  private readonly templateCache = new Map<
    MessageNotificationCategoryKey,
    NotificationTemplateCacheEntry
  >()

  constructor(private readonly drizzle: DrizzleService) {}

  private get db() {
    return this.drizzle.db
  }

  private get notificationTemplate() {
    return this.drizzle.schema.notificationTemplate
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

    return this.drizzle.ext.findPagination(this.notificationTemplate, {
      where: conditions.length > 0 ? and(...conditions) : undefined,
      pageIndex: query.pageIndex,
      pageSize: query.pageSize,
      orderBy: [{ updatedAt: 'desc' as const }, { id: 'asc' as const }],
    })
  }

  async getNotificationTemplateDetail(id: number) {
    const template = await this.db.query.notificationTemplate.findFirst({
      where: { id },
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
    this.ensureTemplatePlaceholdersValid(titleTemplate, 'titleTemplate')
    this.ensureTemplatePlaceholdersValid(contentTemplate, 'contentTemplate')

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
      if (this.drizzle.isUniqueViolation(error)) {
        throw new BusinessException(
          BusinessErrorCode.RESOURCE_ALREADY_EXISTS,
          '该通知分类的模板已存在',
        )
      }
      throw error
    }

    this.invalidateTemplateCache(categoryKey)
    return true
  }

  async updateNotificationTemplate(input: UpdateNotificationTemplateDto) {
    const current = await this.getNotificationTemplateDetail(input.id)
    const currentCategoryKey = this.ensureSupportedCategoryKey(
      current.categoryKey,
    )
    const nextCategoryKey =
      input.categoryKey !== undefined
        ? this.ensureSupportedCategoryKey(input.categoryKey)
        : currentCategoryKey
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

    this.ensureTemplatePlaceholdersValid(nextTitleTemplate, 'titleTemplate')
    this.ensureTemplatePlaceholdersValid(nextContentTemplate, 'contentTemplate')

    const updateData: Partial<typeof this.notificationTemplate.$inferInsert> =
      {}
    if (input.categoryKey !== undefined) {
      updateData.categoryKey = nextCategoryKey
    }
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
      if (this.drizzle.isUniqueViolation(error)) {
        throw new BusinessException(
          BusinessErrorCode.RESOURCE_ALREADY_EXISTS,
          '该通知分类的模板已存在',
        )
      }
      throw error
    }

    this.invalidateTemplateCache(currentCategoryKey)
    this.invalidateTemplateCache(nextCategoryKey)
    return true
  }

  async updateNotificationTemplateEnabled(
    input: UpdateNotificationTemplateEnabledDto,
  ) {
    const current = await this.getNotificationTemplateDetail(input.id)
    const categoryKey = this.ensureSupportedCategoryKey(current.categoryKey)
    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.notificationTemplate)
          .set({ isEnabled: input.isEnabled })
          .where(eq(this.notificationTemplate.id, input.id)),
      { notFound: '通知模板不存在' },
    )
    this.invalidateTemplateCache(categoryKey)
    return true
  }

  async deleteNotificationTemplate(id: number) {
    const current = await this.getNotificationTemplateDetail(id)
    const categoryKey = this.ensureSupportedCategoryKey(current.categoryKey)
    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .delete(this.notificationTemplate)
          .where(eq(this.notificationTemplate.id, id)),
      { notFound: '通知模板不存在' },
    )
    this.invalidateTemplateCache(categoryKey)
    return true
  }

  async renderNotificationTemplate(
    input: RenderNotificationTemplateInput,
  ): Promise<NotificationTemplateRenderResult> {
    const categoryKey = this.ensureSupportedCategoryKey(input.categoryKey)
    const fallback = {
      title: input.title,
      content: input.content,
      categoryKey,
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
      const context = await this.buildRenderContext(input)
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
          nickname: actorRecord.nickname ?? undefined,
          avatarUrl: actorRecord.avatarUrl ?? undefined,
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
      data: (input.data ?? null) as NotificationTemplateRenderContext['data'],
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
      throw new BadRequestException(errorMessage)
    }
    return normalized
  }

  private async getEnabledNotificationTemplate(
    categoryKey: MessageNotificationCategoryKey,
  ) {
    const cached = this.templateCache.get(categoryKey)
    if (cached && cached.expiresAt > Date.now()) {
      return cached.template
    }
    if (cached) {
      this.templateCache.delete(categoryKey)
    }

    const template = await this.db.query.notificationTemplate.findFirst({
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

    this.templateCache.set(categoryKey, {
      expiresAt: Date.now() + NOTIFICATION_TEMPLATE_CACHE_TTL_MS,
      template: template ?? null,
    })

    return template
  }

  private invalidateTemplateCache(categoryKey: MessageNotificationCategoryKey) {
    this.templateCache.delete(categoryKey)
  }

  private ensureTemplatePlaceholdersValid(
    templateText: string,
    fieldName: 'titleTemplate' | 'contentTemplate',
  ) {
    const placeholders = new Set(
      Array.from(
        templateText.matchAll(TEMPLATE_PLACEHOLDER_REGEXP),
        (match) => match[1],
      ),
    )

    for (const path of placeholders) {
      if (NOTIFICATION_TEMPLATE_ROOT_FIELD_ALLOWLIST.has(path)) {
        continue
      }
      if (!path.startsWith('data.') && !path.startsWith('actor.')) {
        throw new BadRequestException(`${fieldName} 存在非法占位符: ${path}`)
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

  private ensureSupportedCategoryKey<T>(value: T) {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException('通知分类非法')
    }
    const categoryKey = value.trim() as MessageNotificationCategoryKey
    if (!MESSAGE_NOTIFICATION_CATEGORY_KEYS.includes(categoryKey)) {
      throw new BadRequestException('通知分类非法')
    }
    return categoryKey
  }

  private stringifyError<T>(error: T) {
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
