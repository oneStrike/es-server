import Joi from 'joi'

export const appConfigValidationSchema = {
  /**
   * App API 服务端口
   */
  APP_API_PORT: Joi.number().port().default(8081),

  /**
   * 旧版通用端口变量，保留兼容。
   */
  APP_PORT: Joi.number().port(),

  /**
   * 应用名称
   */
  APP_NAME: Joi.string().default('app-api'),

  /**
   * 应用版本
   */
  APP_VERSION: Joi.string().default('1.0.0'),
}
