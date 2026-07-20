import type { SQL } from 'drizzle-orm'
import type { AdminRoleSummaryDto } from '../rbac/dto/admin-rbac.dto'
import type {
  AdminAccountAvailabilityInput,
  AdminPasswordCredentialSource,
  AdminUserAccountForUpdateSource,
  AdminUserAccountTransaction,
  AdminUserProfileUpdateData,
  AdminUserResponseSource,
  AdminUserSafeUpdateTarget,
  AdminUserTransactionExecutor,
  CreateAdminAccountInput,
} from './admin-user.type'
import type {
  AdminAccountUpdateDto,
  AdminSelfProfileUpdateDto,
  UserPageDto,
} from './dto/admin-user.dto'
import { buildILikeCondition, DrizzleService, toPageResult } from '@db/core'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { Injectable } from '@nestjs/common'
import { and, asc, eq, exists, inArray } from 'drizzle-orm'

/**
 * 管理员账号持久化服务。
 * 负责管理端账号、凭据及账号-角色读取的数据库操作，不承载 HTTP 或 RBAC 授权策略。
 */
@Injectable()
export class AdminUserAccountService {
  constructor(private readonly drizzle: DrizzleService) {}

  private get db() {
    return this.drizzle.db
  }

  private get adminUser() {
    return this.drizzle.schema.adminUser
  }

  private get adminRole() {
    return this.drizzle.schema.adminRole
  }

  private get adminUserRole() {
    return this.drizzle.schema.adminUserRole
  }

  private get adminUserResponseColumns() {
    return {
      id: this.adminUser.id,
      username: this.adminUser.username,
      mobile: this.adminUser.mobile,
      avatar: this.adminUser.avatar,
      isEnabled: this.adminUser.isEnabled,
      lastLoginAt: this.adminUser.lastLoginAt,
      lastLoginIp: this.adminUser.lastLoginIp,
      createdAt: this.adminUser.createdAt,
      updatedAt: this.adminUser.updatedAt,
    } as const
  }

