import { IsNotEmpty, IsNumber, IsString, Max, Min } from 'class-validator'

export class ValidateAppConfig {
  /**
   * 应用服务端口
   * 应用监听的端口号，范围0-65535
   * 用于接收和处理HTTP请求
   */
  @IsNumber()
  @Min(0)
  @Max(65535)
  APP_PORT: number

  /**
   * 应用名称
   * 应用的唯一标识符，用于日志、监控等场景
   * 在多应用部署环境中区分不同应用
   */
  @IsString()
  @IsNotEmpty()
  APP_NAME: string

  /**
   * 应用版本
   * 应用的当前版本号，遵循语义化版本规范
   * 用于API文档、错误报告和版本控制
   */
  @IsString()
  @IsNotEmpty()
  APP_VERSION: string

  /**
   * 文件URL前缀
   * 访问上传文件的URL路径前缀
   * 用于构建完整的文件访问URL
   */
  @IsString()
  @IsNotEmpty()
  APP_FILE_URL_PREFIX: string

  /**
   * 默认密码
   * 系统初始化或重置用户密码时使用的默认密码
   * 仅在开发环境使用，生产环境应确保用户首次登录修改密码
   */
  @IsString()
  @IsNotEmpty()
  APP_DEFAULT_PASSWORD: string
}
