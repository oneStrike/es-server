import type {
  AppLoginUserSource,
  AppPasswordCredentialSource,
  AppPasswordResetUserSource,
  AppUserRegistrationInitializer,
  AppUserRegistrationResult,
} from './app-user-credential.type'
import type { SessionClientContext } from './session.type'
import { DrizzleService } from '@db/core'
import { allocateAppUserAccountInTx } from '@libs/identity/app-user-account'
import { GenderEnum } from '@libs/platform/constant'
import { AuthDefaultValue } from '@libs/platform/modules/auth/helpers'
import { Injectable } from '@nestjs/common'
import { and, eq, isNull, or } from 'drizzle-orm'

class AppUserRegistrationInitializationSnapshotDriftError extends Error {}

/**
 * 应用用户身份凭据服务。
 * 负责 app_user 的登录凭据读写与注册，应用入口只保留协议校验和响应编排。
 */
@Injectable()
export class AppUserCredentialService {
  constructor(private readonly drizzle: DrizzleService) {}

  private get db() {
    return this.drizzle.db
  }

  private get appUser() {
    return this.drizzle.schema.appUser
  }

  private get loginUserSelect() {
    return {
      id: this.appUser.id,
      account: this.appUser.account,
      phoneNumber: this.appUser.phoneNumber,
      emailAddress: this.appUser.emailAddress,
      nickname: this.appUser.nickname,
      password: this.appUser.password,
      avatarUrl: this.appUser.avatarUrl,
      profileBackgroundImageUrl: this.appUser.profileBackgroundImageUrl,
      signature: this.appUser.signature,
      bio: this.appUser.bio,
      isEnabled: this.appUser.isEnabled,
      genderType: this.appUser.genderType,
      birthDate: this.appUser.birthDate,
      status: this.appUser.status,
      banReason: this.appUser.banReason,
      banUntil: this.appUser.banUntil,
    } as const
  }

  // 按手机号读取登录凭据，软删除用户不参与认证。
  async findLoginUserByPhone(
    phone: string,
  ): Promise<AppLoginUserSource | undefined> {
    const [user] = await this.db
      .select(this.loginUserSelect)
      .from(this.appUser)
      .where(
        and(
          eq(this.appUser.phoneNumber, phone),
          isNull(this.appUser.deletedAt),
        ),
      )
      .limit(1)
    return user
  }

  // 按账号或手机号读取登录凭据，保持账号登录兼容手机号输入。
  async findLoginUserByAccountOrPhone(
    accountOrPhone: string,
  ): Promise<AppLoginUserSource | undefined> {
    const [user] = await this.db
      .select(this.loginUserSelect)
      .from(this.appUser)
      .where(
        and(
          or(
            eq(this.appUser.phoneNumber, accountOrPhone),
            eq(this.appUser.account, accountOrPhone),
          ),
          isNull(this.appUser.deletedAt),
        ),
      )
      .limit(1)
    return user
  }

  // 根据手机号读取找回密码所需的最小状态字段。
  async findPasswordResetUserByPhone(
    phone: string,
  ): Promise<AppPasswordResetUserSource | undefined> {
    const [user] = await this.db
      .select({
        id: this.appUser.id,
        isEnabled: this.appUser.isEnabled,
        status: this.appUser.status,
        banReason: this.appUser.banReason,
        banUntil: this.appUser.banUntil,
      })
      .from(this.appUser)
      .where(
        and(
          eq(this.appUser.phoneNumber, phone),
          isNull(this.appUser.deletedAt),
        ),
      )
      .limit(1)
    return user
  }

  // 读取修改密码校验旧密码所需的凭据。
  async findPasswordCredentialByUserId(
    userId: number,
  ): Promise<AppPasswordCredentialSource | undefined> {
    const [user] = await this.db
      .select({ id: this.appUser.id, password: this.appUser.password })
      .from(this.appUser)
      .where(and(eq(this.appUser.id, userId), isNull(this.appUser.deletedAt)))
      .limit(1)
    return user
  }

  // 更新密码；返回 false 供入口保持既有的账号不存在错误语义。
  async updatePassword(userId: number, password: string): Promise<boolean> {
    const rows = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.appUser)
        .set({ password })
        .where(eq(this.appUser.id, userId))
        .returning({ id: this.appUser.id }),
    )
    return rows.length > 0
  }

  // 登录成功后更新最近登录时间与属地快照。
  async updateLoginInfo(userId: number, clientContext: SessionClientContext) {
    await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.appUser)
        .set({
          lastLoginAt: new Date(),
          lastLoginIp: clientContext.ip || AuthDefaultValue.IP_ADDRESS_UNKNOWN,
          lastLoginGeoCountry: clientContext.geoCountry ?? null,
          lastLoginGeoProvince: clientContext.geoProvince ?? null,
          lastLoginGeoCity: clientContext.geoCity ?? null,
          lastLoginGeoIsp: clientContext.geoIsp ?? null,
        })
        .where(eq(this.appUser.id, userId)),
    )
  }

  // 注册应用用户并在同一事务中初始化用户域读模型。
  async registerAppUser(
    phone: string,
    password: string,
    initialize: AppUserRegistrationInitializer,
  ): Promise<AppUserRegistrationResult> {
    try {
      const user = await this.db.transaction(async (tx) => {
        const account = await allocateAppUserAccountInTx(tx)
        const [newUser] = await tx
          .insert(this.appUser)
          .values({
            account,
            nickname: `用户${account}`,
            password,
            phoneNumber: phone,
            genderType: GenderEnum.UNKNOWN,
            isEnabled: true,
            levelId: null,
          })
          .returning(this.loginUserSelect)

        const initializationOutcome = await initialize(tx, newUser.id)
        if (initializationOutcome === 'snapshot-drift') {
          throw new AppUserRegistrationInitializationSnapshotDriftError()
        }
        return newUser
      })
      return { outcome: 'registered', user }
    } catch (error) {
      if (
        error instanceof AppUserRegistrationInitializationSnapshotDriftError
      ) {
        return { outcome: 'initialization-snapshot-drift' }
      }
      return this.drizzle.handleError(error)
    }
  }
}
