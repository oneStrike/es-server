import { makePrismaClient } from './libs/base/src/database'

const prisma = makePrismaClient('postgresql://postgres:259158@localhost:5432/foo')

async function fixMigration() {
  try {
    console.log('=== 修复数据迁移 ===\n')

    const techGroup = await prisma.forumSectionGroup.findFirst({
      where: { name: '技术交流' },
    })

    if (!techGroup) {
      console.error('找不到技术交流分组')
      return
    }

    console.log('找到技术交流分组:', techGroup.id)

    const techSections = await prisma.forumSection.findMany({
      where: {
        name: { in: ['前端开发', '后端开发', '数据库'] },
        deletedAt: null,
      },
    })

    console.log('找到技术相关板块:', techSections.length)

    for (const section of techSections) {
      await prisma.forumSection.update({
        where: { id: section.id },
        data: { groupId: techGroup.id },
      })
      console.log(`  - 已将 "${section.name}" (ID: ${section.id}) 关联到分组 ${techGroup.id}`)
    }

    console.log('\n=== 数据迁移修复完成 ===')
  }
  catch (error) {
    console.error('修复失败:', error)
  }
  finally {
    await prisma.$disconnect()
  }
}

fixMigration()