import { DrizzleService } from '@db/core'
import { AdminUser, NewAdminUser } from '@db/schema'
import { ScryptService } from '@libs/platform/modules'
import { LoginGuardService } from '@libs/platform/modules/auth'
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { eq } from 'drizzle-orm'
import { AuthRedisKeys } from '../auth/auth.constant'
import { AdminUserRoleEnum } from './admin-user.constant'
import { ChangePasswordDto, UserPageDto } from './dto/admin-user.dto'

/**
 * 管理员用户服务
 * 负责后台用户的注册、查询、权限校验与密码管理
 */
@Injectable()
export class AdminUserService {
  get adminUser() {
    return this.drizzle.schema.adminUser
  }

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly scryptService: ScryptService,
    private readonly configService: ConfigService,
    private readonly loginGuardService: LoginGuardService,
  ) {}

  private get db() {
    return this.drizzle.db
  }

  async isSuperAdmin(userId: number) {
    const [adminUser] = await this.db
      .select({ role: this.adminUser.role })
      .from(this.adminUser)
      .where(eq(this.adminUser.id, userId))
      .limit(1)
    if (!adminUser) {
      throw new NotFoundException('用户不存在')
    }

    if (adminUser.role !== AdminUserRoleEnum.SUPER_ADMIN) {
      throw new UnauthorizedException('权限不足')
    }
  }

  /**
   * 更新用户信息
   */
  async updateUserInfo(
    userId: number,
    updateData: Partial<AdminUser> & { id: number },
  ) {
    await this.isSuperAdmin(userId)
    // 查找用户
    const [user] = await this.db
      .select({ id: this.adminUser.id, username: this.adminUser.username })
      .from(this.adminUser)
      .where(eq(this.adminUser.id, updateData.id))
      .limit(1)
    if (!user) {
      throw new NotFoundException('用户不存在')
    }

    // 如果要更新用户名，检查是否已存在
    if (updateData.username && updateData.username !== user.username) {
      const [existingUser] = await this.db
        .select({ id: this.adminUser.id })
        .from(this.adminUser)
        .where(eq(this.adminUser.username, updateData.username))
        .limit(1)

      if (existingUser?.id) {
        throw new BadRequestException('用户名已存在')
      }
    }

    // 返回更新后的用户信息（不包含密码）

    const { id: _id, ...data } = updateData
    const [updated] = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.adminUser)
        .set(data)
        .where(eq(this.adminUser.id, updateData.id))
        .returning({ id: this.adminUser.id }),
    )
    this.drizzle.assertAffectedRows(updated ? [updated] : [], '用户不存在')
    return updated
  }

  /**
   * 注册管理员用户
   */
  async register(data: NewAdminUser) {
    const { username, password, avatar, role, mobile } = data

    // 检查用户名是否已存在
    const [usernameExists] = await this.db
      .select({ id: this.adminUser.id })
      .from(this.adminUser)
      .where(eq(this.adminUser.username, username))
      .limit(1)
    if (usernameExists) {
      throw new BadRequestException('用户名已存在')
    }
    // 检查手机号是否已存在
    const [mobileExists] = mobile
      ? await this.db
          .select({ id: this.adminUser.id })
          .from(this.adminUser)
          .where(eq(this.adminUser.mobile, mobile))
          .limit(1)
      : []
    if (mobileExists) {
      throw new BadRequestException('手机号已存在')
    }

    // 加密密码
    const encryptedPassword = await this.scryptService.encryptPassword(password)

    const [created] = await this.drizzle.withErrorHandling(() =>
      this.db
        .insert(this.adminUser)
        .values({
          username,
          password: encryptedPassword,
          avatar,
          mobile,
          role: role || AdminUserRoleEnum.NORMAL_ADMIN,
          isEnabled: true,
        })
        .returning({ id: this.adminUser.id }),
    )
    return created
  }

  /**
   * 获取用户信息
   */
  async getUserInfo(userId: number) {
    const [user] = await this.db
      .select()
      .from(this.adminUser)
      .where(eq(this.adminUser.id, userId))
      .limit(1)

    if (!user) {
      throw new NotFoundException('用户不存在')
    }

    // 返回用户信息（不包含密码）
    const { password: _password, ...rest } = user
    return rest
  }

  /**
   * 获取用户列表（分页）
   */
  async getUsers(queryDto: UserPageDto) {
    const { username, isEnabled, mobile, role, ...pageDto } = queryDto
    const where = this.drizzle.buildWhere(this.adminUser, {
      and: {
        isEnabled,
        role,
        username: username ? { like: username } : undefined,
        mobile: mobile ? { like: mobile } : undefined,
      },
    })
    const page = await this.drizzle.ext.findPagination(this.adminUser, {
      where,
      ...pageDto,
    })
    return {
      ...page,
      list: page.list.map(({ password: _password, ...item }) => item),
    }
  }

  /**
   * 修改密码
   */
  async changePassword(userId: number, changePasswordDto: ChangePasswordDto) {
    const { oldPassword, newPassword, confirmPassword } = changePasswordDto

    // 检查新密码和确认密码是否一致
    if (newPassword !== confirmPassword) {
      throw new BadRequestException('新密码和确认密码不一致')
    }

    // 检查新密码与旧密码是否相同
    if (oldPassword === newPassword) {
      throw new BadRequestException('新密码不能与旧密码相同')
    }

    // 查找用户（优化：只选择密码字段）
    const [user] = await this.db
      .select({ id: this.adminUser.id, password: this.adminUser.password })
      .from(this.adminUser)
      .where(eq(this.adminUser.id, userId))
      .limit(1)
    if (!user) {
      throw new NotFoundException('用户不存在')
    }

    // 验证旧密码
    const isPasswordValid = await this.scryptService.verifyPassword(
      oldPassword,
      user.password,
    )
    if (!isPasswordValid) {
      throw new UnauthorizedException('旧密码错误')
    }

    // 更新密码
    const [updated] = await this.drizzle.withErrorHandling(async () =>
      this.db
        .update(this.adminUser)
        .set({
          password: await this.scryptService.encryptPassword(newPassword),
        })
        .where(eq(this.adminUser.id, userId))
        .returning({ id: this.adminUser.id }),
    )
    this.drizzle.assertAffectedRows(updated ? [updated] : [], '用户不存在')
    return updated
  }

  /**
   * 解锁用户
   */
  async unlockUser(userId: number) {
    // 检查用户是否存在
    const [user] = await this.db
      .select({ id: this.adminUser.id })
      .from(this.adminUser)
      .where(eq(this.adminUser.id, userId))
      .limit(1)
    if (!user) {
      throw new NotFoundException('用户不存在')
    }

    // 解锁用户（清除 Redis 锁）
    await this.loginGuardService.unlock(
      AuthRedisKeys.LOGIN_LOCK(userId),
      AuthRedisKeys.LOGIN_FAIL_COUNT(userId),
    )

    return userId
  }

  /**
   * 重置用户密码为默认密码（Aa@123456）
   */
  async resetPassword(userId: number, id: number) {
    await this.isSuperAdmin(userId)
    // 重置密码为默认密码（Aa@123456）
    const defaultPassword = await this.scryptService.encryptPassword(
      this.configService.get<string>('app.defaultPassword')!,
    )
    const rows = await this.drizzle.withErrorHandling(async () =>
      this.db
        .update(this.adminUser)
        .set({
          password: await this.scryptService.encryptPassword(defaultPassword),
        })
        .where(eq(this.adminUser.id, id))
        .returning({ id: this.adminUser.id }),
    )
    this.drizzle.assertAffectedRows(rows, '用户不存在')
    return userId
  }
}
