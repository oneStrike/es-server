import type { PrismaClient } from '@prisma/client'

export async function migrateInteractionData(prisma: PrismaClient) {
  console.log('🔄 开始迁移交互数据...')

  await migrateLikes(prisma)
  await migrateFavorites(prisma)
  await migrateViews(prisma)
  await migrateDownloads(prisma)

  console.log('✅ 交互数据迁移完成')
}

async function migrateLikes(prisma: PrismaClient) {
  console.log('  📌 迁移点赞数据...')

  const workLikes = await prisma.workLike.findMany()
  const forumTopicLikes = await prisma.forumTopicLike.findMany()
  const chapterLikes = await prisma.workChapterLike.findMany()

  const userLikes: any[] = []

  for (const like of workLikes) {
    const work = await prisma.work.findUnique({
      where: { id: like.workId },
      select: { type: true },
    })
    if (work) {
      userLikes.push({
        targetType: work.type === 1 ? 1 : 2,
        targetId: like.workId,
        userId: like.userId,
        createdAt: like.createdAt,
      })
    }
  }

  for (const like of forumTopicLikes) {
    userLikes.push({
      targetType: 5,
      targetId: like.topicId,
      userId: like.userId,
      createdAt: like.createdAt,
    })
  }

  for (const like of chapterLikes) {
    const chapter = await prisma.workChapter.findUnique({
      where: { id: like.chapterId },
      select: { workId: true },
    })
    if (chapter) {
      const work = await prisma.work.findUnique({
        where: { id: chapter.workId },
        select: { type: true },
      })
      if (work) {
        userLikes.push({
          targetType: work.type === 1 ? 3 : 4,
          targetId: like.chapterId,
          userId: like.userId,
          createdAt: like.createdAt,
        })
      }
    }
  }

  if (userLikes.length > 0) {
    await prisma.userLike.createMany({
      data: userLikes,
      skipDuplicates: true,
    })
  }

  console.log(`    ✅ 作品点赞: ${workLikes.length}`)
  console.log(`    ✅ 论坛点赞: ${forumTopicLikes.length}`)
  console.log(`    ✅ 章节点赞: ${chapterLikes.length}`)
  console.log(`    ✅ 总计迁移: ${userLikes.length}`)
}

async function migrateFavorites(prisma: PrismaClient) {
  console.log('  ⭐ 迁移收藏数据...')

  const workFavorites = await prisma.workFavorite.findMany()
  const forumTopicFavorites = await prisma.forumTopicFavorite.findMany()

  const userFavorites: any[] = []

  for (const fav of workFavorites) {
    userFavorites.push({
      targetType: fav.workType,
      targetId: fav.workId,
      userId: fav.userId,
      createdAt: fav.createdAt,
    })
  }

  for (const fav of forumTopicFavorites) {
    userFavorites.push({
      targetType: 5,
      targetId: fav.topicId,
      userId: fav.userId,
      createdAt: fav.createdAt,
    })
  }

  if (userFavorites.length > 0) {
    await prisma.userFavorite.createMany({
      data: userFavorites,
      skipDuplicates: true,
    })
  }

  console.log(`    ✅ 作品收藏: ${workFavorites.length}`)
  console.log(`    ✅ 论坛收藏: ${forumTopicFavorites.length}`)
  console.log(`    ✅ 总计迁移: ${userFavorites.length}`)
}

async function migrateViews(prisma: PrismaClient) {
  console.log('  👁️ 迁移浏览记录...')

  const forumViews = await prisma.forumView.findMany()

  const userViews: any[] = []

  for (const view of forumViews) {
    userViews.push({
      targetType: 5,
      targetId: view.topicId,
      userId: view.userId,
      viewedAt: view.viewedAt,
    })
  }

  if (userViews.length > 0) {
    await prisma.userView.createMany({
      data: userViews,
      skipDuplicates: true,
    })
  }

  console.log(`    ✅ 论坛浏览: ${forumViews.length}`)
  console.log(`    ✅ 总计迁移: ${userViews.length}`)
}

async function migrateDownloads(prisma: PrismaClient) {
  console.log('  📥 迁移下载数据...')

  const chapterDownloads = await prisma.workChapterDownload.findMany()

  const userDownloads: any[] = []

  for (const dl of chapterDownloads) {
    userDownloads.push({
      targetType: dl.workType === 1 ? 3 : 4,
      targetId: dl.chapterId,
      userId: dl.userId,
      workId: dl.workId,
      workType: dl.workType,
      createdAt: dl.createdAt,
    })
  }

  if (userDownloads.length > 0) {
    await prisma.userDownload.createMany({
      data: userDownloads,
      skipDuplicates: true,
    })
  }

  console.log(`    ✅ 章节下载: ${chapterDownloads.length}`)
  console.log(`    ✅ 总计迁移: ${userDownloads.length}`)
}
