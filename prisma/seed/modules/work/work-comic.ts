export async function createInitialWorkComics(prisma: any) {
  const comics = await prisma.work.findMany({
    where: { type: 1 },
    select: { id: true, name: true },
  })

  for (const comic of comics) {
    const existingComicExt = await prisma.workComic.findFirst({
      where: { workId: comic.id },
    })

    if (!existingComicExt) {
      await prisma.workComic.create({
        data: {
          workId: comic.id,
        },
      })
    }
  }
}
