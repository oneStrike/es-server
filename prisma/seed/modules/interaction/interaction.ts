import type { PrismaClient } from '@prisma/client'

type SeedWork = {
  id: number
  type: number
}

type SeedChapter = {
  id: number
  workType: number
}

type SeedTopic = {
  id: number
}

type CreatedCommentMeta = {
  id: number
  targetType: number
  targetId: number
  replyToId: number | null
}

/**
 * 创建交互模块初始数据。
 *
 * 说明：
 * - 本文件只需要适配新的点赞模型种子
 * - 举报本次不依赖旧数据迁移，因此这里不额外制造历史举报数据
 */
export async function createInitialInteractionData(prisma: PrismaClient) {
  console.log('开始初始化交互模块数据...')

  const users = await prisma.appUser.findMany({ take: 5, select: { id: true } })
  if (users.length === 0) {
    console.log('没有用户数据，跳过交互数据初始化')
    return
  }

  const works = await prisma.work.findMany({
    take: 10,
    select: { id: true, type: true },
  })
  if (works.length === 0) {
    console.log('没有作品数据，跳过交互数据初始化')
    return
  }

  const chapters = await prisma.workChapter.findMany({
    take: 20,
    select: { id: true, workType: true },
  })

  const topics = await prisma.forumTopic.findMany({
    take: 10,
    select: { id: true },
  })

  const userIds = users.map((item) => item.id)

  await createLikes(prisma, userIds, works, chapters, topics)
  await createFavorites(prisma, userIds, works, topics)
  await createViews(prisma, userIds, works, chapters, topics)

  const comments = await createComments(prisma, userIds, works, chapters, topics)
  if (comments.length > 0) {
    await createCommentLikes(prisma, userIds, comments)
  }

  if (chapters.length > 0) {
    await createDownloads(prisma, userIds, works, chapters)
  }

  console.log('交互模块数据初始化完成')
}

/**
 * 创建点赞种子数据。
 *
 * 说明：
 * - 点赞记录需要同步写入 `sceneType`、`sceneId`、`commentLevel`
 * - 作品与章节的目标类型必须基于真实业务类型生成，不能随机写错
 */
async function createLikes(
  prisma: PrismaClient,
  userIds: number[],
  works: SeedWork[],
  chapters: SeedChapter[],
  topics: SeedTopic[],
) {
  const likes = []

  for (const userId of userIds.slice(0, 3)) {
    for (const work of works.slice(0, 5)) {
      const targetType = work.type === 1 ? 1 : 2
      likes.push({
        targetType,
        targetId: work.id,
        sceneType: targetType,
        sceneId: work.id,
        commentLevel: null,
        userId,
        createdAt: randomPastDate(7),
      })
    }
  }

  for (const userId of userIds.slice(0, 2)) {
    for (const chapter of chapters.slice(0, 10)) {
      const targetType = chapter.workType === 1 ? 3 : 4
      likes.push({
        targetType,
        targetId: chapter.id,
        sceneType: targetType,
        sceneId: chapter.id,
        commentLevel: null,
        userId,
        createdAt: randomPastDate(7),
      })
    }
  }

  for (const userId of userIds.slice(0, 3)) {
    for (const topic of topics.slice(0, 5)) {
      likes.push({
        targetType: 5,
        targetId: topic.id,
        sceneType: 5,
        sceneId: topic.id,
        commentLevel: null,
        userId,
        createdAt: randomPastDate(7),
      })
    }
  }

  if (likes.length > 0) {
    await prisma.userLike.createMany({
      data: likes,
      skipDuplicates: true,
    })
    console.log(`  创建 ${likes.length} 条点赞记录`)
  }
}

/**
 * 创建收藏种子数据。
 *
 * 说明：
 * - 收藏模块不在本次改造范围内
 * - 这里只顺手把目标类型改为基于真实作品类型生成，避免旧种子写错
 */
async function createFavorites(
  prisma: PrismaClient,
  userIds: number[],
  works: SeedWork[],
  topics: SeedTopic[],
) {
  const favorites = []

  for (const userId of userIds.slice(0, 3)) {
    for (const work of works.slice(0, 5)) {
      favorites.push({
        targetType: work.type === 1 ? 1 : 2,
        targetId: work.id,
        userId,
        createdAt: randomPastDate(14),
      })
    }
  }

  for (const userId of userIds.slice(0, 2)) {
    for (const topic of topics.slice(0, 3)) {
      favorites.push({
        targetType: 5,
        targetId: topic.id,
        userId,
        createdAt: randomPastDate(7),
      })
    }
  }

  if (favorites.length > 0) {
    await prisma.userFavorite.createMany({
      data: favorites,
      skipDuplicates: true,
    })
    console.log(`  创建 ${favorites.length} 条收藏记录`)
  }
}

