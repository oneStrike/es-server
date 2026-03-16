import { eq } from 'drizzle-orm'
import type { Db } from '../../db-client'
import { appConfig } from '../../../schema/app/app-config'

const DEFAULT_CONFIG = {
  appName: '漫画阅读平台',
  appDesc: '提供优质漫画阅读体验的平台，支持多种漫画类型，随时随地享受阅读乐趣',
  appLogo: 'https://example.com/logo.png',
  onboardingImage: 'https://example.com/onboarding.png',
  themeColor: '#007AFF',
  secondaryColor: '#5856D6',
  optionalThemeColors: '#FF9500,#FF3B30,#4CD964,#5AC8FA,#007AFF',
  enableMaintenanceMode: false,
  maintenanceMessage: '系统维护中，请稍后再来',
  version: '1.0.0',
}

export async function seedAppConfig(db: Db, updatedById?: number) {
  console.log('🌱 开始初始化应用配置...')

  const existing = await db.query.appConfig.findFirst()

  if (existing) {
    await db
      .update(appConfig)
      .set({
        ...DEFAULT_CONFIG,
        updatedById,
        updatedAt: new Date(),
      })
      .where(eq(appConfig.id, existing.id))
    console.log('  ✓ 应用配置已更新')
  } else {
    await db.insert(appConfig).values({
      ...DEFAULT_CONFIG,
      updatedById,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    console.log('  ✓ 应用配置已创建')
  }

  console.log('✅ 应用配置初始化完成')
}
