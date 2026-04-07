import type {
  EffectiveMessageNotificationPreference,
  NotificationPreferenceSnapshot,
} from './notification-preference.type'
import type { MessageNotificationTypeEnum } from './notification.constant'
import { DrizzleService } from '@db/core'
import { BadRequestException, Injectable } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'
import {
  UpdateUserNotificationPreferenceItemDto,
  UpdateUserNotificationPreferencesDto,
} from './dto/notification.dto'
import {
  getMessageNotificationDefaultPreferenceEnabled,
  getMessageNotificationTemplateDefinition,
  getMessageNotificationTypeLabel,
  MESSAGE_NOTIFICATION_TYPE_VALUES,
  MessageNotificationPreferenceSourceEnum,
} from './notification.constant'

/**
 * 通知偏好服务
 * 负责用户通知偏好查询、显式覆盖写入，以及通知投递前的有效策略判断
 */
@Injectable()
export class MessageNotificationPreferenceService {
  constructor(private readonly drizzle: DrizzleService) {}

  /** 统一复用当前模块的 Drizzle 数据库实例。 */
  private get db() {
    return this.drizzle.db
  }

  /** app_app_user_notification_preference 表访问入口。 */
  private get appUserNotificationPreference() {
    return this.drizzle.schema.appUserNotificationPreference
  }

  /**
   * 获取用户通知偏好列表
   * 返回全量通知类型的有效状态，而不是只返回数据库里存在的显式覆盖项
   */
  async getUserNotificationPreferenceList(userId: number) {
    const preferences = await this.db.query.appUserNotificationPreference.findMany({
      where: { userId },
    })
    const preferenceMap = new Map(
      preferences.map((item) => [item.notificationType, item] as const),
    )

    return MESSAGE_NOTIFICATION_TYPE_VALUES.map((notificationType) =>
      this.buildEffectivePreference(
        notificationType,
        preferenceMap.get(notificationType),
      ),
    )
  }

  /**
   * 批量更新用户通知偏好
   * 仅保留“显式覆盖默认值”的记录；若用户改回默认值，则删除已有覆盖行
   */
  async updateUserNotificationPreferences(
    userId: number,
    input: UpdateUserNotificationPreferencesDto,
  ) {
    const preferences = this.normalizeUpdatePreferences(input.preferences)

    await this.drizzle.withErrorHandling(async () =>
      this.db.transaction(async (tx) => {
        for (const preference of preferences) {
          const defaultEnabled = getMessageNotificationDefaultPreferenceEnabled(
            preference.notificationType,
          )
          if (preference.isEnabled === defaultEnabled) {
            await tx
              .delete(this.appUserNotificationPreference)
              .where(and(
                eq(this.appUserNotificationPreference.userId, userId),
                eq(
                  this.appUserNotificationPreference.notificationType,
                  preference.notificationType,
                ),
              ))
            continue
          }

          await tx
            .insert(this.appUserNotificationPreference)
            .values({
              userId,
              notificationType: preference.notificationType,
              isEnabled: preference.isEnabled,
            })
            .onConflictDoUpdate({
              target: [
                this.appUserNotificationPreference.userId,
                this.appUserNotificationPreference.notificationType,
              ],
              set: {
                isEnabled: preference.isEnabled,
                updatedAt: new Date(),
              },
            })
        }
      }),
    )

    return this.getUserNotificationPreferenceList(userId)
  }

  /**
   * 获取单个通知类型的有效偏好
   * 通知主链路在创建 app_user_notification 前会调用此方法做抑制判断
   */
  async getEffectiveNotificationPreference(
    userId: number,
    notificationType: MessageNotificationTypeEnum,
  ) {
    this.ensureSupportedNotificationType(notificationType)
    const preference = await this.db.query.appUserNotificationPreference.findFirst({
      where: {
        userId,
        notificationType,
      },
    })

    return this.buildEffectivePreference(notificationType, preference)
  }

  /**
   * 构建有效偏好视图
   * 默认策略与显式覆盖统一在这里合并，避免查询和投递判断出现两套口径
   */
  private buildEffectivePreference(
    notificationType: MessageNotificationTypeEnum,
    preference?: NotificationPreferenceSnapshot,
  ): EffectiveMessageNotificationPreference {
    const defaultEnabled = getMessageNotificationDefaultPreferenceEnabled(
      notificationType,
    )
    const source: MessageNotificationPreferenceSourceEnum = preference
      ? MessageNotificationPreferenceSourceEnum.EXPLICIT
      : MessageNotificationPreferenceSourceEnum.DEFAULT

    return {
      notificationType,
      notificationTypeLabel: getMessageNotificationTypeLabel(notificationType),
      isEnabled: preference?.isEnabled ?? defaultEnabled,
      defaultEnabled,
      source,
      preferenceId: preference?.id,
      updatedAt: preference?.updatedAt,
    }
  }

  /**
   * 规范化批量更新请求
   * 拒绝空数组、重复通知类型和未注册类型，避免显式覆盖配置被歧义写入
   */
  private normalizeUpdatePreferences(
    preferences: UpdateUserNotificationPreferenceItemDto[],
  ) {
    if (!Array.isArray(preferences) || preferences.length === 0) {
      throw new BadRequestException('preferences 不能为空')
    }

    const normalized: UpdateUserNotificationPreferenceItemDto[] = []
    const seenTypes = new Set<number>()

    for (const preference of preferences) {
      const notificationType = this.ensureSupportedNotificationType(
        preference.notificationType,
      )
      if (seenTypes.has(notificationType)) {
        throw new BadRequestException('preferences 中存在重复的通知类型')
      }
      seenTypes.add(notificationType)
      normalized.push({
        notificationType,
        isEnabled: Boolean(preference.isEnabled),
      })
    }

    return normalized
  }

  /**
   * 校验通知类型是否已注册
   * 使用统一定义层阻断偏好配置和通知类型之间的漂移
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
}
