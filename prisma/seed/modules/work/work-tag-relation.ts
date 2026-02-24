export async function createInitialWorkTagRelations(prisma: any) {
  const works = await prisma.work.findMany({
    select: { id: true, name: true },
  })

  const tags = await prisma.workTag.findMany({
    select: { id: true, name: true },
  })

  const workTagMap: Record<string, string[]> = {
    进击的巨人: ['热血', '冒险', '科幻', '战争'],
    海贼王: ['热血', '冒险', '喜剧', '奇幻'],
    鬼灭之刃: ['热血', '冒险', '奇幻'],
    你的名字: ['爱情', '奇幻', '校园'],
    龙珠: ['热血', '冒险', '科幻', '喜剧'],
    火影忍者: ['热血', '冒险', '科幻', '奇幻'],
    挪威的森林: ['爱情', '治愈', '青春'],
    白夜行: ['悬疑', '推理', '黑暗'],
    嫌疑人X的献身: ['悬疑', '推理', '爱情'],
  }

  for (const work of works) {
    const tagNames = workTagMap[work.name]

    if (!tagNames) {
      continue
    }

    for (const tagName of tagNames) {
      const tag = tags.find((t: any) => t.name === tagName)

      if (!tag) {
        continue
      }

      const existingRelation = await prisma.workTagRelation.findFirst({
        where: {
          workId: work.id,
          tagId: tag.id,
        },
      })

      if (!existingRelation) {
        await prisma.workTagRelation.create({
          data: {
            workId: work.id,
            tagId: tag.id,
            sortOrder: 0,
          },
        })
      }
    }
  }
}
