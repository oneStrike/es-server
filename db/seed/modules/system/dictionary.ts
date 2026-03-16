import { eq, and } from 'drizzle-orm'
import type { Db } from '../../db-client'
import { systemDictionary } from '../../../schema/system/system-dictionary'

interface IDictionaryData {
  name: string
  code: string
  cover?: string
  isEnabled?: boolean
  description?: string
}

interface IDictionaryItemData {
  name: string
  code: string
  sortOrder?: number
  cover?: string
  isEnabled?: boolean
  description?: string
}

const DICTIONARIES: IDictionaryData[] = [
  { name: '作品语言', code: 'work_language', isEnabled: true },
  { name: '国籍', code: 'nationality', isEnabled: true },
  { name: '作品区域', code: 'work_region', isEnabled: true },
  { name: '作品出版社', code: 'work_publisher', isEnabled: true },
  { name: '作品年龄限制', code: 'work_age_rating', isEnabled: true },
]

const DICTIONARY_ITEMS: Record<string, IDictionaryItemData[]> = {
  work_language: [
    { name: '中文', code: 'zh', sortOrder: 1, isEnabled: true },
    { name: '英文', code: 'en', sortOrder: 2, isEnabled: true },
    { name: '日文', code: 'ja', sortOrder: 3, isEnabled: true },
    { name: '韩文', code: 'ko', sortOrder: 4, isEnabled: true },
    { name: '法文', code: 'fr', sortOrder: 5, isEnabled: true },
  ],
  work_region: [
    { name: '中国', code: 'CN', sortOrder: 1, isEnabled: true },
    { name: '美国', code: 'US', sortOrder: 2, isEnabled: true },
    { name: '日本', code: 'JP', sortOrder: 3, isEnabled: true },
    { name: '韩国', code: 'KR', sortOrder: 4, isEnabled: true },
    { name: '欧洲', code: 'EU', sortOrder: 5, isEnabled: true },
  ],
  work_age_rating: [
    { name: '全年龄', code: 'ALL', sortOrder: 1, isEnabled: true },
    { name: 'R15', code: 'R15', sortOrder: 2, isEnabled: true },
    { name: 'R18', code: 'R18', sortOrder: 3, isEnabled: true },
  ],
  nationality: [
    { name: '中国', code: 'CN', sortOrder: 1, isEnabled: true },
    { name: '美国', code: 'US', sortOrder: 2, isEnabled: true },
    { name: '日本', code: 'JP', sortOrder: 3, isEnabled: true },
    { name: '韩国', code: 'KR', sortOrder: 4, isEnabled: true },
    { name: '英国', code: 'GB', sortOrder: 5, isEnabled: true },
    { name: '法国', code: 'FR', sortOrder: 6, isEnabled: true },
    { name: '德国', code: 'DE', sortOrder: 7, isEnabled: true },
    { name: '印度', code: 'IN', sortOrder: 8, isEnabled: true },
    { name: '俄罗斯', code: 'RU', sortOrder: 9, isEnabled: true },
    { name: '巴西', code: 'BR', sortOrder: 10, isEnabled: true },
  ],
  work_publisher: [
    { name: '人民文学出版社', code: 'renmin_wenxue', sortOrder: 1, isEnabled: true },
    { name: '人民教育出版社', code: 'renmin_jiaoyu', sortOrder: 2, isEnabled: true },
    { name: '人民音乐出版社', code: 'renmin_yinyue', sortOrder: 3, isEnabled: true },
    { name: '人民美术出版社', code: 'renmin_meishu', sortOrder: 4, isEnabled: true },
    { name: '集英社', code: 'shueisha', sortOrder: 5, isEnabled: true },
    { name: '小学馆', code: 'shogakukan', sortOrder: 6, isEnabled: true },
  ],
}

export async function seedDictionaries(db: Db) {
  console.log('🌱 开始初始化字典数据...')

  for (const dict of DICTIONARIES) {
    // 检查字典是否存在
    const existing = await db.query.systemDictionary.findFirst({
      where: eq(systemDictionary.code, dict.code),
    })

    if (!existing) {
      await db.insert(systemDictionary).values({
        ...dict,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      console.log(`  ✓ 字典创建: ${dict.name}`)
    } else {
      console.log(`  ℹ 字典已存在: ${dict.name}`)
    }
  }

  console.log('✅ 字典数据初始化完成')
}
