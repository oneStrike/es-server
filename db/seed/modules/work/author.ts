import { eq } from 'drizzle-orm'
import type { Db } from '../../db-client'
import { workAuthor } from '../../../schema/work/work-author'

interface IAuthorData {
  name: string
  avatar?: string
  description?: string
  nationality?: string
  gender: number
  type?: number[]
  isEnabled: boolean
}

const AUTHORS: IAuthorData[] = [
  {
    name: '谏山创',
    description: '日本漫画家，代表作《进击的巨人》',
    nationality: 'JP',
    gender: 1,
    type: [1],
    isEnabled: true,
  },
  {
    name: '尾田荣一郎',
    description: '日本漫画家，代表作《海贼王》',
    nationality: 'JP',
    gender: 1,
    type: [1],
    isEnabled: true,
  },
  {
    name: '吾峠呼世晴',
    description: '日本漫画家，代表作《鬼灭之刃》',
    nationality: 'JP',
    gender: 2,
    type: [1],
    isEnabled: true,
  },
  {
    name: '新海诚',
    description: '日本动画导演、编剧',
    nationality: 'JP',
    gender: 1,
    type: [1, 2],
    isEnabled: true,
  },
  {
    name: '鸟山明',
    description: '日本漫画家，代表作《龙珠》',
    nationality: 'JP',
    gender: 1,
    type: [1],
    isEnabled: true,
  },
  {
    name: '岸本齐史',
    description: '日本漫画家，代表作《火影忍者》',
    nationality: 'JP',
    gender: 1,
    type: [1],
    isEnabled: true,
  },
  {
    name: '村上春树',
    description: '日本作家，代表作《挪威的森林》',
    nationality: 'JP',
    gender: 1,
    type: [2],
    isEnabled: true,
  },
  {
    name: '东野圭吾',
    description: '日本推理小说家',
    nationality: 'JP',
    gender: 1,
    type: [2],
    isEnabled: true,
  },
]

export async function seedWorkAuthors(db: Db) {
  console.log('🌱 开始初始化作者...')

  const createdAuthors: Array<{ id: number; name: string }> = []

  for (const author of AUTHORS) {
    const existing = await db.query.workAuthor.findFirst({
      where: eq(workAuthor.name, author.name),
    })

    if (!existing) {
      const [created] = await db
        .insert(workAuthor)
        .values({
          ...author,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning({ id: workAuthor.id, name: workAuthor.name })

      createdAuthors.push(created)
      console.log(`  ✓ 作者创建: ${author.name}`)
    } else {
      createdAuthors.push({ id: existing.id, name: existing.name })
      console.log(`  ℹ 作者已存在: ${author.name}`)
    }
  }

  console.log('✅ 作者初始化完成')
  return createdAuthors
}
