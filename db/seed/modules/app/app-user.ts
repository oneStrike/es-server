import { eq } from 'drizzle-orm'
import type { Db } from '../../db-client'
import { appUser } from '../../../schema/app/app-user'

interface IAppUserData {
  account: string
  nickname: string
  avatar: string
  phone: string
  email: string
  isEnabled: boolean
  gender: number
  password: string
}

const TEST_USERS: IAppUserData[] = [
  {
    account: 'test001',
    nickname: '测试用户',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=testuser',
    phone: '13800138000',
    email: 'test@example.com',
    isEnabled: true,
    gender: 1,
    password:
      'e54d37047759e69ae2ffd34850ce3281.0275adf4e59d2e4e5d64f8694e327a0e8960a81bcecde7b47eaf3d76878f50b1b8ec520eb1bc0171336ec0dfb07f78611672be9fa335e1834cff45ebb68a98ac',
  },
  {
    account: 'user001',
    nickname: '漫画迷小王',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=user001',
    phone: '13800138001',
    email: 'user001@example.com',
    isEnabled: true,
    gender: 1,
    password:
      'e54d37047759e69ae2ffd34850ce3281.0275adf4e59d2e4e5d64f8694e327a0e8960a81bcecde7b47eaf3d76878f50b1b8ec520eb1bc0171336ec0dfb07f78611672be9fa335e1834cff45ebb68a98ac',
  },
  {
    account: 'user002',
    nickname: '二次元少女',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=user002',
    phone: '13800138002',
    email: 'user002@example.com',
    isEnabled: true,
    gender: 2,
    password:
      'e54d37047759e69ae2ffd34850ce3281.0275adf4e59d2e4e5d64f8694e327a0e8960a81bcecde7b47eaf3d76878f50b1b8ec520eb1bc0171336ec0dfb07f78611672be9fa335e1834cff45ebb68a98ac',
  },
]

export async function seedAppUsers(db: Db) {
  console.log('🌱 开始初始化应用用户...')

  const createdUsers: Array<{ id: number; phone: string }> = []

  for (const user of TEST_USERS) {
    const existing = await db.query.appUser.findFirst({
      where: eq(appUser.phone, user.phone),
    })

    if (!existing) {
      const [created] = await db
        .insert(appUser)
        .values({
          ...user,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning({ id: appUser.id, phone: appUser.phone })

      createdUsers.push(created)
      console.log(`  ✓ 用户创建: ${user.nickname} (${user.phone})`)
    } else {
      createdUsers.push({ id: existing.id, phone: existing.phone })
      console.log(`  ℹ 用户已存在: ${user.nickname} (${user.phone})`)
    }
  }

  console.log('✅ 应用用户初始化完成')
  return createdUsers
}
