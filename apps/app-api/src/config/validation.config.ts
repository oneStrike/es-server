import Joi from 'joi'

export const appConfigValidationSchema = {
  /**
   * 应用服务端口
   */
  APP_PORT: Joi.number().port().required(),

  /**
   * 应用名称
   */
  APP_NAME: Joi.string().required(),

  /**
   * 应用版本
   */
  APP_VERSION: Joi.string().required(),

  /**
   * 文件URL前缀
   */
  APP_FILE_URL_PREFIX: Joi.string().required(),
}
