export async function createInitialComicAuthors(prisma: any) {
  const comics = await prisma.workComic.findMany({
    select: { id: true, name: true },
  })

  const authors = await prisma.workAuthor.findMany({
    select: { id: true, name: true },
  })

  const comicAuthorMap: Record<string, string[]> = {
    进击的巨人: ['村上春树'],
    海贼王: ['尾田荣一郎'],
    鬼灭之刃: ['东野圭吾'],
    你的名字: ['村上春树'],
    龙珠: ['鸟山明'],
    火影忍者: ['岸本齐史'],
  }

  for (const comic of comics) {
    const authorNames = comicAuthorMap[comic.name]

    if (!authorNames) {
      continue
    }

    for (const authorName of authorNames) {
      const author = authors.find((a: any) => a.name === authorName)

      if (!author) {
        continue
      }

      const existingRelation = await prisma.workComicAuthor.findFirst({
        where: {
          comicId: comic.id,
          authorId: author.id,
        },
      })

      if (!existingRelation) {
        await prisma.workComicAuthor.create({
          data: {
            comicId: comic.id,
            authorId: author.id,
          },
        })
      }
    }
  }
}
