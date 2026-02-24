export async function createInitialWorkCategoryRelations(prisma: any) {
  const works = await prisma.work.findMany({
    select: { id: true, name: true },
  })

  const categories = await prisma.workCategory.findMany({
    select: { id: true, name: true },
  })

  const workCategoryMap: Record<string, string[]> = {
    进击的巨人: ['热血', '冒险', '科幻'],
    海贼王: ['热血', '冒险', '喜剧'],
    鬼灭之刃: ['热血', '冒险', '温馨'],
    你的名字: ['温馨', '恋爱', '校园'],
    龙珠: ['热血', '冒险', '科幻'],
    火影忍者: ['热血', '冒险', '科幻'],
    挪威的森林: ['恋爱', '文学', '治愈'],
    白夜行: ['悬疑', '推理', '犯罪'],
    嫌疑人X的献身: ['悬疑', '推理', '犯罪'],
  }

  for (const work of works) {
    const categoryNames = workCategoryMap[work.name]

    if (!categoryNames) {
      continue
    }

    for (const categoryName of categoryNames) {
      const category = categories.find((c: any) => c.name === categoryName)

      if (!category) {
        continue
      }

      const existingRelation = await prisma.workCategoryRelation.findFirst({
        where: {
          workId: work.id,
          categoryId: category.id,
        },
      })

      if (!existingRelation) {
        await prisma.workCategoryRelation.create({
          data: {
            workId: work.id,
            categoryId: category.id,
            sortOrder: 0,
          },
        })
      }
    }
  }
}
