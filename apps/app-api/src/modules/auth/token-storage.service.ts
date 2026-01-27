import { AppUserToken } from '@libs/base/database/prisma-client/client'
import { BaseTokenStorageService, CreateTokenDto, ITokenDelegate } from '@libs/base/modules/auth'
import { Injectable } from '@nestjs/common'

/**
 * 应用层 Token 存储服务
 * 继承自 BaseTokenStorageService，复用通用逻辑
 */
@Injectable()
export class AppTokenStorageService extends BaseTokenStorageService<AppUserToken> {
  /**
   * 实现抽象 getter，返回 AppUserToken 的 Prisma Delegate
   */
  protected get tokenDelegate(): ITokenDelegate<AppUserToken> {
    return this.prisma.appUserToken as unknown as ITokenDelegate<AppUserToken>
  }
}

export type { CreateTokenDto }
