import type { Db } from '../../db-client'
import { eq } from 'drizzle-orm'
import { AdminUserRoleEnum } from '../../../../libs/platform/src/constant/user.constant'
import { adminUser, adminUserToken } from '../../../schema'
import {
  createAvatar,
  SEED_ADMIN_USERNAME,
  SEED_PASSWORD_HASH,
  SEED_TIMELINE,
} from '../../shared'

const ADMIN_FIXTURE = {
  username: SEED_ADMIN_USERNAME,
  password: SEED_PASSWORD_HASH,
  mobile: '13800138099',
  avatar: createAvatar('seed-admin'),
  role: AdminUserRoleEnum.SUPER_ADMIN,
  isEnabled: true,
  lastLoginAt: SEED_TIMELINE.seedAt,
  lastLoginIp: '127.0.0.1',
}

const ADMIN_TOKEN_FIXTURE = {
  jti: 'seed-admin-access-token',
  tokenType: 'ACCESS',
  expiresAt: new Date('2026-12-31T23:59:59.000Z'),
  deviceInfo: {
    device: 'desktop',
    os: 'Windows',
    browser: 'Seed Runner',
  },
  ipAddress: '127.0.0.1',
  userAgent: 'seed-script/admin',
}

export async function seedAdminDomain(db: Db) {
  console.log('🌱 初始化管理员域数据...')

  let admin = await db.query.adminUser.findFirst({
    where: eq(adminUser.username, ADMIN_FIXTURE.username),
  })

  if (!admin) {
    ;[admin] = await db.insert(adminUser).values(ADMIN_FIXTURE).returning()
    console.log(`  ✓ 管理员创建: ${admin.username}`)
  } else {
    ;[admin] = await db
      .update(adminUser)
      .set(ADMIN_FIXTURE)
      .where(eq(adminUser.id, admin.id))
      .returning()
    console.log(`  ↺ 管理员更新: ${admin.username}`)
  }

  const existingToken = await db.query.adminUserToken.findFirst({
    where: eq(adminUserToken.jti, ADMIN_TOKEN_FIXTURE.jti),
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
