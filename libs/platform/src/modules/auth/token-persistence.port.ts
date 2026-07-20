import type { RevokeTokenReasonEnum } from './auth.constant'
import type { TokenSessionCreateInput, TokenSessionRecord } from './auth.type'

/** token 会话持久化端口，只表达认证层需要的有界读写能力。 */
export interface TokenSessionPersistencePort {
  /** 创建单条 token 会话记录。 */
  createOne: (data: TokenSessionCreateInput) => Promise<TokenSessionRecord>

  /** 批量创建 token 会话记录，返回写入条数。 */
  createMany: (data: TokenSessionCreateInput[]) => Promise<number>

  /** 按 JTI 查询最小 token 会话记录。 */
  findByJti: (jti: string) => Promise<TokenSessionRecord | null>

  /** 原子消费仍有效的 token 会话。 */
  consumeByJti: (jti: string, reason: RevokeTokenReasonEnum) => Promise<boolean>

  /** 批量撤销指定 JTI 的 token 会话。 */
  revokeByJtis: (
    jtis: string[],
    reason: RevokeTokenReasonEnum,
  ) => Promise<number>

  /** 查询指定用户当前仍有效的 token 会话。 */
  findActiveByUserId: (userId: number) => Promise<TokenSessionRecord[]>

  /** 撤销指定用户全部未撤销 token，并返回撤销前选中的 JTI。 */
  revokeAllUnrevokedByUserId: (
    userId: number,
    reason: RevokeTokenReasonEnum,
  ) => Promise<string[]>

  /** 标记过期 token 会话为已撤销。 */
  cleanupExpired: () => Promise<number>

  /** 删除保留期之前的已撤销 token 会话。 */
  deleteOldRevoked: (retentionDays: number) => Promise<number>
}
