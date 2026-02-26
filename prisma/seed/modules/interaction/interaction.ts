import type { PrismaClient } from '@prisma/client'

/**
 * 创建交互模块初始数据
 * 包含点赞、收藏、浏览记录、评论、评论点赞、评论举报、下载等测试数据
 */
export async function createInitialInteractionData(prisma: PrismaClient) {
  console.log('🌱 开始初始化交互模块数据...')

  // 获取测试用户ID（假设已有用户数据）
  const users = await prisma.appUser.findMany({ take: 5 })
  if (users.length === 0) {
    console.log('⚠️ 没有用户数据，跳过交互数据初始化')
    return
  }

  // 获取作品数据
  const works = await prisma.work.findMany({ take: 10 })
  if (works.length === 0) {
    console.log('⚠️ 没有作品数据，跳过交互数据初始化')
    return
  }

  // 获取章节数据
  const chapters = await prisma.workChapter.findMany({ take: 20 })

  // 获取论坛主题数据
  const topics = await prisma.forumTopic.findMany({ take: 10 })

  const userIds = users.map((u) => u.id)
  const workIds = works.map((w) => w.id)
  const chapterIds = chapters.map((c) => c.id)
  const topicIds = topics.map((t) => t.id)

  // 1. 创建点赞数据
  await createLikes(prisma, userIds, workIds, chapterIds, topicIds)

  // 2. 创建收藏数据
  await createFavorites(prisma, userIds, workIds, topicIds)

  // 3. 创建浏览记录数据
  await createViews(prisma, userIds, workIds, chapterIds, topicIds)

  // 4. 创建评论数据
  const commentIds = await createComments(
    prisma,
    userIds,
    workIds,
    chapterIds,
    topicIds,
  )

  // 5. 创建评论点赞数据
  if (commentIds.length > 0) {
    await createCommentLikes(prisma, userIds, commentIds)
  }

  // 6. 创建下载数据
  if (chapterIds.length > 0) {
    await createDownloads(prisma, userIds, workIds, chapterIds)
  }

  console.log('✅ 交互模块数据初始化完成')
}

/**
 * 创建点赞数据
 * targetType: 1=漫画, 2=小说, 3=漫画章节, 4=小说章节, 5=论坛主题
 */
async function createLikes(
  prisma: PrismaClient,
  userIds: number[],
  workIds: number[],
  chapterIds: number[],
  topicIds: number[],
) {
  const likes = []

  // 作品点赞 (targetType: 1=漫画, 2=小说)
  for (const userId of userIds.slice(0, 3)) {
    for (const workId of workIds.slice(0, 5)) {
      likes.push({
        targetType: Math.random() > 0.5 ? 1 : 2,
        targetId: workId,
        userId,
        createdAt: new Date(
          Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000),
        ),
      })
    }
  }

  // 章节点赞 (targetType: 3=漫画章节, 4=小说章节)
  for (const userId of userIds.slice(0, 2)) {
    for (const chapterId of chapterIds.slice(0, 10)) {
      likes.push({
        targetType: Math.random() > 0.5 ? 3 : 4,
        targetId: chapterId,
        userId,
        createdAt: new Date(
          Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000),
        ),
      })
    }
  }

  // 论坛主题点赞 (targetType: 5)
  for (const userId of userIds.slice(0, 3)) {
    for (const topicId of topicIds.slice(0, 5)) {
      likes.push({
        targetType: 5,
        targetId: topicId,
        userId,
        createdAt: new Date(
          Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000),
        ),
      })
    }
  }

  if (likes.length > 0) {
    await prisma.userLike.createMany({
      data: likes,
      skipDuplicates: true,
    })
    console.log(`  ✅ 创建 ${likes.length} 条点赞记录`)
  }
}

/**
 * 创建收藏数据
 * targetType: 1=漫画, 2=小说, 5=论坛主题
 */
