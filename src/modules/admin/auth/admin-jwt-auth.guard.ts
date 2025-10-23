import { Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { createJwtAuthGuard } from '@/common/guards/jwt-auth.guard'
import { ADMIN_AUTH_CONFIG } from '@/config/jwt.config'

@Injectable()
export class AdminJwtAuthGuard extends createJwtAuthGuard(
  ADMIN_AUTH_CONFIG.strategyKey,
) {
  /**
   * 构造函数
   * @param reflector 用于获取路由元数据的 Reflector 服务
   */
  constructor(public reflector: Reflector) {
    super(reflector)
  }
}
