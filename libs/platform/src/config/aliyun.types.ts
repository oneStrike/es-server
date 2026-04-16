import type { AliyunConfig } from './aliyun.config'

/**
 * 阿里云配置类型
 * 复用运行时配置结构
 */
/** 稳定领域类型 `AliyunConfigInterface`。仅供内部领域/服务链路复用，避免重复定义。 */
export type AliyunConfigInterface = typeof AliyunConfig