  // 更新当前管理员自助资料，并保持用户名/手机号冲突错误语义。
  async updateSelfProfile(
    userId: number,
    updateData: AdminSelfProfileUpdateDto,
  ) {
    const user = await this.getAdminAccountForUpdate(userId)
    await this.assertAccountUpdateFieldsAvailable(user, updateData)

    const data = this.toSelfProfileUpdateData(updateData)
    if (Object.keys(data).length === 0) {
      return true
    }

    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.adminUser)
          .set(data)
          .where(eq(this.adminUser.id, userId)),
      { notFound: '用户不存在' },
    )
    return true
  }

  // 获取更新管理员账号前的当前值；不存在时保持稳定的资源不存在错误。
  async getAdminAccountForUpdate(
    userId: number,
  ): Promise<AdminUserAccountForUpdateSource> {
    const [user] = await this.db
      .select({
        id: this.adminUser.id,
        username: this.adminUser.username,
        mobile: this.adminUser.mobile,
        isEnabled: this.adminUser.isEnabled,
      })
      .from(this.adminUser)
      .where(eq(this.adminUser.id, userId))
      .limit(1)
    if (!user) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '用户不存在',
      )
    }
    return user
  }

  // 校验更新后的用户名和手机号仍可用。
  async assertAccountUpdateFieldsAvailable(
    current: AdminUserAccountForUpdateSource,
    updateData: AdminAccountAvailabilityInput,
  ) {
    if (updateData.username && updateData.username !== current.username) {
      const [existingUser] = await this.db
        .select({ id: this.adminUser.id })
        .from(this.adminUser)
        .where(eq(this.adminUser.username, updateData.username))
        .limit(1)
      if (existingUser) {
        throw new BusinessException(
          BusinessErrorCode.RESOURCE_ALREADY_EXISTS,
          '用户名已存在',
        )
      }
    }

    if (updateData.mobile && updateData.mobile !== current.mobile) {
      const [existingUser] = await this.db
        .select({ id: this.adminUser.id })
        .from(this.adminUser)
        .where(eq(this.adminUser.mobile, updateData.mobile))
        .limit(1)
      if (existingUser) {
        throw new BusinessException(
          BusinessErrorCode.RESOURCE_ALREADY_EXISTS,
          '手机号已存在',
        )
      }
    }
  }

  // 校验新建管理员账号的用户名和可选手机号均未被占用。
  async assertAccountRegistrationFieldsAvailable(
    username: string,
    mobile?: string,
  ) {
    const [usernameExists] = await this.db
      .select({ id: this.adminUser.id })
      .from(this.adminUser)
      .where(eq(this.adminUser.username, username))
      .limit(1)
    if (usernameExists) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_ALREADY_EXISTS,
        '用户名已存在',
      )
    }

    if (!mobile) {
      return
    }
    const [mobileExists] = await this.db
      .select({ id: this.adminUser.id })
      .from(this.adminUser)
      .where(eq(this.adminUser.mobile, mobile))
      .limit(1)
    if (mobileExists) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_ALREADY_EXISTS,
        '手机号已存在',
      )
    }
  }

  // 管理员账号和角色绑定需要共享同一事务上下文。
  async withAdminAccountTransaction<T>(
    execute: AdminUserTransactionExecutor<T>,
  ): Promise<T> {
    return this.drizzle.withTransaction({ execute })
  }

  // 在事务内重新读取管理员账号的启用状态。
  async getLockedAdminAccountForUpdate(
    tx: AdminUserAccountTransaction,
    userId: number,
  ): Promise<AdminUserSafeUpdateTarget> {
    const [user] = await tx
      .select({ id: this.adminUser.id, isEnabled: this.adminUser.isEnabled })
      .from(this.adminUser)
      .where(eq(this.adminUser.id, userId))
      .limit(1)
    if (!user) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '用户不存在',
      )
    }
    return user
  }

  // 在事务内更新管理员账号；受影响行为空时保持账号不存在错误。
  async updateAdminAccountInTransaction(
    tx: AdminUserAccountTransaction,
    userId: number,
    data: Omit<AdminAccountUpdateDto, 'id' | 'roleIds'>,
  ) {
    const rows = await tx
      .update(this.adminUser)
      .set(data)
      .where(eq(this.adminUser.id, userId))
      .returning({ id: this.adminUser.id })
    this.drizzle.assertAffectedRows(rows, '用户不存在')
  }

  // 在事务内创建管理员账号并返回其标识。
  async createAdminAccountInTransaction(
    tx: AdminUserAccountTransaction,
    input: CreateAdminAccountInput,
  ) {
    const [user] = await tx
      .insert(this.adminUser)
      .values({ ...input, isEnabled: true })
      .returning({ id: this.adminUser.id })
    this.drizzle.assertAffectedRows([user], '用户创建失败')
    return user
  }

  // 获取管理员账号资料；用于本人信息和指定账号详情。
  async getAdminUserResponseSource(
    userId: number,
  ): Promise<AdminUserResponseSource> {
    const [user] = await this.db
      .select(this.adminUserResponseColumns)
      .from(this.adminUser)
      .where(eq(this.adminUser.id, userId))
      .limit(1)
    if (!user) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '用户不存在',
      )
    }
    return user
  }

  // 分页读取管理员账号及其角色摘要，避免应用层组合表级查询。
  async getAdminUserPage(query: UserPageDto) {
    const { username, isEnabled, mobile, roleId, ...pageDto } = query
    const conditions: SQL[] = []
    if (isEnabled !== undefined) {
      conditions.push(eq(this.adminUser.isEnabled, isEnabled))
    }
    if (username) {
      conditions.push(buildILikeCondition(this.adminUser.username, username)!)
    }
    if (mobile) {
      conditions.push(buildILikeCondition(this.adminUser.mobile, mobile)!)
    }
    if (roleId !== undefined) {
      conditions.push(
        exists(
          this.db
            .select({ adminUserId: this.adminUserRole.adminUserId })
            .from(this.adminUserRole)
            .where(
              and(
                eq(this.adminUserRole.roleId, roleId),
                eq(this.adminUserRole.adminUserId, this.adminUser.id),
              ),
            ),
        ),
      )
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined
    const page = this.drizzle.buildPage(pageDto)
    const order = this.drizzle.buildOrderBy(pageDto.orderBy, {
      table: this.adminUser,
    })
    const [users, total] = await Promise.all([
      this.db
        .select(this.adminUserResponseColumns)
        .from(this.adminUser)
        .where(where)
        .orderBy(...order.orderBySql)
        .limit(page.limit)
        .offset(page.offset),
      this.db.$count(this.adminUser, where),
    ])
    const rolesByUserId = await this.getRoleSummariesByUserIds(
      users.map((user) => user.id),
    )
    return toPageResult(
      users.map((user) => ({
        user,
        roles: rolesByUserId.get(user.id) ?? [],
      })),
      total,
      page,
    )
  }

  // 读取修改密码校验旧密码所需的凭据。
  async findPasswordCredentialByUserId(
    userId: number,
  ): Promise<AdminPasswordCredentialSource | undefined> {
    const [user] = await this.db
      .select({ id: this.adminUser.id, password: this.adminUser.password })
      .from(this.adminUser)
      .where(eq(this.adminUser.id, userId))
      .limit(1)
    return user
  }

  // 更新管理员密码并保留账号不存在错误语义。
  async updatePassword(userId: number, password: string) {
    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.adminUser)
          .set({ password })
          .where(eq(this.adminUser.id, userId)),
      { notFound: '用户不存在' },
    )
  }

  // 确认管理员账号仍存在，供解锁等无资料读取的操作使用。
  async assertAdminUserExists(userId: number) {
    const [user] = await this.db
      .select({ id: this.adminUser.id })
      .from(this.adminUser)
      .where(eq(this.adminUser.id, userId))
      .limit(1)
    if (!user) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '用户不存在',
      )
    }
  }

  // 查询角色摘要，并校验所有传入 role id 均存在。
  async getRequiredRoleSummaries(
    ids: number[],
  ): Promise<AdminRoleSummaryDto[]> {
    if (ids.length === 0) {
      return []
    }
    const roles = await this.db
      .select({
        id: this.adminRole.id,
        code: this.adminRole.code,
        name: this.adminRole.name,
        isSystem: this.adminRole.isSystem,
        isEnabled: this.adminRole.isEnabled,
      })
      .from(this.adminRole)
      .where(inArray(this.adminRole.id, ids))
    if (roles.length !== ids.length) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '角色不存在',
      )
    }
    return roles
  }

  // 批量组装账号列表所需的角色摘要，空输入直接返回空映射。
  private async getRoleSummariesByUserIds(userIds: number[]) {
    const normalized = Array.from(new Set(userIds))
    const rolesByUserId = new Map<number, AdminRoleSummaryDto[]>()
    if (normalized.length === 0) {
      return rolesByUserId
    }
    const rows = await this.db
      .select({
        adminUserId: this.adminUserRole.adminUserId,
        id: this.adminRole.id,
        code: this.adminRole.code,
        name: this.adminRole.name,
        isSystem: this.adminRole.isSystem,
        isEnabled: this.adminRole.isEnabled,
      })
      .from(this.adminUserRole)
      .innerJoin(
        this.adminRole,
        eq(this.adminRole.id, this.adminUserRole.roleId),
      )
      .where(inArray(this.adminUserRole.adminUserId, normalized))
      .orderBy(
        asc(this.adminUserRole.adminUserId),
        asc(this.adminRole.sortOrder),
        asc(this.adminRole.id),
      )
    for (const row of rows) {
      const roles = rolesByUserId.get(row.adminUserId) ?? []
      roles.push({
        id: row.id,
        code: row.code,
        name: row.name,
        isSystem: row.isSystem,
        isEnabled: row.isEnabled,
      })
      rolesByUserId.set(row.adminUserId, roles)
    }
    return rolesByUserId
  }

  // 只保留个人资料允许自助修改的字段，未传字段不参与更新。
  private toSelfProfileUpdateData(
    updateData: AdminSelfProfileUpdateDto,
  ): AdminUserProfileUpdateData {
    const data: AdminUserProfileUpdateData = {}
    if (updateData.username !== undefined) {
      data.username = updateData.username
    }
    if (updateData.avatar !== undefined) {
      data.avatar = updateData.avatar
    }
    if (updateData.mobile !== undefined) {
      data.mobile = updateData.mobile
    }
    return data
  }
}
