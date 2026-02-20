import type { WorkComicChapterComment } from '@libs/base/database'
import type { PrismaClientType } from '@libs/base/database/prisma.types'

/**
 * 漫画章节评论事务上下文类型
 */
export type ComicChapterCommentTransaction = Pick<
  PrismaClientType,
  'workComicChapter' | 'workComicChapterComment' | 'workComicChapterCommentReport'
>

/**
 * 评论用户信息（轻量）
 */
export interface CommentUser {
  id: number
  nickname: string
  avatar?: string | null
}

/**
 * 被回复评论关联信息（轻量）
 */
export interface CommentReplyToRelation {
  id: number
  userId: number
  user?: { nickname: string, avatar?: string | null } | null
}

/**
 * 评论实体与关联关系组合类型
 */
export type CommentWithRelations = WorkComicChapterComment & {
  user?: CommentUser | null
  replyTo?: CommentReplyToRelation | null
  actualReplies?: Array<
    WorkComicChapterComment & {
      user?: CommentUser | null
      replyTo?: CommentReplyToRelation | null
    }
  >
}
