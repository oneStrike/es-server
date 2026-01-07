import { makePrismaClient } from './libs/base/src/database'

const prisma = makePrismaClient('postgresql://postgres:259158@localhost:5432/foo')

async function checkMigration() {
  try {
    console.log('=== 检查迁移情况 ===\n')

    const sections = await prisma.forumSection.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        groupId: true,
        sortOrder: true,
      },
      orderBy: { id: 'asc' },
    })

    console.log('所有板块:')
    sections.forEach((s) => {
      console.log(`  - ID: ${s.id}, 名称: ${s.name}, 分组ID: ${s.groupId}, 排序: ${s.sortOrder}`)
    })

    console.log('\n')

    const groups = await prisma.forumSectionGroup.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        sortOrder: true,
      },
      orderBy: { id: 'asc' },
    })

    console.log('所有分组:')
    groups.forEach((g) => {
      console.log(`  - ID: ${g.id}, 名称: ${g.name}, 排序: ${g.sortOrder}`)
    })
  }
  catch (error) {
    console.error('检查失败:', error)
  }
  finally {
    await prisma.$disconnect()
  }
}

checkMigration()