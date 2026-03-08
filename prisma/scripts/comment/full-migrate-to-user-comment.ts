import { PrismaClient } from '../../prismaClient/client'

type PendingReply = {
  newId: number
  oldReplyToId: number | null
  oldActualReplyToId: number | null
}

function mapWorkTarget(workType: number, chapterId: number | null, workId: number) {
  if (chapterId) {
    return {
      targetType: workType === 1 ? 3 : 4,
      targetId: chapterId,
    }
  }
  return {
    targetType: workType,
    targetId: workId,
  }
}

async function migrateWorkComments(prisma: PrismaClient) {
  const oldComments = await prisma.workComment.findMany({
    orderBy: { id: 'asc' },
  })
  const idMap = new Map<number, number>()
  const pending: PendingReply[] = []

  for (const old of oldComments) {
    const target = mapWorkTarget(old.workType, old.chapterId, old.workId)
    const created = await prisma.userComment.create({
      data: {
        targetType: target.targetType,
        targetId: target.targetId,
        userId: old.userId,
        content: old.content,
        floor: old.replyToId ? null : old.floor,
        replyToId: null,
        actualReplyToId: null,
        isHidden: old.isHidden,
        auditStatus: old.auditStatus,
        auditById: old.auditById,
        auditRole: old.auditRole,
        auditReason: old.auditReason,
        auditAt: old.auditAt,
        likeCount: old.likeCount,
        sensitiveWordHits: old.sensitiveWordHits,
        createdAt: old.createdAt,
        updatedAt: old.updatedAt,
        deletedAt: old.deletedAt,
      },
      select: { id: true },
    })
    idMap.set(old.id, created.id)
    pending.push({
      newId: created.id,
      oldReplyToId: old.replyToId,
      oldActualReplyToId: old.actualReplyToId,
    })
  }

  for (const item of pending) {
    if (!item.oldReplyToId && !item.oldActualReplyToId) {
      continue
    }
    await prisma.userComment.update({
      where: { id: item.newId },
      data: {
        replyToId: item.oldReplyToId ? (idMap.get(item.oldReplyToId) ?? null) : null,
        actualReplyToId: item.oldActualReplyToId ? (idMap.get(item.oldActualReplyToId) ?? null) : null,
      },
    })
  }

  const reports = await prisma.workCommentReport.findMany({
    orderBy: { id: 'asc' },
  })
  for (const report of reports) {
    const newCommentId = idMap.get(report.commentId)
    if (!newCommentId) {
      continue
    }
    await prisma.userCommentReport.create({
      data: {
        commentId: newCommentId,
        reporterId: report.reporterId,
        handlerId: report.handlerId,
        reason: report.reason,
        description: report.description,
        evidenceUrl: report.evidenceUrl,
        status: report.status,
        handlingNote: report.handlingNote,
        handledAt: report.handledAt,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
      },
    })
  }

  return idMap
}

async function migrateForumReplies(prisma: PrismaClient) {
  const oldReplies = await prisma.forumReply.findMany({
    orderBy: { id: 'asc' },
  })
  const idMap = new Map<number, number>()
  const pending: PendingReply[] = []

  for (const old of oldReplies) {
    const created = await prisma.userComment.create({
      data: {
        targetType: 5,
        targetId: old.topicId,
        userId: old.userId,
        content: old.content,
        floor: old.replyToId ? null : old.floor,
        replyToId: null,
        actualReplyToId: null,
        isHidden: old.isHidden,
        auditStatus: old.auditStatus,
        auditReason: old.auditReason,
        likeCount: old.likeCount,
        sensitiveWordHits: old.sensitiveWordHits,
        createdAt: old.createdAt,
        updatedAt: old.updatedAt,
        deletedAt: old.deletedAt,
      },
      select: { id: true },
    })
    idMap.set(old.id, created.id)
    pending.push({
      newId: created.id,
      oldReplyToId: old.replyToId,
      oldActualReplyToId: old.actualReplyToId,
    })
  }

  for (const item of pending) {
    if (!item.oldReplyToId && !item.oldActualReplyToId) {
      continue
    }
    await prisma.userComment.update({
      where: { id: item.newId },
      data: {
        replyToId: item.oldReplyToId ? (idMap.get(item.oldReplyToId) ?? null) : null,
        actualReplyToId: item.oldActualReplyToId ? (idMap.get(item.oldActualReplyToId) ?? null) : null,
      },
    })
  }

  const replyLikes = await prisma.forumReplyLike.findMany({
    orderBy: { id: 'asc' },
  })
  for (const like of replyLikes) {
    const newCommentId = idMap.get(like.replyId)
    if (!newCommentId) {
      continue
    }
    await prisma.userLike.upsert({
      where: {
        targetType_targetId_userId: {
          targetType: 6,
          targetId: newCommentId,
          userId: like.userId,
        },
      },
      create: {
        targetType: 6,
        targetId: newCommentId,
        userId: like.userId,
        createdAt: like.createdAt,
      },
      update: {},
    })
  }

  const reports = await prisma.forumReport.findMany({
    where: { type: 'reply' },
    orderBy: { id: 'asc' },
  })
  for (const report of reports) {
    const newCommentId = idMap.get(report.targetId)
    if (!newCommentId) {
      continue
    }
    await prisma.userCommentReport.create({
      data: {
        commentId: newCommentId,
        reporterId: report.reporterId,
        handlerId: report.handlerId,
        reason: report.reason,
        description: report.description,
        evidenceUrl: report.evidenceUrl,
        status: report.status,
        handlingNote: report.handlingNote,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
      },
    })
  }

  return idMap
}

async function recalcCounts(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe(`
    UPDATE "work" w
    SET "comment_count" = COALESCE(c.cnt, 0)
    FROM (
      SELECT "target_id", COUNT(*)::INTEGER AS cnt
      FROM "user_comment"
      WHERE "target_type" IN (1, 2)
        AND "audit_status" = 1
        AND "is_hidden" = FALSE
        AND "deleted_at" IS NULL
      GROUP BY "target_id"
    ) c
    WHERE w."id" = c."target_id"
  `)

  await prisma.$executeRawUnsafe(`
    UPDATE "work_chapter" wc
    SET "comment_count" = COALESCE(c.cnt, 0)
    FROM (
      SELECT "target_id", COUNT(*)::INTEGER AS cnt
      FROM "user_comment"
      WHERE "target_type" IN (3, 4)
        AND "audit_status" = 1
        AND "is_hidden" = FALSE
        AND "deleted_at" IS NULL
      GROUP BY "target_id"
    ) c
    WHERE wc."id" = c."target_id"
  `)

  await prisma.$executeRawUnsafe(`
    UPDATE "forum_topic" ft
    SET "comment_count" = COALESCE(c.cnt, 0)
    FROM (
      SELECT "target_id", COUNT(*)::INTEGER AS cnt
      FROM "user_comment"
      WHERE "target_type" = 5
        AND "audit_status" = 1
        AND "is_hidden" = FALSE
        AND "deleted_at" IS NULL
      GROUP BY "target_id"
    ) c
    WHERE ft."id" = c."target_id"
  `)
}

async function main() {
  const prisma = new PrismaClient()
  try {
    await prisma.$transaction(async (tx) => {
      await migrateWorkComments(tx as unknown as PrismaClient)
      await migrateForumReplies(tx as unknown as PrismaClient)
      await recalcCounts(tx as unknown as PrismaClient)
    }, { timeout: 1200000 })
  } finally {
    await prisma.$disconnect()
  }
}

void main()