async function createFavorites(
  prisma: PrismaClient,
  userIds: number[],
  workIds: number[],
  topicIds: number[],
) {
  const favorites = []

  // 作品收藏
  for (const userId of userIds.slice(0, 3)) {
    for (const workId of workIds.slice(0, 5)) {
      favorites.push({
        targetType: Math.random() > 0.5 ? 1 : 2,
        targetId: workId,
        userId,
        createdAt: new Date(
          Date.now() - Math.floor(Math.random() * 14 * 24 * 60 * 60 * 1000),
        ),
      })
    }
  }

  // 论坛主题收藏
  for (const userId of userIds.slice(0, 2)) {
    for (const topicId of topicIds.slice(0, 3)) {
      favorites.push({
        targetType: 5,
        targetId: topicId,
        userId,
        createdAt: new Date(
          Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000),
        ),
      })
    }
  }

  if (favorites.length > 0) {
    await prisma.userFavorite.createMany({
      data: favorites,
      skipDuplicates: true,
    })
    console.log(`  ✅ 创建 ${favorites.length} 条收藏记录`)
  }
}

/**
 * 创建浏览记录数据
 * targetType: 1=漫画, 2=小说, 3=漫画章节, 4=小说章节, 5=论坛主题
 */
async function createViews(
  prisma: PrismaClient,
  userIds: number[],
  workIds: number[],
  chapterIds: number[],
  topicIds: number[],
) {
  const views = []
  const devices = ['mobile', 'desktop', 'tablet']

  // 作品浏览
  for (const userId of userIds) {
    for (const workId of workIds.slice(0, 5)) {
      views.push({
        targetType: Math.random() > 0.5 ? 1 : 2,
        targetId: workId,
        userId,
        ipAddress: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
        device: devices[Math.floor(Math.random() * devices.length)],
        userAgent: 'Mozilla/5.0 (Test)',
        viewedAt: new Date(
          Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000),
        ),
      })
    }
  }

  // 章节浏览
  for (const userId of userIds) {
    for (const chapterId of chapterIds.slice(0, 10)) {
      views.push({
        targetType: Math.random() > 0.5 ? 3 : 4,
        targetId: chapterId,
        userId,
        ipAddress: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
        device: devices[Math.floor(Math.random() * devices.length)],
        userAgent: 'Mozilla/5.0 (Test)',
        viewedAt: new Date(
          Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000),
        ),
      })
    }
  }

  // 论坛主题浏览
  for (const userId of userIds) {
    for (const topicId of topicIds.slice(0, 5)) {
      views.push({
        targetType: 5,
        targetId: topicId,
        userId,
        ipAddress: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
        device: devices[Math.floor(Math.random() * devices.length)],
        userAgent: 'Mozilla/5.0 (Test)',
        viewedAt: new Date(
          Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000),
        ),
      })
    }
  }

  if (views.length > 0) {
    await prisma.userView.createMany({ data: views })
    console.log(`  ✅ 创建 ${views.length} 条浏览记录`)
  }
}

/**
 * 创建评论数据
 * targetType: 1=漫画, 2=小说, 3=漫画章节, 4=小说章节, 5=论坛主题
 */
