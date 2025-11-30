/**
 * API类型枚举
 */
import type { JwtSignOptions } from '@nestjs/jwt'

export enum ApiTypeEnum {
  ADMIN = 'admin',
  CLIENT = 'client',
  SYSTEM = 'system',
  PUBLIC = 'public',
}

/**
 * HTTP方法枚举
 */
export enum HttpMethodEnum {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
  PATCH = 'PATCH',
  HEAD = 'HEAD',
  OPTIONS = 'OPTIONS',
}

/**
 * 常用操作类型
 */
export enum ActionTypeEnum {
  LOGIN = '用户登录',
  LOGOUT = '用户登出',
  CREATE = '创建数据',
  UPDATE = '更新数据',
  DELETE = '删除数据',
  UPLOAD = '文件上传',
  DOWNLOAD = '文件下载',
  EXPORT = '数据导出',
  IMPORT = '数据导入',
}

/**
 * 应用配置接口
 */
export interface AppConfigInterface {
  /**
   * 应用名称
   */
  name: string
  /**
   * 应用版本
   */
  version: string
  /**
   * 应用端口
   */
  port: number
  /**
   * 文件访问URL前缀
   */
  fileUrlPrefix: string
  /**
   * 全局API前缀
   */
  globalApiPrefix: string
  /**
   * 普通管理员用户重置时的默认密码
   */
  defaultPassword: string
  /**
   * Swagger配置
   */
  swaggerConfig: {
    /**
     * 是否启用Swagger
     */
    enable: boolean
    /**
     * Swagger文档标题
     */
    title: string
    /**
     * Swagger文档描述
     */
    description: string
    /**
     * Swagger文档版本
     */
    version: string
    /**
     * Swagger文档路径
     */
    path: string
  }
}

/**
 * token中包含的用户信息
 */
export interface JwtUserInfoInterface {
  /**
   * 用户ID
   */
  sub: number
  /**
   * 用户名
   */
  username: string
}

export interface AuthConfigInterface {
  // JWT 配置
  secret: string
  // 刷新令牌 JWT 配置
  refreshSecret: string
  // JWT 过期时间（秒）
  expiresIn: JwtSignOptions['expiresIn']
  // 刷新令牌 JWT 过期时间（秒）
  refreshExpiresIn: JwtSignOptions['expiresIn']
  // JWT 受众（aud）
  aud: string
  // 发行者（iss）
  iss?: string
  // 策略键（strategyKey）
  strategyKey: string
}
