export async function createInitialComicCategories(prisma: any) {
  const comics = await prisma.workComic.findMany({
    select: { id: true, name: true },
  })

  const categories = await prisma.workCategory.findMany({
    select: { id: true, name: true },
  })

  const comicCategoryMap: Record<string, string[]> = {
    进击的巨人: ['热血', '冒险', '科幻'],
    海贼王: ['热血', '冒险', '喜剧'],
    鬼灭之刃: ['热血', '冒险', '温馨'],
    你的名字: ['温馨', '恋爱', '校园'],
    龙珠: ['热血', '冒险', '科幻'],
    火影忍者: ['热血', '冒险', '科幻'],
  }

  for (const comic of comics) {
    const categoryNames = comicCategoryMap[comic.name]

    if (!categoryNames) {
      continue
    }

    for (const categoryName of categoryNames) {
      const category = categories.find((c: any) => c.name === categoryName)

      if (!category) {
        continue
      }

      const existingRelation = await prisma.workComicCategory.findFirst({
        where: {
          comicId: comic.id,
          categoryId: category.id,
        },
      })

      if (!existingRelation) {
        await prisma.workComicCategory.create({
          data: {
            comicId: comic.id,
            categoryId: category.id,
          },
        })
      }
    }
  }
}
