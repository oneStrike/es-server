/**
 * JWT Payload 基础接口
 * 定义了所有 JWT 令牌的公共字段
 */
export interface BaseJwtPayload {
  sub: string // 用户唯一标识符 (Subject)
  username: string // 用户名
  iat?: number // 令牌签发时间 (Issued At)
  exp?: number // 令牌过期时间 (Expiration Time)
  jti?: string // JWT ID，用于唯一标识令牌
  aud?: string // 令牌受众 (Audience)
}

/**
 * 管理员 JWT Payload 接口
 * 包含管理员特定的字段
 */
export interface AdminJwtPayload extends BaseJwtPayload {
  role: 'admin' // 用户角色，固定为 'admin'
  permissions?: string[] // 可选的权限列表
}

/**
 * 客户端 JWT Payload 接口
 * 包含客户端特定的字段
 */
export interface ClientJwtPayload extends BaseJwtPayload {
  role: 'client' // 用户角色，固定为 'client'
  clientId?: string // 可选的客户端标识符
  permissions?: string[] // 可选的权限列表
}

/**
 * 刷新令牌 Payload 接口
 */
export interface RefreshTokenPayload {
  sub: string // 用户唯一标识符
  username: string // 用户名
  type: 'refresh' // 令牌类型标识
  role: 'admin' | 'client' // 用户角色
  iat?: number // 令牌签发时间
  exp?: number // 令牌过期时间
  jti?: string // JWT ID
}

/**
 * 令牌对接口
 * 用于返回访问令牌和刷新令牌
 */
export interface TokenPair {
  accessToken: string // 访问令牌
  refreshToken: string // 刷新令牌
}
