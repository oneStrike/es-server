import type { AppConfigInterface } from '@libs/platform/types'
import process from 'node:process'
import { isDevelopment } from '@libs/platform/utils'
import { registerAs } from '@nestjs/config'

export const AppConfigRegister = registerAs('app', (): AppConfigInterface => {
  const {
    APP_NAME = 'app-api',
    APP_API_PORT,
    APP_VERSION = '1.0.0',
    SMS_IP_TEMPLATE_MINUTE_LIMIT = '30',
    SMS_PHONE_IP_HOUR_LIMIT = '5',
    SMS_PHONE_TEMPLATE_COOLDOWN_SECONDS = '60',
    SMS_PHONE_TEMPLATE_DAILY_LIMIT = '10',
  } = process.env
  return {
    name: APP_NAME,
    version: APP_VERSION,
    port: Number(APP_API_PORT ?? '8081'),
    globalApiPrefix: 'api',
    swaggerConfig: {
      enable: isDevelopment(),
      title: '客户端API文档',
      description: '客户端API文档',
      version: APP_VERSION,
      path: 'api-doc',
    },
    auth: {
      smsRateLimit: {
        phoneTemplateCooldownSeconds: Number(
          SMS_PHONE_TEMPLATE_COOLDOWN_SECONDS,
        ),
        phoneTemplateDailyLimit: Number(SMS_PHONE_TEMPLATE_DAILY_LIMIT),
        ipTemplateMinuteLimit: Number(SMS_IP_TEMPLATE_MINUTE_LIMIT),
        phoneIpHourLimit: Number(SMS_PHONE_IP_HOUR_LIMIT),
      },
    },
  }
})
