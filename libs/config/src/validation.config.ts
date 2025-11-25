import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator'

/**
 * 应用运行环境枚举
 * 用于标识应用当前运行的环境状态
 */
enum Environment {
  /**
   * 开发环境
   * 用于开发人员进行日常开发和调试
   */
  Development = 'development',

  /**
   * 生产环境
   * 应用的正式发布环境，面向终端用户
   */
  Production = 'production',

  /**
   * 测试环境
   * 用于运行自动化测试和集成测试
   */
  Test = 'test',

  /**
   * 预发布环境
   * 在部署到生产环境前进行最终验证的环境
   */
  Provision = 'provision',
}

/**
 * 日志级别枚举
 * 定义应用中不同级别的日志，用于控制日志的输出详细程度
 */
enum LogLevel {
  /**
   * 错误级别
   * 记录应用中的错误信息，通常表示应用无法正常执行的严重问题
   */
  Error = 'error',

  /**
   * 警告级别
   * 记录应用中的警告信息，通常表示潜在的问题或需要关注的情况
   */
  Warn = 'warn',

  /**
   * 信息级别
   * 记录应用的一般信息，用于跟踪应用的运行状态
   */
  Info = 'info',

  /**
   * 调试级别
   * 记录详细的调试信息，用于开发和问题排查
   */
  Debug = 'debug',
}

/**
 * 环境变量验证类
 * 用于验证应用配置的有效性和类型安全
 * 包含所有应用程序所需的环境变量的定义和验证规则
 */
export class EnvironmentVariables {
  /**
   * 应用运行环境
   * 用于区分开发、测试、预发布和生产环境
   * 决定应用的行为模式、日志级别、调试选项等
   */
  @IsEnum(Environment)
  NODE_ENV: Environment

  /**
   * 兼容端口配置
   * 为了向后兼容性保留的可选端口配置，优先级低于APP_PORT
   */
  @IsNumber()
  @Min(0)
  @Max(65535)
  @IsOptional()
  PORT?: number

  // 数据库配置
  /**
   * 数据库主机地址
   * 数据库服务器的IP地址或主机名
   */
  @IsString()
  @IsNotEmpty()
  DB_HOST: string

  /**
   * 数据库端口号
   * 数据库服务监听的端口号
   */
  @IsNumber()
  @Min(1)
  @Max(65535)
  DB_PORT: number

  /**
   * 数据库用户名
   * 用于连接数据库的用户名
   */
  @IsString()
  @IsNotEmpty()
  DB_USER: string

  /**
   * 数据库密码
   * 用于连接数据库的密码
   */
  @IsString()
  @IsNotEmpty()
  DB_PASSWORD: string

  /**
   * 数据库名称
   * 应用使用的数据库名称
   */
  @IsString()
  @IsNotEmpty()
  DB_NAME: string

  /**
   * 数据库查询列表最大限制
   * 限制数据库查询结果的最大记录数，防止查询过大导致性能问题
   */
  @IsNumber()
  @Min(1)
  DB_MAX_QUERY_LIST_LIMIT: number

  /**
   * 数据库分页大小
   * 每页返回的数据条数，控制单次API响应的数据量
   */
  @IsNumber()
  @Min(1)
  DB_PAGINATION_PAGE_SIZE: number

  /**
   * 数据库分页起始索引
   * 分页的起始页码，通常从0开始，用于计算数据偏移量
   */
  @IsNumber()
  @Min(0)
  DB_PAGINATION_PAGE_INDEX: number

  /**
   * 查询列表最大限制（兼容旧配置）
   * 限制数据库查询结果的最大记录数，防止查询过大导致性能问题
   */
  @IsNumber()
  @Min(1)
  @IsOptional()
  MAX_QUERY_LIST_LIMIT?: number

  /**
   * 分页大小（兼容旧配置）
   * 每页返回的数据条数，控制单次API响应的数据量
   */
  @IsNumber()
  @Min(1)
  @IsOptional()
  PAGINATION_PAGE_SIZE?: number

  /**
   * 分页起始索引（兼容旧配置）
   * 分页的起始页码，通常从0开始，用于计算数据偏移量
   */
  @IsNumber()
  @Min(0)
  @IsOptional()
  PAGINATION_PAGE_INDEX?: number

  /**
   * Redis主机地址
   * Redis服务器的IP地址或主机名
   */
  @IsString()
  @IsNotEmpty()
  REDIS_HOST: string

  /**
   * Redis端口号
   * Redis服务监听的端口号，默认通常为6379
   */
  @IsNumber()
  @Min(0)
  @Max(65535)
  REDIS_PORT: number

  /**
   * Redis密码
   * 用于连接Redis的密码，可选配置
   */
  @IsString()
  @IsOptional()
  REDIS_PASSWORD?: string

  /**
   * Redis命名空间
   * Redis键的前缀，用于在多应用共享Redis时避免键冲突
   */
  @IsString()
  @IsNotEmpty()
  REDIS_NAMESPACE: string

  /**
   * JWT配置
   */
  /**
   * JWT签名密钥
   * 用于签发和验证访问令牌的密钥，应妥善保管
   */
  @IsString()
  @IsNotEmpty()
  JWT_SECRET: string

