import type {
  AdminLoginUserSource,
  AdminUserStatusSource,
} from './admin-auth-account.type'
import { DrizzleService } from '@db/core'
import { Injectable } from '@nestjs/common'
import { eq } from 'drizzle-orm'

/** 管理端认证账号读取服务，只承载登录、刷新和状态守卫需要的账号持久化操作。 */
@Injectable()
export class AdminAuthAccountService {
  constructor(private readonly drizzle: DrizzleService) {}

  private get db() {
    return this.drizzle.db
  }

  private get adminUser() {
    return this.drizzle.schema.adminUser
  }

  // 按用户名读取登录所需凭据与基础资料。
  async findLoginUserByUsername(
    username: string,
  ): Promise<AdminLoginUserSource | undefined> {
    const [user] = await this.db
      .select({
        id: this.adminUser.id,
        username: this.adminUser.username,
        password: this.adminUser.password,
        mobile: this.adminUser.mobile,
        avatar: this.adminUser.avatar,
        isEnabled: this.adminUser.isEnabled,
        lastLoginAt: this.adminUser.lastLoginAt,
        lastLoginIp: this.adminUser.lastLoginIp,
        createdAt: this.adminUser.createdAt,
        updatedAt: this.adminUser.updatedAt,
      })
      .from(this.adminUser)
      .where(eq(this.adminUser.username, username))
      .limit(1)
    return user
  }

  // 读取会话刷新和状态守卫共用的最小账号状态。
  async findAdminUserStatus(
    userId: number,
  ): Promise<AdminUserStatusSource | undefined> {
    const [user] = await this.db
      .select({ id: this.adminUser.id, isEnabled: this.adminUser.isEnabled })
      .from(this.adminUser)
      .where(eq(this.adminUser.id, userId))
      .limit(1)
    return user
  }

  // 记录管理员最近登录时间和 IP。
  async updateLoginInfo(
    userId: number,
    lastLoginAt: Date,
    lastLoginIp: string,
  ) {
    await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.adminUser)
        .set({ lastLoginAt, lastLoginIp })
        .where(eq(this.adminUser.id, userId)),
    )
  }
}
