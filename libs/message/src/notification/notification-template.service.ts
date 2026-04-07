import type { SQL } from 'drizzle-orm'
import type {
  NotificationTemplateRenderContext,
  NotificationTemplateRenderResult,
  RenderNotificationTemplateInput,
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
  CreateNotificationTemplateDto,
  QueryNotificationTemplatePageDto,
  UpdateNotificationTemplateDto,
  UpdateNotificationTemplateEnabledDto,
} from './dto/notification-template.dto'
import {
  getMessageNotificationTemplateDefinition,
  getMessageNotificationTemplateKey,
  MessageNotificationTypeEnum,
} from './notification.constant'

const TEMPLATE_PLACEHOLDER_REGEXP = /\{\{\s*([\w.]+)\s*\}\}/g
const NOTIFICATION_TEMPLATE_CACHE_TTL_MS = 60 * 1000
const NOTIFICATION_TEMPLATE_ROOT_FIELD_ALLOWLIST = new Set([
  'notificationType',
  'templateKey',
  'receiverUserId',
  'actorUserId',
  'targetType',
  'targetId',
  'subjectType',
  'subjectId',
  'aggregateKey',
  'aggregateCount',
  'expiredAt',
])
const NOTIFICATION_TEMPLATE_ALLOWED_PAYLOAD_FIELD_MAP = new Map<
  MessageNotificationTypeEnum,
  ReadonlySet<string>
>([
  [
    MessageNotificationTypeEnum.COMMENT_REPLY,
    new Set(['actorNickname', 'replyExcerpt', 'targetDisplayTitle']),
  ],
  [MessageNotificationTypeEnum.COMMENT_LIKE, new Set([])],
  [MessageNotificationTypeEnum.CONTENT_FAVORITE, new Set([])],
  [MessageNotificationTypeEnum.USER_FOLLOW, new Set([])],
  [MessageNotificationTypeEnum.SYSTEM_ANNOUNCEMENT, new Set(['title', 'content', 'announcementId'])],
  [MessageNotificationTypeEnum.CHAT_MESSAGE, new Set(['conversationId', 'content'])],
  [MessageNotificationTypeEnum.TASK_REMINDER, new Set(['title', 'content'])],
  [
    MessageNotificationTypeEnum.TOPIC_LIKE,
    new Set(['actorNickname', 'topicTitle']),
  ],
  [
    MessageNotificationTypeEnum.TOPIC_FAVORITE,
    new Set(['actorNickname', 'topicTitle']),
  ],
  [
    MessageNotificationTypeEnum.TOPIC_COMMENT,
    new Set(['actorNickname', 'topicTitle', 'commentExcerpt']),
  ],
])

interface NotificationTemplateCacheEntry {
  expiresAt: number
  template: {
    id: number
    titleTemplate: string
    contentTemplate: string
  } | null
}

/**
 * 通知模板服务
 * 负责模板配置 CRUD、稳定模板键推导以及通知文案渲染与 fallback
 */
@Injectable()
export class MessageNotificationTemplateService {
  private readonly logger = new Logger(MessageNotificationTemplateService.name)
  private readonly templateCache = new Map<
    MessageNotificationTypeEnum,
    NotificationTemplateCacheEntry
  >()

  constructor(private readonly drizzle: DrizzleService) {}

  /** 统一复用当前模块的 Drizzle 数据库实例。 */
  private get db() {
    return this.drizzle.db
  }

  /** notification_template 表访问入口。 */
  private get notificationTemplate() {
    return this.drizzle.schema.notificationTemplate
  }

