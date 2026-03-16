import { eq, and, isNull } from 'drizzle-orm'
import type { Db } from '../../db-client'
import { forumTopic } from '../../../schema/forum/forum-topic'
import { forumSection } from '../../../schema/forum/forum-section'
import { appUser } from '../../../schema/app/app-user'
import { work } from '../../../schema/work/work'

interface ITopicTemplate {
  title: string
  content: string
}

const TOPIC_TEMPLATES: ITopicTemplate[] = [
  {
    title: '剧情讨论与感受分享',
    content:
      '欢迎在这里讨论这部作品的剧情、节奏与伏笔，也可以分享你的高光章节与追更感受。',
  },
  {
    title: '角色分析与人物关系',
    content:
      '欢迎聊聊角色成长、人物弧线、角色关系与名场面，理性讨论，友善交流。',
  },
]

export async function seedForumTopics(db: Db) {
  console.log('🌱 开始初始化论坛主题...')

  // 获取测试用户
  const user = await db.query.appUser.findFirst({
    where: and(eq(appUser.phone, '13800138000'), isNull(appUser.deletedAt)),
  })

  if (!user) {
    console.log('  ℹ 未找到测试用户，跳过主题创建')
    return []
  }

  // 获取有论坛板块关联的作品
  const works = await db.query.work.findMany({
    where: and(isNull(work.deletedAt), eq(work.isPublished, true)),
    limit: 8,
  })

  if (!works.length) {
    console.log('  ℹ 未找到作品，跳过主题创建')
    return []
  }

  const createdTopics: Array<{ id: number; title: string }> = []
  const touchedSectionIds = new Set<number>()

  for (const workItem of works) {
    if (!workItem.forumSectionId) {
      continue
    }

    touchedSectionIds.add(workItem.forumSectionId)

    for (const template of TOPIC_TEMPLATES) {
      const title = `${workItem.name}｜${template.title}`

      // 检查主题是否已存在
      const existing = await db.query.forumTopic.findFirst({
        where: and(
          eq(forumTopic.sectionId, workItem.forumSectionId),
          eq(forumTopic.title, title),
          isNull(forumTopic.deletedAt)
        ),
      })

      if (existing) {
        console.log(`  ℹ 主题已存在: ${title}`)
        continue
      }

      const [created] = await db
        .insert(forumTopic)
        .values({
          sectionId: workItem.forumSectionId,
          userId: user.id,
          title,
          content: `${workItem.name}\n\n${template.content}`,
          auditStatus: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning({ id: forumTopic.id, title: forumTopic.title })

      createdTopics.push(created)
      console.log(`  ✓ 主题创建: ${title}`)
    }
  }

  // 更新板块统计
  for (const sectionId of touchedSectionIds) {
    const topics = await db.query.forumTopic.findMany({
      where: and(eq(forumTopic.sectionId, sectionId), isNull(forumTopic.deletedAt)),
    })

    const topicCount = topics.length
    const replyCount = topics.reduce((sum, t) => sum + t.replyCount, 0)
    const lastPostAt = topics.length > 0
      ? topics.reduce((max, t) => t.lastReplyAt && t.lastReplyAt > max ? t.lastReplyAt : max, topics[0].createdAt)
      : null

    await db
      .update(forumSection)
      .set({
        topicCount,
        replyCount,
        lastPostAt,
        updatedAt: new Date(),
      })
      .where(eq(forumSection.id, sectionId))

    console.log(`  ✓ 板块统计更新: sectionId=${sectionId}, topics=${topicCount}`)
  }

  console.log('✅ 论坛主题初始化完成')
  return createdTopics
}
