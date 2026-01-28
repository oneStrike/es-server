import { AdminUserToken } from '@libs/base/database'
import {
  BaseTokenStorageService,
  CreateTokenDto,
  ITokenDelegate,
} from '@libs/base/modules/auth'
import { Injectable } from '@nestjs/common'

/**
 * 管理端 Token 存储服务
 * 继承自 BaseTokenStorageService，复用通用逻辑
 */
@Injectable()
export class AdminTokenStorageService extends BaseTokenStorageService<AdminUserToken> {
  /**
   * 实现抽象 getter，返回 AdminUserToken 的 Prisma Delegate
   */
  protected get tokenDelegate(): ITokenDelegate<AdminUserToken> {
    // 使用 unknown 转换以绕过 Prisma 生成类型的复杂性
    // 实际上 Prisma Delegate 拥有 ITokenDelegate 定义的所有方法
    return this.prisma
      .adminUserToken as unknown as ITokenDelegate<AdminUserToken>
  }
}

export type { CreateTokenDto }
