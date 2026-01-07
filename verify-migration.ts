import { makePrismaClient } from './libs/base/src/database'

const prisma = makePrismaClient('postgresql://postgres:259158@localhost:5432/foo')

async function verifyMigration() {
  try {
    console.log('=== 验证论坛板块扁平化改造 ===\n')

    const groups = await prisma.forumSectionGroup.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    })
    console.log('板块分组数量:', groups.length)
    console.log('分组列表:')
    groups.forEach((g) => {
      console.log(`  - ID: ${g.id}, 名称: ${g.name}, 排序: ${g.sortOrder}`)
    })

    console.log('\n')

    const sections = await prisma.forumSection.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    })
    console.log('板块数量:', sections.length)
    console.log('板块列表:')
    sections.forEach((s) => {
      console.log(`  - ID: ${s.id}, 名称: ${s.name}, 分组ID: ${s.groupId}`)
    })

    console.log('\n=== 验证完成 ===')
  }
  catch (error) {
    console.error('验证失败:', error)
  }
  finally {
    await prisma.$disconnect()
  }
}

verifyMigration()