/**
 * 创建浏览种子数据。
 */
async function createViews(
  prisma: PrismaClient,
  userIds: number[],
  works: SeedWork[],
  chapters: SeedChapter[],
  topics: SeedTopic[],
) {
  const views = []
  const devices = ['mobile', 'desktop', 'tablet']

  for (const userId of userIds) {
    for (const work of works.slice(0, 5)) {
      views.push({
        targetType: work.type === 1 ? 1 : 2,
        targetId: work.id,
        userId,
        ipAddress: randomIp(),
        device: randomItem(devices),
        userAgent: 'Mozilla/5.0 (Seed)',
        viewedAt: randomPastDate(30),
      })
    }
  }

  for (const userId of userIds) {
    for (const chapter of chapters.slice(0, 10)) {
      views.push({
        targetType: chapter.workType === 1 ? 3 : 4,
        targetId: chapter.id,
        userId,
        ipAddress: randomIp(),
        device: randomItem(devices),
        userAgent: 'Mozilla/5.0 (Seed)',
        viewedAt: randomPastDate(30),
      })
    }
  }

  for (const userId of userIds) {
    for (const topic of topics.slice(0, 5)) {
      views.push({
        targetType: 5,
        targetId: topic.id,
        userId,
        ipAddress: randomIp(),
        device: randomItem(devices),
        userAgent: 'Mozilla/5.0 (Seed)',
        viewedAt: randomPastDate(30),
      })
    }
  }

  if (views.length > 0) {
    await prisma.userBrowseLog.createMany({ data: views })
    console.log(`  创建 ${views.length} 条浏览记录`)
  }
}

/**
 * 创建评论与回复种子数据。
 *
 * 说明：
 * - 这里会同时制造根评论和回复评论
 * - 方便后续验证 `commentLevel` 是否能正确落种子
 */
