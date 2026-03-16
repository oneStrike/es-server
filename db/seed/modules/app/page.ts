import { eq } from 'drizzle-orm'
import type { Db } from '../../db-client'
import { appPage } from '../../../schema/app/app-page'

interface IAppPageData {
  code: string
  title: string
  content: string
  isEnabled: boolean
}

const PAGES: IAppPageData[] = [
  {
    code: 'user_agreement',
    title: '用户协议',
    content: '<h1>用户协议</h1><p>欢迎使用我们的服务...</p>',
    isEnabled: true,
  },
  {
    code: 'privacy_policy',
    title: '隐私政策',
    content: '<h1>隐私政策</h1><p>我们非常重视您的隐私...</p>',
    isEnabled: true,
  },
  {
    code: 'about_us',
    title: '关于我们',
    content: '<h1>关于我们</h1><p>我们是一家专注于漫画阅读的平台...</p>',
    isEnabled: true,
  },
]

export async function seedAppPages(db: Db) {
  console.log('🌱 开始初始化应用页面...')

  for (const page of PAGES) {
    const existing = await db.query.appPage.findFirst({
      where: eq(appPage.code, page.code),
    })

    if (!existing) {
      await db.insert(appPage).values({
        ...page,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      console.log(`  ✓ 页面创建: ${page.title}`)
    } else {
      console.log(`  ℹ 页面已存在: ${page.title}`)
    }
  }

  console.log('✅ 应用页面初始化完成')
}
