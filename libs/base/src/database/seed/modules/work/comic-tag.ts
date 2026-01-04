export async function createInitialComicTags(prisma: any) {
  const comics = await prisma.workComic.findMany({
    select: { id: true, name: true },
  })

  const tags = await prisma.workTag.findMany({
    select: { id: true, name: true },
  })

  const comicTagMap: Record<string, string[]> = {
    进击的巨人: ['热血', '冒险', '科幻', '战争'],
    海贼王: ['热血', '冒险', '喜剧', '奇幻'],
    鬼灭之刃: ['热血', '冒险', '奇幻'],
    你的名字: ['爱情', '奇幻', '校园'],
    龙珠: ['热血', '冒险', '科幻', '喜剧'],
    火影忍者: ['热血', '冒险', '科幻', '奇幻'],
  }

  for (const comic of comics) {
    const tagNames = comicTagMap[comic.name]

    if (!tagNames) {
      continue
    }

    for (const tagName of tagNames) {
      const tag = tags.find((t: any) => t.name === tagName)

      if (!tag) {
        continue
      }

      const existingRelation = await prisma.workComicTag.findFirst({
        where: {
          comicId: comic.id,
          tagId: tag.id,
        },
      })

      if (!existingRelation) {
        await prisma.workComicTag.create({
          data: {
            comicId: comic.id,
            tagId: tag.id,
          },
        })
      }
    }
  }
}
