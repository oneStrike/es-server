import Joi from 'joi'

export const appConfigValidationSchema = {
  /**
   * App API 服务端口
   */
  APP_API_PORT: Joi.number().port().default(8081),

  /**
   * 应用名称
   */
  APP_NAME: Joi.string().default('app-api'),

  /**
   * 应用版本
   */
  APP_VERSION: Joi.string().default('1.0.0'),

  /**
   * 聊天历史分页游标专用签名密钥。
   */
  CHAT_MESSAGE_CURSOR_SECRET: Joi.string().min(32).required(),

  SMS_PHONE_TEMPLATE_COOLDOWN_SECONDS: Joi.number()
    .integer()
    .positive()
    .default(60),

  SMS_PHONE_TEMPLATE_DAILY_LIMIT: Joi.number().integer().positive().default(10),

  SMS_IP_TEMPLATE_MINUTE_LIMIT: Joi.number().integer().positive().default(30),

  SMS_PHONE_IP_HOUR_LIMIT: Joi.number().integer().positive().default(5),
}
