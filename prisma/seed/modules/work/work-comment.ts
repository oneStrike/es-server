/**
 * 作品评论种子数据
 * 使用统一的 UserComment 模型
 * targetType: 1=漫画, 2=小说, 3=漫画章节, 4=小说章节, 5=论坛主题
 */
export async function createInitialWorkComments(prisma: any) {
  const works = await prisma.work.findMany({
    select: { id: true, type: true },
  })

  const users = await prisma.appUser.findMany({
    select: { id: true },
  })

  if (users.length === 0 || works.length === 0) {
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
    // targetType: 1=漫画, 2=小说
    const targetType = work.type

    const existingComments = await prisma.userComment.findMany({
      where: { targetType, targetId: work.id },
    })

    if (existingComments.length > 0) {
      continue
    }

    const commentCount = Math.floor(Math.random() * 3) + 1

    for (let i = 0; i < commentCount; i++) {
      const randomUser = users[Math.floor(Math.random() * users.length)]
      const randomComment =
        sampleComments[Math.floor(Math.random() * sampleComments.length)]

      await prisma.userComment.create({
        data: {
          targetType,
          targetId: work.id,
          userId: randomUser.id,
          content: randomComment,
          floor: i + 1,
          isHidden: false,
          auditStatus: 1,
          replyToId: null,
          actualReplyToId: null,
          auditById: null,
          auditRole: null,
          auditReason: null,
          auditAt: null,
          sensitiveWordHits: null,
          likeCount: Math.floor(Math.random() * 20),
        },
      })
    }
  }
}
