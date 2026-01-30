import Joi from 'joi'

export const appConfigValidationSchema = {
  /**
   * 应用服务端口
   */
  APP_PORT: Joi.number().port().default(8080),

  /**
   * 应用名称
   */
  APP_NAME: Joi.string().default('admin-api'),

  /**
   * 应用版本
   */
  APP_VERSION: Joi.string().default('1.0.0'),

  /**
   * 文件URL前缀
   */
  APP_FILE_URL_PREFIX: Joi.string().default('/files'),

  /**
   * 默认密码
   */
  APP_DEFAULT_PASSWORD: Joi.string().default('Aa@123456'),
}
