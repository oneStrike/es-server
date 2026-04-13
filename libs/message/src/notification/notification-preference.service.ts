import type {
  EffectiveMessageNotificationPreference,
  NotificationPreferenceSnapshot,
} from './notification-preference.type'
import type { MessageNotificationCategoryKey } from './notification.constant'
import { DrizzleService } from '@db/core'
import { BadRequestException, Injectable } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'
import {
  UpdateUserNotificationPreferenceItemDto,
  UpdateUserNotificationPreferencesDto,
} from './dto/notification.dto'
import {
  getMessageNotificationCategoryLabel,
  MESSAGE_NOTIFICATION_CATEGORY_KEYS,
  MessageNotificationPreferenceSourceEnum,
} from './notification.constant'

@Injectable()
export class MessageNotificationPreferenceService {
  constructor(private readonly drizzle: DrizzleService) {}

  private get db() {
    return this.drizzle.db
  }

  private get notificationPreference() {
    return this.drizzle.schema.notificationPreference
  }

  async getUserNotificationPreferenceList(userId: number) {
    const preferences = await this.db.query.notificationPreference.findMany({
      where: { userId },
    })
    const preferenceMap = new Map(
      preferences.map(item => [item.categoryKey, item] as const),
    )

    return MESSAGE_NOTIFICATION_CATEGORY_KEYS.map(categoryKey =>
      this.buildEffectivePreference(
        categoryKey,
        preferenceMap.get(categoryKey),
      ),
    )
  }

  async updateUserNotificationPreferences(
    userId: number,
    input: UpdateUserNotificationPreferencesDto,
  ) {
    const preferences = this.normalizeUpdatePreferences(input.preferences)

    await this.drizzle.withErrorHandling(async () =>
      this.db.transaction(async tx => {
        for (const preference of preferences) {
          if (preference.isEnabled === this.getDefaultEnabled(preference.categoryKey)) {
            await tx
              .delete(this.notificationPreference)
              .where(and(
                eq(this.notificationPreference.userId, userId),
                eq(this.notificationPreference.categoryKey, preference.categoryKey),
              ))
            continue
          }

          await tx
            .insert(this.notificationPreference)
            .values({
              userId,
              categoryKey: preference.categoryKey,
              isEnabled: preference.isEnabled,
            })
            .onConflictDoUpdate({
              target: [
                this.notificationPreference.userId,
                this.notificationPreference.categoryKey,
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

  async getEffectiveNotificationPreference(
    userId: number,
    categoryKey: MessageNotificationCategoryKey,
  ) {
    const normalizedCategoryKey = this.ensureSupportedCategoryKey(categoryKey)
    const preference = await this.db.query.notificationPreference.findFirst({
      where: {
        userId,
        categoryKey: normalizedCategoryKey,
      },
    })

    return this.buildEffectivePreference(normalizedCategoryKey, preference)
  }

  private buildEffectivePreference(
    categoryKey: MessageNotificationCategoryKey,
    preference?: NotificationPreferenceSnapshot,
  ): EffectiveMessageNotificationPreference {
    const defaultEnabled = this.getDefaultEnabled(categoryKey)
    const source: MessageNotificationPreferenceSourceEnum = preference
      ? MessageNotificationPreferenceSourceEnum.EXPLICIT
      : MessageNotificationPreferenceSourceEnum.DEFAULT

    return {
      categoryKey,
      categoryLabel: getMessageNotificationCategoryLabel(categoryKey),
      isEnabled: preference?.isEnabled ?? defaultEnabled,
      defaultEnabled,
      source,
      preferenceId: preference?.id,
      updatedAt: preference?.updatedAt,
    }
  }

  private normalizeUpdatePreferences(
    preferences: UpdateUserNotificationPreferenceItemDto[],
  ) {
    if (!Array.isArray(preferences) || preferences.length === 0) {
      throw new BadRequestException('preferences 不能为空')
    }

    const normalized: UpdateUserNotificationPreferenceItemDto[] = []
    const seenKeys = new Set<string>()

    for (const preference of preferences) {
      const categoryKey = this.ensureSupportedCategoryKey(preference.categoryKey)
      if (seenKeys.has(categoryKey)) {
        throw new BadRequestException('preferences 中存在重复的通知分类')
      }
      seenKeys.add(categoryKey)
      normalized.push({
        categoryKey,
        isEnabled: Boolean(preference.isEnabled),
      })
    }

    return normalized
  }

  private ensureSupportedCategoryKey(value: unknown) {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException('通知分类非法')
    }

    const categoryKey = value.trim() as MessageNotificationCategoryKey
    if (!MESSAGE_NOTIFICATION_CATEGORY_KEYS.includes(categoryKey)) {
      throw new BadRequestException('通知分类非法')
    }
    return categoryKey
  }

  private getDefaultEnabled(_categoryKey: MessageNotificationCategoryKey) {
    return true
  }
}
