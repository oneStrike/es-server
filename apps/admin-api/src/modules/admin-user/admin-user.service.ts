import type { ChangePasswordDto, UpdateUserDto, UserPageDto, UserRegisterDto } from '@libs/identity/dto/admin-user.dto';
import type { SQL } from 'drizzle-orm'
import { buildILikeCondition, DrizzleService } from '@db/core'
import { AdminUserRoleEnum } from '@libs/identity/admin-user.constant'
import { RevokeTokenReasonEnum } from '@libs/platform/modules/auth/auth.constant';
import { LoginGuardService } from '@libs/platform/modules/auth/login-guard.service';
import { ScryptService } from '@libs/platform/modules/crypto/scrypt.service';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { and, eq } from 'drizzle-orm'
import { AdminAuthRedisKeys } from '../auth/auth.constant'
import { AdminTokenStorageService } from '../auth/token-storage.service'

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
    private readonly tokenStorageService: AdminTokenStorageService,
  ) {}

  private get db() {
    return this.drizzle.db
  }

  /**
   * 校验当前操作人是否为超级管理员。
   * 角色不足属于已登录但无权限的场景，需要返回 Forbidden 语义。
   */
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
      throw new ForbiddenException('权限不足')
    }
  }

  /**
   * 更新用户信息
   */
  async updateUserInfo(
    userId: number,
    updateData: UpdateUserDto,
  ) {
    await this.isSuperAdmin(userId)
    // 先读取当前快照，避免把同一账号自己的用户名或手机号误判成冲突。
    const [user] = await this.db
      .select({
        id: this.adminUser.id,
        username: this.adminUser.username,
        mobile: this.adminUser.mobile,
      })
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

    if (updateData.mobile && updateData.mobile !== user.mobile) {
      const [existingUser] = await this.db
        .select({ id: this.adminUser.id })
        .from(this.adminUser)
        .where(eq(this.adminUser.mobile, updateData.mobile))
        .limit(1)

      if (existingUser?.id) {
        throw new BadRequestException('手机号已存在')
      }
    }

    const { id: _id, ...data } = updateData
    await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.adminUser)
        .set(data)
        .where(eq(this.adminUser.id, updateData.id)), { notFound: '用户不存在' },)
    return true
  }

   /**
    * 注册管理员用户
    */
  async register(operatorId: number, data: UserRegisterDto) {
    await this.isSuperAdmin(operatorId)
    const { username, password, avatar, role, mobile, confirmPassword } = data

    if (password !== confirmPassword) {
      throw new BadRequestException('两次输入的密码不一致')
    }

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

    await this.drizzle.withErrorHandling(() =>
      this.db
        .insert(this.adminUser)
        .values({
          username,
          password: encryptedPassword,
          avatar,
          mobile,
          role: role || AdminUserRoleEnum.NORMAL_ADMIN,
          isEnabled: true,
        }),
    )
    return true
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
    const conditions: SQL[] = []

    if (isEnabled !== undefined) {
      conditions.push(eq(this.adminUser.isEnabled, isEnabled))
    }
    if (role !== undefined) {
      conditions.push(eq(this.adminUser.role, role))
    }
    if (username) {
      conditions.push(
        buildILikeCondition(this.adminUser.username, username)!,
      )
    }
    if (mobile) {
      conditions.push(
        buildILikeCondition(this.adminUser.mobile, mobile)!,
      )
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined
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
  async changePassword(
    userId: number,
    changePasswordDto: ChangePasswordDto,
  ) {
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
    await this.drizzle.withErrorHandling(async () =>
      this.db
        .update(this.adminUser)
        .set({
          password: await this.scryptService.encryptPassword(newPassword),
        })
        .where(eq(this.adminUser.id, userId)), { notFound: '用户不存在' },)

    await this.tokenStorageService.revokeAllByUserId(
      userId,
      RevokeTokenReasonEnum.PASSWORD_CHANGE,
    )

    return true
  }

  /**
   * 解锁指定管理员账号的登录锁定状态。
   * 该能力会直接修改登录保护状态，只允许超级管理员操作。
   */
  async unlockUser(operatorId: number, userId: number) {
    await this.isSuperAdmin(operatorId)

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
      AdminAuthRedisKeys.LOGIN_LOCK(userId),
      AdminAuthRedisKeys.LOGIN_FAIL_COUNT(userId),
    )

    return true
  }

  /**
   * 重置用户密码为默认密码（Aa@123456）
   */
  async resetPassword(userId: number, id: number) {
    await this.isSuperAdmin(userId)
    // 重置密码为默认密码（Aa@123456）
    const defaultPassword = this.configService.get<string>('app.defaultPassword')!
    const encryptedPassword = await this.scryptService.encryptPassword(
      defaultPassword,
    )
    await this.drizzle.withErrorHandling(async () =>
      this.db
        .update(this.adminUser)
        .set({
          password: encryptedPassword,
        })
        .where(eq(this.adminUser.id, id)), { notFound: '用户不存在' },)

    await this.tokenStorageService.revokeAllByUserId(
      id,
      RevokeTokenReasonEnum.PASSWORD_CHANGE,
    )

    return true
  }
}
