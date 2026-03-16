import { eq } from 'drizzle-orm'
import type { Db } from '../../db-client'
import { workTag } from '../../../schema/work/work-tag'

interface ITagData {
  name: string
  description?: string
  isEnabled: boolean
}

const TAGS: ITagData[] = [
  { name: '经典', description: '经典必看作品', isEnabled: true },
  { name: '新番', description: '最新连载作品', isEnabled: true },
  { name: '完结', description: '已完结作品', isEnabled: true },
  { name: '连载中', description: '正在连载的作品', isEnabled: true },
  { name: '高分', description: '评分较高的作品', isEnabled: true },
  { name: '人气', description: '人气很高的作品', isEnabled: true },
  { name: '治愈', description: '治愈系作品', isEnabled: true },
  { name: '催泪', description: '感人至深的作品', isEnabled: true },
  { name: '战斗', description: '战斗场面精彩', isEnabled: true },
  { name: '冒险', description: '冒险题材作品', isEnabled: true },
]

export async function seedWorkTags(db: Db) {
  console.log('🌱 开始初始化作品标签...')

  const createdTags: Array<{ id: number; name: string }> = []

  for (const tag of TAGS) {
    const existing = await db.query.workTag.findFirst({
      where: eq(workTag.name, tag.name),
    })

    if (!existing) {
      const [created] = await db
        .insert(workTag)
        .values({
          ...tag,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning({ id: workTag.id, name: workTag.name })

      createdTags.push(created)
      console.log(`  ✓ 标签创建: ${tag.name}`)
    } else {
      createdTags.push({ id: existing.id, name: existing.name })
      console.log(`  ℹ 标签已存在: ${tag.name}`)
    }
  }

  console.log('✅ 作品标签初始化完成')
  return createdTags
}
