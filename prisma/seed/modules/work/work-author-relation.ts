export async function createInitialWorkAuthorRelations(prisma: any) {
  const works = await prisma.work.findMany({
    select: { id: true, name: true, type: true },
  })

  const authors = await prisma.workAuthor.findMany({
    select: { id: true, name: true },
  })

  const workAuthorMap: Record<string, string[]> = {
    进击的巨人: ['村上春树'],
    海贼王: ['尾田荣一郎'],
    鬼灭之刃: ['东野圭吾'],
    你的名字: ['村上春树'],
    龙珠: ['鸟山明'],
    火影忍者: ['岸本齐史'],
    挪威的森林: ['村上春树'],
    白夜行: ['东野圭吾'],
    嫌疑人X的献身: ['东野圭吾'],
  }

  for (const work of works) {
    const authorNames = workAuthorMap[work.name]

    if (!authorNames) {
      continue
    }

    for (const authorName of authorNames) {
      const author = authors.find((a: any) => a.name === authorName)

      if (!author) {
        continue
      }

      const existingRelation = await prisma.workAuthorRelation.findFirst({
        where: {
          workId: work.id,
          authorId: author.id,
        },
      })

      if (!existingRelation) {
        await prisma.workAuthorRelation.create({
          data: {
            workId: work.id,
            authorId: author.id,
            sortOrder: 0,
          },
        })
      }
    }
  }
}
