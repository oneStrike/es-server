export async function createInitialWorkComments(prisma: any) {
  const works = await prisma.work.findMany({
    select: { id: true, name: true, type: true },
  })

  const users = await prisma.appUser.findMany({
    select: { id: true, nickname: true },
  })

  if (users.length === 0) {
    return
  }

  const sampleComments = [
    '这部作品太棒了！',
    '剧情非常精彩，期待后续更新！',
    '画风很棒，故事也很感人。',
    '强烈推荐！',
    '看了好几遍，每次都有新的感悟。',
    '作者太有才了！',
    '这是我看过最好的作品之一。',
    '期待更多章节！',
  ]

  for (const work of works) {
    const existingComments = await prisma.workComment.findMany({
      where: { workId: work.id },
    })

    if (existingComments.length > 0) {
      continue
    }

    const commentCount = Math.floor(Math.random() * 3) + 1

    for (let i = 0; i < commentCount; i++) {
      const randomUser = users[Math.floor(Math.random() * users.length)]
      const randomComment =
        sampleComments[Math.floor(Math.random() * sampleComments.length)]

      await prisma.workComment.create({
        data: {
          workId: work.id,
          workType: work.type,
          chapterId: null,
          userId: randomUser.id,
          content: randomComment,
          floor: i + 1,
          isHidden: false,
          auditStatus: 1,
        },
      })
    }
  }
}
