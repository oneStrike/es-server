import type { Prisma } from '@libs/base/database'
import type { PrismaClientType } from '@libs/base/database/prisma.types'

/// 评论事务类型
export type WorkCommentTransaction = Omit<
  Parameters<Parameters<PrismaClientType['$transaction']>[0]>[0],
  '$extends'
>

/// 带关联关系的评论类型
export type CommentWithRelations = Prisma.WorkCommentGetPayload<{
  include: {
    user: {
      select: {
        id: true
        nickname: true
        avatar: true
      }
    }
    replyTo: {
      select: {
        id: true
        userId: true
        user: {
          select: {
            nickname: true
            avatar: true
          }
        }
      }
    }
    actualReplies: {
      where: Prisma.WorkCommentWhereInput
      orderBy: { createdAt: 'asc' }
      include: {
        user: {
          select: {
            id: true
            nickname: true
            avatar: true
          }
        }
        replyTo: {
          select: {
            id: true
            userId: true
            user: {
              select: {
                nickname: true
                avatar: true
              }
            }
          }
        }
      }
    }
  }
}>
