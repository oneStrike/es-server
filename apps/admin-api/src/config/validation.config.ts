import Joi from 'joi'

export const appConfigValidationSchema = {
  /**
   * 管理端 API 服务端口
   */
  ADMIN_API_PORT: Joi.number().port().default(8080),

  /**
   * 旧版通用端口变量，保留兼容。
   */
  APP_PORT: Joi.number().port(),

  /**
   * 应用名称
   */
  APP_NAME: Joi.string().default('admin-api'),

  /**
   * 应用版本
   */
  APP_VERSION: Joi.string().default('1.0.0'),

  /**
   * 默认密码
   */
  APP_DEFAULT_PASSWORD: Joi.string().default('Aa@123456'),
}
