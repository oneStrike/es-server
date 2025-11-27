/**
 * 作者角色类型种子数据
 */
export async function seedWorkAuthorRoleType(prisma: any) {
  const roleTypes = [
    {
      code: 'MANGAKA',
      name: '漫画家',
      description: '负责漫画创作的核心画师',
    },
    {
      code: 'WRITER',
      name: '作家',
      description: '负责文字内容创作',
    },
    {
      code: 'ILLUSTRATOR',
      name: '插画师',
      description: '负责插画绘制',
    },
    {
      code: 'MODEL',
      name: '模特',
      description: '写真、摄影作品的模特',
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
}
