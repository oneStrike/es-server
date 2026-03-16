import { eq, isNull } from 'drizzle-orm'
import type { Db } from '../../db-client'
import { forumSection } from '../../../schema/forum/forum-section'
import { forumSectionGroup } from '../../../schema/forum/forum-section-group'

interface ISectionData {
  name: string
  description: string
  sortOrder: number
  isEnabled: boolean
  topicReviewPolicy?: number
}

const SECTIONS: ISectionData[] = [
  {
    name: '前端开发',
    description: '前端技术讨论与分享',
    sortOrder: 1,
    isEnabled: true,
    topicReviewPolicy: 1,
  },
  {
    name: '后端开发',
    description: '后端技术讨论与分享',
    sortOrder: 2,
    isEnabled: true,
    topicReviewPolicy: 1,
  },
  {
    name: '数据库',
    description: '数据库相关技术讨论',
    sortOrder: 3,
    isEnabled: true,
    topicReviewPolicy: 1,
  },
]

export async function seedForumSections(db: Db) {
  console.log('🌱 开始初始化论坛板块...')

  // 获取"技术交流"分组
  const techGroup = await db.query.forumSectionGroup.findFirst({
    where: eq(forumSectionGroup.name, '技术交流'),
  })

  const createdSections: Array<{ id: number; name: string }> = []

  for (const section of SECTIONS) {
    const existing = await db.query.forumSection.findFirst({
      where: eq(forumSection.name, section.name),
    })

    if (!existing) {
      const [created] = await db
        .insert(forumSection)
        .values({
          ...section,
          groupId: techGroup?.id ?? null,
          topicCount: 0,
          replyCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning({ id: forumSection.id, name: forumSection.name })

      createdSections.push(created)
      console.log(`  ✓ 板块创建: ${section.name}`)
    } else {
      createdSections.push({ id: existing.id, name: existing.name })
      console.log(`  ℹ 板块已存在: ${section.name}`)
    }
  }

  console.log('✅ 论坛板块初始化完成')
  return createdSections
}
