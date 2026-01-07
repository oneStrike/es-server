import { makePrismaClient } from './libs/base/src/database'

const prisma = makePrismaClient('postgresql://postgres:259158@localhost:5432/foo')

async function cleanupDuplicateSections() {
  try {
    console.log('=== 清理重复板块 ===\n')

    const duplicateSections = await prisma.forumSection.findMany({
      where: {
        name: {
          in: ['技术交流', '经验分享', '问答专区', '活动公告', '建议反馈'],
        },
        deletedAt: null,
      },
    })

    console.log('找到需要删除的重复板块:', duplicateSections.length)

    for (const section of duplicateSections) {
      await prisma.forumSection.update({
        where: { id: section.id },
        data: { deletedAt: new Date() },
      })
      console.log(`  - 已软删除 "${section.name}" (ID: ${section.id})`)
    }

    console.log('\n=== 清理完成 ===')
  }
  catch (error) {
    console.error('清理失败:', error)
  }
  finally {
    await prisma.$disconnect()
  }
}

cleanupDuplicateSections()