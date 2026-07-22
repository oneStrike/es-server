import type { Db } from '../../db-client'
import {
  adminRole,
  AdminSystemRoleCode,
  adminUser,
  adminUserRole,
  adminUserToken,
} from '@db/schema'
import { TokenTypeEnum } from '@libs/platform/modules/auth/types'
import { eq } from 'drizzle-orm'
import {
  createAvatar,
  createSeedPasswordHash,
  SEED_ADMIN_USERNAME,
  SEED_TIMELINE,
} from '../../shared'

const ADMIN_FIXTURE = {
  username: SEED_ADMIN_USERNAME,
  mobile: '13800138099',
  avatar: createAvatar('admin-primary'),
  isEnabled: true,
  lastLoginAt: SEED_TIMELINE.seedAt,
  lastLoginIp: '127.0.0.1',
}

const ADMIN_TOKEN_FIXTURE = {
  jti: 'admin-access-token',
  tokenType: TokenTypeEnum.ACCESS,
  expiresAt: new Date('2026-12-31T23:59:59.000Z'),
  deviceInfo: {
    device: 'desktop',
    os: 'Windows',
    browser: 'Seed Runner',
  },
  ipAddress: '127.0.0.1',
  userAgent: 'mandu-admin/1.0.0',
}

export async function seedAdminDomain(db: Db) {
  console.log('🌱 初始化管理员域数据...')
  const adminFixture = {
    ...ADMIN_FIXTURE,
    password: await createSeedPasswordHash(),
  }

  let admin = await db.query.adminUser.findFirst({
    where: { username: adminFixture.username },
    columns: {
      id: true,
      username: true,
    },
  })

  if (!admin) {
    ;[admin] = await db.insert(adminUser).values(adminFixture).returning()
    console.log(`  ✓ 管理员创建: ${admin.username}`)
  } else {
    ;[admin] = await db
      .update(adminUser)
      .set(adminFixture)
      .where(eq(adminUser.id, admin.id))
      .returning()
    console.log(`  ↺ 管理员更新: ${admin.username}`)
  }

  const [superAdminRole] = await db
    .select({ id: adminRole.id })
    .from(adminRole)
    .where(eq(adminRole.code, AdminSystemRoleCode.SUPER_ADMIN))
    .limit(1)
  if (!superAdminRole) {
    throw new Error(
      'Demo seed requires admin-api startup RBAC synchronization to create the super_admin role first',
    )
  }
  await db
    .insert(adminUserRole)
    .values({ adminUserId: admin.id, roleId: superAdminRole.id })
    .onConflictDoNothing()

  const existingToken = await db.query.adminUserToken.findFirst({
    where: { jti: ADMIN_TOKEN_FIXTURE.jti },
    columns: {
      id: true,
    },
  })

  if (!existingToken) {
    await db.insert(adminUserToken).values({
      ...ADMIN_TOKEN_FIXTURE,
      userId: admin.id,
    })
    console.log('  ✓ 管理员令牌创建')
  } else {
    await db
      .update(adminUserToken)
      .set({
        ...ADMIN_TOKEN_FIXTURE,
        userId: admin.id,
      })
      .where(eq(adminUserToken.id, existingToken.id))
    console.log('  ↺ 管理员令牌更新')
  }

  console.log('✅ 管理员域数据完成')
}
