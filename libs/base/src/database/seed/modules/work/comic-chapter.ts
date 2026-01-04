export async function createInitialComicChapters(prisma: any) {
  const comics = await prisma.workComic.findMany({
    select: { id: true, name: true },
  })

  for (const comic of comics) {
    const existingChapters = await prisma.workComicChapter.findMany({
      where: { comicId: comic.id },
    })

    if (existingChapters.length > 0) {
      continue
    }

    const chapterCount = comic.name === '海贼王' ? 20 : 10

    for (let i = 1; i <= chapterCount; i++) {
      await prisma.workComicChapter.create({
        data: {
          title: `第${i}话`,
          subtitle: `${comic.name} 第${i}话`,
          comicId: comic.id,
          isPublished: true,
          readRule: 0,
          contents: JSON.stringify([
            `https://example.com/comics/${comic.id}/chapter-${i}/page-1.jpg`,
            `https://example.com/comics/${comic.id}/chapter-${i}/page-2.jpg`,
            `https://example.com/comics/${comic.id}/chapter-${i}/page-3.jpg`,
          ]),
          isPreview: i <= 3,
          publishAt: new Date(),
          sortOrder: i,
          downloadRule: 1,
          canComment: true,
        },
      })
    }
  }
}
