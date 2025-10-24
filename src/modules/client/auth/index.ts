/**
 * 客户端认证模块导出文件
 */

export * from './auth.controller'
export * from './auth.module'
export * from './client-jwt.service'
export * from './client-jwt.strategy'

// 从公共接口导出类型
export type { ClientJwtPayload, TokenPair } from '@/common/interfaces/jwt-payload.interface'