  /**
   * 分页查询通知模板
   * 当前仅支持按通知类型、模板键和启用状态筛选
   */
  async getNotificationTemplatePage(query: QueryNotificationTemplatePageDto) {
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
  async createNotificationTemplate(input: CreateNotificationTemplateDto) {
    const notificationType = this.ensureSupportedNotificationType(
      input.notificationType,
    )
    const templateKey = getMessageNotificationTemplateKey(notificationType)
    const titleTemplate = this.normalizeTemplateText(
      input.titleTemplate,
      '通知标题模板不能为空',
    )
    const contentTemplate = this.normalizeTemplateText(
      input.contentTemplate,
      '通知正文模板不能为空',
    )
    this.ensureTemplatePlaceholdersValid(
      notificationType,
      titleTemplate,
      'titleTemplate',
    )
    this.ensureTemplatePlaceholdersValid(
      notificationType,
      contentTemplate,
      'contentTemplate',
    )

    try {
      await this.drizzle.withErrorHandling(() =>
        this.db.insert(this.notificationTemplate).values({
          notificationType,
          templateKey,
          titleTemplate,
          contentTemplate,
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

    this.invalidateTemplateCache(notificationType)
    return true
  }

  /**
   * 更新通知模板
   * 若通知类型变化，会同步重算模板键并保持一类通知一份模板的约束
   */
  async updateNotificationTemplate(input: UpdateNotificationTemplateDto) {
    const current = await this.getNotificationTemplateDetail(input.id)
    const currentNotificationType = this.ensureSupportedNotificationType(
      current.notificationType,
    )
    const nextNotificationType = input.notificationType !== undefined
      ? this.ensureSupportedNotificationType(input.notificationType)
      : currentNotificationType
    const nextTitleTemplate = input.titleTemplate !== undefined
      ? this.normalizeTemplateText(
        input.titleTemplate,
        '通知标题模板不能为空',
      )
      : current.titleTemplate
    const nextContentTemplate = input.contentTemplate !== undefined
      ? this.normalizeTemplateText(
        input.contentTemplate,
        '通知正文模板不能为空',
      )
      : current.contentTemplate
    this.ensureTemplatePlaceholdersValid(
      nextNotificationType,
      nextTitleTemplate,
      'titleTemplate',
    )
    this.ensureTemplatePlaceholdersValid(
      nextNotificationType,
      nextContentTemplate,
      'contentTemplate',
    )

    const updateData: Partial<typeof this.notificationTemplate.$inferInsert> = {}
    if (input.notificationType !== undefined) {
      updateData.notificationType = nextNotificationType
      updateData.templateKey = getMessageNotificationTemplateKey(nextNotificationType)
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
      await this.drizzle.withErrorHandling(() =>
        this.db
          .update(this.notificationTemplate)
          .set(updateData)
          .where(eq(this.notificationTemplate.id, input.id)), { notFound: '通知模板不存在' },)
    } catch (error) {
      if (this.drizzle.isUniqueViolation(error)) {
        throw new BadRequestException('该通知类型的模板已存在')
      }
      throw error
    }

    this.invalidateTemplateCache(currentNotificationType)
    this.invalidateTemplateCache(nextNotificationType)
    return true
  }

  /**
   * 更新通知模板启用状态
   * 单独拆出开关接口，方便运营不改文案时直接停用模板
   */
  async updateNotificationTemplateEnabled(
    input: UpdateNotificationTemplateEnabledDto,
  ) {
    const current = await this.getNotificationTemplateDetail(input.id)
    const notificationType = this.ensureSupportedNotificationType(
      current.notificationType,
    )
    await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.notificationTemplate)
        .set({ isEnabled: input.isEnabled })
        .where(eq(this.notificationTemplate.id, input.id)), { notFound: '通知模板不存在' },)
    this.invalidateTemplateCache(notificationType)
    return true
  }

  /**
   * 删除通知模板
   * 删除后通知主链路仍会继续使用业务方 fallback 文案发送
   */
  async deleteNotificationTemplate(id: number) {
    const current = await this.getNotificationTemplateDetail(id)
    const notificationType = this.ensureSupportedNotificationType(
      current.notificationType,
    )
    await this.drizzle.withErrorHandling(() =>
      this.db
        .delete(this.notificationTemplate)
        .where(eq(this.notificationTemplate.id, id)), { notFound: '通知模板不存在' },)
    this.invalidateTemplateCache(notificationType)
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

    const template = await this.getEnabledNotificationTemplate(notificationType)
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
   * 读取启用模板
   * 优先命中类型级本地缓存，并缓存“不存在模板”结果，避免 worker 链路重复查库。
   */
  private async getEnabledNotificationTemplate(
    notificationType: MessageNotificationTypeEnum,
  ) {
    const cached = this.templateCache.get(notificationType)
    if (cached && cached.expiresAt > Date.now()) {
      return cached.template
    }
    if (cached) {
      this.templateCache.delete(notificationType)
    }

    const template = await this.db.query.notificationTemplate.findFirst({
      where: {
        notificationType,
        isEnabled: true,
      },
      columns: {
        id: true,
        titleTemplate: true,
        contentTemplate: true,
      },
    })

    this.templateCache.set(notificationType, {
      expiresAt: Date.now() + NOTIFICATION_TEMPLATE_CACHE_TTL_MS,
      template: template ?? null,
    })

    return template
  }

  /**
   * 失效模板缓存
   * 模板增删改与启停切换成功后立即清理对应类型缓存，避免本地缓存继续返回旧模板。
   */
  private invalidateTemplateCache(notificationType: MessageNotificationTypeEnum) {
    this.templateCache.delete(notificationType)
  }

  /**
   * 校验模板占位符
   * 仅允许固定根字段与通知类型对应的 payload 字段，尽量把模板错误前移到保存期。
   */
  private ensureTemplatePlaceholdersValid(
    notificationType: MessageNotificationTypeEnum,
    templateText: string,
    fieldName: 'titleTemplate' | 'contentTemplate',
  ) {
    const allowedPayloadFields = NOTIFICATION_TEMPLATE_ALLOWED_PAYLOAD_FIELD_MAP.get(
      notificationType,
    )
    if (!allowedPayloadFields) {
      throw new BadRequestException(`通知类型 ${notificationType} 未注册模板 payload 白名单`)
    }

    const placeholders = new Set(
      Array.from(templateText.matchAll(TEMPLATE_PLACEHOLDER_REGEXP), (match) => match[1]),
    )

    for (const path of placeholders) {
      if (NOTIFICATION_TEMPLATE_ROOT_FIELD_ALLOWLIST.has(path)) {
        continue
      }

      const segments = path.split('.')
      if (segments[0] !== 'payload') {
        throw new BadRequestException(
          `${fieldName} 存在非法占位符: ${path}`,
        )
      }
      if (segments.length !== 2 || !segments[1]) {
        throw new BadRequestException(
          `${fieldName} 仅允许使用 payload 下一级字段: ${path}`,
        )
      }
      if (!allowedPayloadFields.has(segments[1])) {
        throw new BadRequestException(
          `${fieldName} 不支持当前通知类型的 payload 字段: ${path}`,
        )
      }
    }
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