  /**
   * JWT刷新令牌密钥
   * 用于签发和验证刷新令牌的密钥，应与JWT_SECRET不同并妥善保管
   */
  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_SECRET: string

  /**
   * JWT访问令牌过期时间
   * 访问令牌的有效期，以字符串形式表示（如'4h'）
   */
  @IsString()
  @IsNotEmpty()
  JWT_EXPIRATION_IN: string

  /**
   * JWT刷新令牌过期时间
   * 刷新令牌的有效期，以字符串形式表示，通常设置比访问令牌更长的时间（如'7d'）
   */
  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_EXPIRATION_IN: string

  /**
   * JWT签发者
   * 标识签发JWT的实体
   */
  @IsString()
  @IsNotEmpty()
  JWT_JWT_ISSUER: string

  /**
   * JWT接收者
   * 标识JWT的预期接收者，可选配置
   */
  @IsString()
  @IsOptional()
  JWT_JWT_AUD?: string

  /**
   * JWT认证策略键名
   * 自定义认证策略的标识符，用于指定认证策略的唯一标识
   */
  @IsString()
  @IsOptional()
  JWT_STRATEGY_KEY?: string

  /**
   * 访问令牌过期时间（兼容旧配置）
   * 访问令牌的有效期，以字符串形式表示
   */
  @IsString()
  @IsOptional()
  EXPIRATION_IN?: string

  /**
   * 刷新令牌过期时间（兼容旧配置）
   * 刷新令牌的有效期，以字符串形式表示
   */
  @IsString()
  @IsOptional()
  REFRESH_EXPIRATION_IN?: string

  /**
   * JWT签发者（兼容旧配置）
   * 标识签发JWT的实体
   */
  @IsString()
  @IsOptional()
  JWT_ISSUER?: string

  /**
   * JWT接收者（兼容旧配置）
   * 标识JWT的预期接收者
   */
  @IsString()
  @IsOptional()
  JWT_AUD?: string

  // RSA密钥配置
  /**
   * RSA公钥
   * 用于加密数据或验证签名的公钥
   */
  @IsString()
  @IsNotEmpty()
  RSA_PUBLIC_KEY: string

  /**
   * RSA私钥
   * 用于解密数据或生成签名的私钥，必须妥善保管
   */
  @IsString()
  @IsNotEmpty()
  RSA_PRIVATE_KEY: string

  /**
   * 日志级别
   * 控制日志的输出详细程度，可选值：error, warn, info, debug
   */
  @IsEnum(LogLevel)
  LOG_LEVEL: LogLevel

  /**
   * 日志目录
   * 日志文件的保存目录路径，确保应用对该目录有写入权限
   */
  @IsString()
  @IsNotEmpty()
  LOG_PATH: string

  /**
   * 日志文件保留天数
   * 指定日志文件的保留时间，过期日志会被自动清理
   */
  @IsString()
  @IsNotEmpty()
  LOG_RETAIN_DAYS: string

  /**
   * 日志文件最大大小
   * 单个日志文件的最大大小限制，超过后会创建新的日志文件
   */
  @IsString()
  @IsNotEmpty()
  LOG_MAX_SIZE: string

  /**
   * 日志压缩标志
   * 是否压缩归档的日志文件，节省存储空间
   */
  @IsString()
  @IsNotEmpty()
  LOG_COMPRESS: string

  /**
   * 控制台日志级别
   * 控制控制台输出的日志级别，可与文件日志级别不同
   */
  @IsString()
  @IsNotEmpty()
  LOG_CONSOLE_LEVEL: string

  /**
   * 日志格式
   * 定义日志的输出格式，可选值通常包括 'json'、'simple'、'combined' 等
   */
  @IsString()
  @IsOptional()
  LOG_FORMAT?: string

  /**
   * 日志文件最大数量
   * 限制保留的日志文件数量，超过后会删除最旧的日志文件
   */
  @IsString()
  @IsOptional()
  LOG_MAX_FILES?: string

  /**
   * 日志日期格式
   * 定义日志文件名中的日期格式
   */
  @IsString()
  @IsOptional()
  LOG_DATE_PATTERN?: string

  /**
   * 文件上传目录
   * 用于存储用户上传文件的目录路径，确保应用对该目录有读写权限
   */
  @IsString()
  @IsNotEmpty()
  UPLOAD_DIR: string

  /**
   * 最大文件上传大小
   * 限制单个文件上传的最大字节数，防止恶意上传过大文件
   */
  @IsString()
  @IsNotEmpty()
  UPLOAD_MAX_FILE_SIZE: string

  /**
   * 最大文件上传数量
   * 限制单次请求可上传的文件数量
   */
  @IsNumber()
  @Min(1)
  UPLOAD_MAX_FILES: number

  /**
   * 最大文件上传大小（兼容旧配置）
   * 限制单个文件上传的最大字节数，防止恶意上传过大文件
   */
  @IsNumber()
  @IsOptional()
  MAX_UPLOAD_SIZE?: number

  /**
   * 允许的文件类型（兼容旧配置）
   * 定义允许上传的文件MIME类型，格式为逗号分隔的字符串
   */
  @IsString()
  @IsOptional()
  ALLOWED_FILE_TYPES?: string
}
