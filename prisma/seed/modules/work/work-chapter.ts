export async function createInitialWorkChapters(prisma: any) {
  const works = await prisma.work.findMany({
    select: { id: true, name: true, type: true },
  })

  for (const work of works) {
    const existingChapters = await prisma.workChapter.findMany({
      where: { workId: work.id },
    })

    if (existingChapters.length > 0) {
      continue
    }

    const chapterCount = work.name === '海贼王' ? 20 : 10

    for (let i = 1; i <= chapterCount; i++) {
      await prisma.workChapter.create({
        data: {
          title: `第${i}话`,
          subtitle: `${work.name} 第${i}话`,
          workId: work.id,
          workType: work.type,
          isPublished: true,
          readRule: 0,
          content: null,
          isPreview: i <= 3,
          publishAt: new Date(),
          sortOrder: i,
          downloadRule: 1,
          canComment: true,
          viewCount: 0,
          likeCount: 0,
          commentCount: 0,
          purchaseCount: 0,
          wordCount: work.type === 2 ? 3000 + Math.floor(Math.random() * 2000) : 0,
        },
      })
    }
  }
}