async function createComments(
  prisma: PrismaClient,
  userIds: number[],
  works: SeedWork[],
  chapters: SeedChapter[],
  topics: SeedTopic[],
): Promise<CreatedCommentMeta[]> {
  const createdComments: CreatedCommentMeta[] = []
  const rootComments: CreatedCommentMeta[] = []
  const contents = [
    '这个内容很精彩',
    '剧情推进不错',
    '画风很喜欢',
    '人物塑造得很好',
    '这个章节太精彩了',
    '期待下一话',
    '故事设定很吸引人',
    '节奏控制得不错',
    '这个转折很意外',
    '已经加入收藏了',
  ]

  let floor = 1

  for (const work of works.slice(0, 5)) {
    for (const userId of userIds.slice(0, 3)) {
      const created = await prisma.userComment.create({
        data: {
          targetType: work.type === 1 ? 1 : 2,
          targetId: work.id,
          userId,
          content: randomItem(contents),
          floor: floor++,
          auditStatus: 1,
          likeCount: Math.floor(Math.random() * 50),
          createdAt: randomPastDate(30),
          replyToId: null,
          actualReplyToId: null,
          auditById: null,
          auditRole: null,
          auditReason: null,
          auditAt: null,
          sensitiveWordHits: null,
        },
        select: {
          id: true,
          targetType: true,
          targetId: true,
        },
      })

      const commentMeta: CreatedCommentMeta = {
        id: created.id,
        targetType: created.targetType,
        targetId: created.targetId,
        replyToId: null,
      }
      createdComments.push(commentMeta)
      rootComments.push(commentMeta)
    }
  }

  for (const chapter of chapters.slice(0, 5)) {
    for (const userId of userIds.slice(0, 2)) {
      const created = await prisma.userComment.create({
        data: {
          targetType: chapter.workType === 1 ? 3 : 4,
          targetId: chapter.id,
          userId,
          content: randomItem(contents),
          floor: floor++,
          auditStatus: 1,
          likeCount: Math.floor(Math.random() * 30),
          createdAt: randomPastDate(30),
          replyToId: null,
          actualReplyToId: null,
          auditById: null,
          auditRole: null,
          auditReason: null,
          auditAt: null,
          sensitiveWordHits: null,
        },
        select: {
          id: true,
          targetType: true,
          targetId: true,
        },
      })

      const commentMeta: CreatedCommentMeta = {
        id: created.id,
        targetType: created.targetType,
        targetId: created.targetId,
        replyToId: null,
      }
      createdComments.push(commentMeta)
      rootComments.push(commentMeta)
    }
  }

  for (const topic of topics.slice(0, 5)) {
    for (const userId of userIds.slice(0, 3)) {
      const created = await prisma.userComment.create({
        data: {
          targetType: 5,
          targetId: topic.id,
          userId,
          content: randomItem(contents),
          floor: floor++,
          auditStatus: 1,
          likeCount: Math.floor(Math.random() * 20),
          createdAt: randomPastDate(30),
          replyToId: null,
          actualReplyToId: null,
          auditById: null,
          auditRole: null,
          auditReason: null,
          auditAt: null,
          sensitiveWordHits: null,
        },
        select: {
          id: true,
          targetType: true,
          targetId: true,
        },
      })

      const commentMeta: CreatedCommentMeta = {
        id: created.id,
        targetType: created.targetType,
        targetId: created.targetId,
        replyToId: null,
      }
      createdComments.push(commentMeta)
      rootComments.push(commentMeta)
    }
  }

  for (const rootComment of rootComments.slice(0, 8)) {
    for (const userId of userIds.slice(0, 2)) {
      const created = await prisma.userComment.create({
        data: {
          targetType: rootComment.targetType,
          targetId: rootComment.targetId,
          userId,
          content: `回复：${randomItem(contents)}`,
          floor: null,
          replyToId: rootComment.id,
          actualReplyToId: rootComment.id,
          auditStatus: 1,
          likeCount: Math.floor(Math.random() * 10),
          createdAt: randomPastDate(15),
          auditById: null,
          auditRole: null,
          auditReason: null,
          auditAt: null,
          sensitiveWordHits: null,
        },
        select: {
          id: true,
          targetType: true,
          targetId: true,
          replyToId: true,
        },
      })

      createdComments.push({
        id: created.id,
        targetType: created.targetType,
        targetId: created.targetId,
        replyToId: created.replyToId,
      })
    }
  }

  console.log(`  创建 ${createdComments.length} 条评论记录`)
  return createdComments
}

/**
 * 创建评论点赞种子数据。
 */
async function createCommentLikes(
  prisma: PrismaClient,
  userIds: number[],
  comments: CreatedCommentMeta[],
) {
  const likes = []

  for (const comment of comments.slice(0, 20)) {
    for (const userId of userIds.slice(0, 3)) {
      likes.push({
        targetType: 6,
        targetId: comment.id,
        sceneType: comment.targetType,
        sceneId: comment.targetId,
        commentLevel: comment.replyToId ? 2 : 1,
        userId,
        createdAt: randomPastDate(7),
      })
    }
  }

  if (likes.length > 0) {
    await prisma.userLike.createMany({
      data: likes,
      skipDuplicates: true,
    })
    console.log(`  创建 ${likes.length} 条评论点赞记录`)
  }
}

/**
 * 创建下载种子数据。
 */
async function createDownloads(
  prisma: PrismaClient,
  userIds: number[],
  works: SeedWork[],
  chapters: SeedChapter[],
) {
  const downloads = []

  for (const userId of userIds.slice(0, 3)) {
    for (const work of works.slice(0, 5)) {
      downloads.push({
        targetType: work.type === 1 ? 1 : 2,
        targetId: work.id,
        userId,
        createdAt: randomPastDate(30),
      })
    }
  }

  for (const userId of userIds.slice(0, 2)) {
    for (const chapter of chapters.slice(0, 10)) {
      downloads.push({
        targetType: chapter.workType === 1 ? 3 : 4,
        targetId: chapter.id,
        userId,
        createdAt: randomPastDate(30),
      })
    }
  }

  if (downloads.length > 0) {
    await prisma.userDownloadRecord.createMany({
      data: downloads,
      skipDuplicates: true,
    })
    console.log(`  创建 ${downloads.length} 条下载记录`)
  }
}

function randomPastDate(days: number) {
  return new Date(
    Date.now() - Math.floor(Math.random() * days * 24 * 60 * 60 * 1000),
  )
}

function randomIp() {
  return `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`
}

function randomItem<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)]
}
