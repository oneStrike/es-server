import type { PrismaClient } from '@prisma/client'

/**
 * 作者角色类型种子数据
 */
export async function seedWorkAuthorRoleType(prisma: PrismaClient) {
  console.log('🌱 开始初始化作者角色类型数据...')

  const roleTypes = [
    {
      code: 'MANGAKA',
      name: '漫画家',
      description: '负责漫画创作的核心画师',
      sortOrder: 1,
    },
    {
      code: 'WRITER',
      name: '作家',
      description: '负责文字内容创作',
      sortOrder: 2,
    },
    {
      code: 'ILLUSTRATOR',
      name: '插画师',
      description: '负责插画绘制',
      sortOrder: 3,
    },
    {
      code: 'MODEL',
      name: '模特',
      description: '写真、摄影作品的模特',
      sortOrder: 4,
    },
  ]

  // 使用 upsert 确保幂等性
  for (const roleType of roleTypes) {
    await prisma.workAuthorRoleType.upsert({
      where: { code: roleType.code },
      update: roleType,
      create: roleType,
    })
  }

  console.log(`✅ 作者角色类型数据初始化完成，共 ${roleTypes.length} 条记录`)
}
