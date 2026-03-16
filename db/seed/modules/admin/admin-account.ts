import { eq } from 'drizzle-orm'
import type { Db } from '../../db-client'
import { adminUser } from '../../../schema/admin/admin-user'

const DEFAULT_ADMIN = {
  username: 'admin',
  password: 'e54d37047759e69ae2ffd34850ce3281.0275adf4e59d2e4e5d64f8694e327a0e8960a81bcecde7b47eaf3d76878f50b1b8ec520eb1bc0171336ec0dfb07f78611672be9fa335e1834cff45ebb68a98ac',
  mobile: '13800138000',
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin',
  role: 1,
  isEnabled: true,
}

export async function seedAdminAccount(db: Db) {
  console.log('🌱 开始初始化管理员账号...')

  const existing = await db.query.adminUser.findFirst({
    where: eq(adminUser.username, DEFAULT_ADMIN.username),
  })

  if (!existing) {
    await db.insert(adminUser).values({
      ...DEFAULT_ADMIN,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    console.log('  ✓ 管理员账号已创建')
  } else {
    console.log('  ℹ 管理员账号已存在')
  }

  console.log('✅ 管理员账号初始化完成')
}
