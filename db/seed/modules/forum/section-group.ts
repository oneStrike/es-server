import { eq } from 'drizzle-orm'
import type { Db } from '../../db-client'
import { forumSectionGroup } from '../../../schema/forum/forum-section-group'

interface ISectionGroupData {
  name: string
  description?: string
  sortOrder: number
  isEnabled: boolean
  maxModerators?: number
}

const SECTION_GROUPS: ISectionGroupData[] = [
  {
    name: '技术交流',
    description: '讨论各种技术问题和解决方案',
    sortOrder: 1,
    isEnabled: true,
    maxModerators: 0,
  },
  {
    name: '经验分享',
    description: '分享项目经验和心得体会',
    sortOrder: 2,
    isEnabled: true,
    maxModerators: 0,
  },
  {
    name: '问答专区',
    description: '提问和回答问题的地方',
    sortOrder: 3,
    isEnabled: true,
    maxModerators: 0,
  },
  {
    name: '活动公告',
    description: '官方活动通知和公告发布',
    sortOrder: 4,
    isEnabled: true,
    maxModerators: 0,
  },
  {
    name: '建议反馈',
    description: '产品建议和用户反馈收集',
    sortOrder: 5,
    isEnabled: true,
    maxModerators: 0,
  },
]

export async function seedForumSectionGroups(db: Db) {
  console.log('🌱 开始初始化论坛板块分组...')

  const createdGroups: Array<{ id: number; name: string }> = []

  for (const group of SECTION_GROUPS) {
    const existing = await db.query.forumSectionGroup.findFirst({
      where: eq(forumSectionGroup.name, group.name),
    })

    if (!existing) {
      const [created] = await db
        .insert(forumSectionGroup)
        .values({
          ...group,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning({ id: forumSectionGroup.id, name: forumSectionGroup.name })

      createdGroups.push(created)
      console.log(`  ✓ 分组创建: ${group.name}`)
    } else {
      createdGroups.push({ id: existing.id, name: existing.name })
      console.log(`  ℹ 分组已存在: ${group.name}`)
    }
  }

  console.log('✅ 论坛板块分组初始化完成')
  return createdGroups
}