async function createComments(
  prisma: PrismaClient,
  userIds: number[],
  workIds: number[],
  chapterIds: number[],
  topicIds: number[],
): Promise<number[]> {
  const comments = []
  const contents = [
    '这个作品真的很棒！',
    '剧情很精彩，期待更新',
    '画风很喜欢，支持作者',
    '角色塑造得很好',
    '这个章节太精彩了',
    '期待下一话',
    '故事情节很吸引人',
    '画得真好，加油',
    '这个转折没想到',
    '太喜欢了，收藏了',
  ]

  let floor = 1

  // 作品评论
  for (const workId of workIds.slice(0, 5)) {
    for (const userId of userIds.slice(0, 3)) {
      comments.push({
        targetType: Math.random() > 0.5 ? 1 : 2,
        targetId: workId,
        userId,
        content: contents[Math.floor(Math.random() * contents.length)],
        floor: floor++,
        auditStatus: 1, // 已通过
        likeCount: Math.floor(Math.random() * 50),
        createdAt: new Date(
          Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000),
        ),
      })
    }
  }

  // 章节评论
  for (const chapterId of chapterIds.slice(0, 5)) {
    for (const userId of userIds.slice(0, 2)) {
      comments.push({
        targetType: Math.random() > 0.5 ? 3 : 4,
        targetId: chapterId,
        userId,
        content: contents[Math.floor(Math.random() * contents.length)],
        floor: floor++,
        auditStatus: 1,
        likeCount: Math.floor(Math.random() * 30),
        createdAt: new Date(
          Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000),
        ),
      })
    }
  }

  // 论坛回复
  for (const topicId of topicIds.slice(0, 5)) {
    for (const userId of userIds.slice(0, 3)) {
      comments.push({
        targetType: 5,
        targetId: topicId,
        userId,
        content: contents[Math.floor(Math.random() * contents.length)],
        floor: floor++,
        auditStatus: 1,
        likeCount: Math.floor(Math.random() * 20),
        createdAt: new Date(
          Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000),
        ),
      })
    }
  }

  const createdComments: number[] = []
  if (comments.length > 0) {
    // 由于需要获取创建的ID，使用循环逐个创建
    for (const comment of comments) {
      const created = await prisma.userComment.create({ data: comment })
      createdComments.push(created.id)
    }
    console.log(`  ✅ 创建 ${comments.length} 条评论记录`)
  }

  return createdComments
}

/**
 * 创建评论点赞数据
 */
async function createCommentLikes(
  prisma: PrismaClient,
  userIds: number[],
  commentIds: number[],
) {
  const likes = []

  for (const commentId of commentIds.slice(0, 20)) {
    for (const userId of userIds.slice(0, 3)) {
      likes.push({
        commentId,
        userId,
        createdAt: new Date(
          Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000),
        ),
      })
    }
  }

  if (likes.length > 0) {
    await prisma.userCommentLike.createMany({
      data: likes,
      skipDuplicates: true,
    })
    console.log(`  ✅ 创建 ${likes.length} 条评论点赞记录`)
  }
}

/**
 * 创建下载数据
 * targetType: 1=漫画, 2=小说, 3=漫画章节, 4=小说章节
 */
async function createDownloads(
  prisma: PrismaClient,
  userIds: number[],
  workIds: number[],
  chapterIds: number[],
) {
  const downloads = []

  // 作品下载
  for (const userId of userIds.slice(0, 3)) {
    for (const workId of workIds.slice(0, 5)) {
      const workType = Math.random() > 0.5 ? 1 : 2
      downloads.push({
        targetType: workType,
        targetId: workId,
        userId,
        createdAt: new Date(
          Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000),
        ),
      })
    }
  }

  // 章节下载
  for (const userId of userIds.slice(0, 2)) {
    for (const chapterId of chapterIds.slice(0, 10)) {
      // 获取章节所属作品信息
      const chapter = await prisma.workChapter.findUnique({
        where: { id: chapterId },
        select: { workId: true },
      })
      if (chapter) {
        const work = await prisma.work.findUnique({
          where: { id: chapter.workId },
          select: { type: true },
        })
        if (work) {
          const workType = work.type === 1 ? 1 : 2
          const targetType = work.type === 1 ? 3 : 4
          downloads.push({
            targetType,
            targetId: chapterId,
            userId,
            createdAt: new Date(
              Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000),
            ),
          })
        }
      }
    }
  }

  if (downloads.length > 0) {
    await prisma.userDownloadRecord.createMany({
      data: downloads,
      skipDuplicates: true,
    })
    console.log(`  ✅ 创建 ${downloads.length} 条下载记录`)
  }
}
