import type { ClientRequestContext } from '@libs/platform/utils'

/**
 * 会话链路使用的客户端上下文
 * 仅保留 token 持久化与刷新链路真正需要的客户端来源信息
 */
export type SessionClientContext = ClientRequestContext
