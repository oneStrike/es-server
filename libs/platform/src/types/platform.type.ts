import type { DbQueryOrderBy } from '@libs/platform/config/db.config'
import type { JwtSignOptions } from '@nestjs/jwt'

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
   * 全局 API 前缀
   */
  globalApiPrefix: string
  /**
   * 普通管理员用户重置时的默认密码
   */
  defaultPassword?: string
  /**
   * Swagger 配置
   */
  swaggerConfig: {
    /**
     * 是否启用 Swagger
     */
    enable: boolean
    /**
     * Swagger 文档标题
     */
    title: string
    /**
     * Swagger 文档描述
     */
    description: string
    /**
     * Swagger 文档版本
     */
    version: string
    /**
     * Swagger 文档路径
     */
    path: string
  }
}

/**
 * token 中包含的用户信息
 */
export interface JwtUserInfoInterface {
  /**
   * 用户 ID
   */
  sub: number
  /**
   * 用户名
   */
  username: string
}

/** 稳定领域类型 `AuthConfigInterface`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface AuthConfigInterface {
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

/** 稳定领域类型 `QueryOrderByInput`。仅供内部领域/服务链路复用，避免重复定义。 */
export type QueryOrderByInput = DbQueryOrderBy | string

export interface PageQueryInput {
  pageIndex?: number
  pageSize?: number
  orderBy?: QueryOrderByInput
}

/** 稳定领域类型 `PageQueryNoOrderInput`。仅供内部领域/服务链路复用，避免重复定义。 */
export type PageQueryNoOrderInput = Omit<PageQueryInput, 'orderBy'>
