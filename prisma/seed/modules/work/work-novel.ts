interface INovelExtData {
  workId: number
  wordCount: number
}

const NOVEL_WORD_COUNTS: Record<string, number> = {
  挪威的森林: 180000,
  白夜行: 350000,
  嫌疑人X的献身: 150000,
}

export async function createInitialWorkNovels(prisma: any) {
  const novels = await prisma.work.findMany({
    where: { type: 2 },
    select: { id: true, name: true },
  })

  for (const novel of novels) {
    const existingNovelExt = await prisma.workNovel.findFirst({
      where: { workId: novel.id },
    })

    if (!existingNovelExt) {
      const wordCount = NOVEL_WORD_COUNTS[novel.name] ?? 100000
      await prisma.workNovel.create({
        data: {
          workId: novel.id,
          wordCount,
        },
      })
    }
  }
}
