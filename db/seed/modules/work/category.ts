import { eq } from 'drizzle-orm'
import type { Db } from '../../db-client'
import { workCategory } from '../../../schema/work/work-category'

interface ICategoryData {
  name: string
  description?: string
  icon?: string
  contentType: number[]
  sortOrder: number
  isEnabled: boolean
}

const CATEGORIES: ICategoryData[] = [
  { name: '热血', description: '充满热血与激情的作品', contentType: [1, 2], sortOrder: 1, isEnabled: true },
  { name: '恋爱', description: '甜蜜浪漫的爱情故事', contentType: [1, 2], sortOrder: 2, isEnabled: true },
  { name: '悬疑', description: '扣人心弦的悬疑推理', contentType: [1, 2], sortOrder: 3, isEnabled: true },
  { name: '科幻', description: '探索未来与科技的想象', contentType: [1, 2], sortOrder: 4, isEnabled: true },
  { name: '奇幻', description: '魔法与异世界的冒险', contentType: [1, 2], sortOrder: 5, isEnabled: true },
  { name: '日常', description: '温馨治愈的日常生活', contentType: [1, 2], sortOrder: 6, isEnabled: true },
  { name: '恐怖', description: '惊悚刺激的恐怖故事', contentType: [1, 2], sortOrder: 7, isEnabled: true },
  { name: '搞笑', description: '轻松幽默的喜剧作品', contentType: [1, 2], sortOrder: 8, isEnabled: true },
]

export async function seedWorkCategories(db: Db) {
  console.log('🌱 开始初始化作品分类...')

  const createdCategories: Array<{ id: number; name: string }> = []

  for (const category of CATEGORIES) {
    const existing = await db.query.workCategory.findFirst({
      where: eq(workCategory.name, category.name),
    })

    if (!existing) {
      const [created] = await db
        .insert(workCategory)
        .values({
          ...category,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning({ id: workCategory.id, name: workCategory.name })

      createdCategories.push(created)
      console.log(`  ✓ 分类创建: ${category.name}`)
    } else {
      createdCategories.push({ id: existing.id, name: existing.name })
      console.log(`  ℹ 分类已存在: ${category.name}`)
    }
  }

  console.log('✅ 作品分类初始化完成')
  return createdCategories
}
