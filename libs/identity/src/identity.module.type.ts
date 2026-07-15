import type { ITokenStorageService } from '@libs/platform/modules/auth/types'
import type { Type } from '@nestjs/common'

/** Identity runtime 可绑定的 token 存储实现。 */
export type IdentityTokenStorageService = Type<ITokenStorageService>

/** Identity dynamic module 的显式 composition 参数。 */
export interface IdentityModuleRegisterOptions {
  tokenStorageService: IdentityTokenStorageService
}
