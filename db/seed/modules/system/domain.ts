import type { Db } from '../../db-client'
import { and, desc, eq } from 'drizzle-orm'
import {
  adminUser,
  appUser,
  dictionary,
  dictionaryItem,
  requestLog,
  sensitiveWord,
  systemConfig,
} from '../../../schema'
import {
  DICTIONARY_CODES,
  DICTIONARY_ITEMS,
  SEED_ACCOUNTS,
  SEED_ADMIN_USERNAME,
  SEED_TIMELINE,
} from '../../shared'

const DICTIONARY_FIXTURES = [
  {
    name: '作品语言',
    code: DICTIONARY_CODES.workLanguage,
    description: '作品语言标准字典，供作品语言字段复用',
    items: [
      { name: '中文', code: DICTIONARY_ITEMS.workLanguage.zh, sortOrder: 1 },
      { name: '日文', code: DICTIONARY_ITEMS.workLanguage.ja, sortOrder: 2 },
      { name: '英文', code: DICTIONARY_ITEMS.workLanguage.en, sortOrder: 3 },
    ],
  },
  {
    name: '国籍',
    code: DICTIONARY_CODES.nationality,
    description: '作者国籍字典，供作者资料和筛选场景复用',
    items: [
      { name: '中国', code: DICTIONARY_ITEMS.nationality.cn, sortOrder: 1 },
      { name: '日本', code: DICTIONARY_ITEMS.nationality.jp, sortOrder: 2 },
      { name: '韩国', code: DICTIONARY_ITEMS.nationality.kr, sortOrder: 3 },
    ],
  },
  {
    name: '作品地区',
    code: DICTIONARY_CODES.workRegion,
    description: '作品发行地区字典',
    items: [
      { name: '中国', code: DICTIONARY_ITEMS.workRegion.cn, sortOrder: 1 },
      { name: '日本', code: DICTIONARY_ITEMS.workRegion.jp, sortOrder: 2 },
      { name: '韩国', code: DICTIONARY_ITEMS.workRegion.kr, sortOrder: 3 },
    ],
  },
  {
    name: '作品出版社',
    code: DICTIONARY_CODES.workPublisher,
    description: '作品出版社字典，作品 publisher 字段统一写入对应编码',
    items: [
      { name: '讲谈社', code: DICTIONARY_ITEMS.workPublisher.kodansha, sortOrder: 1 },
      { name: '集英社', code: DICTIONARY_ITEMS.workPublisher.shueisha, sortOrder: 2 },
      { name: 'KADOKAWA', code: DICTIONARY_ITEMS.workPublisher.kadokawa, sortOrder: 3 },
      { name: '新潮社', code: DICTIONARY_ITEMS.workPublisher.shinchosha, sortOrder: 4 },
    ],
  },
  {
    name: '作品年龄分级',
    code: DICTIONARY_CODES.workAgeRating,
    description: '作品年龄分级字典',
    items: [
      { name: '全年龄', code: DICTIONARY_ITEMS.workAgeRating.all, sortOrder: 1 },
      { name: 'PG-13', code: DICTIONARY_ITEMS.workAgeRating.pg13, sortOrder: 2 },
      { name: 'R15', code: DICTIONARY_ITEMS.workAgeRating.r15, sortOrder: 3 },
      { name: 'R18', code: DICTIONARY_ITEMS.workAgeRating.r18, sortOrder: 4 },
    ],
  },
] as const

const SENSITIVE_WORD_FIXTURES = [
  {
    word: '赌博',
    replaceWord: '**',
    level: 1,
    type: 5,
    matchMode: 1,
    isEnabled: true,
    version: 1,
    remark: 'seed: 高风险违规内容',
  },
  {
    word: '诈骗',
    replaceWord: '**',
    level: 1,
    type: 5,
    matchMode: 2,
    isEnabled: true,
    version: 1,
    remark: 'seed: 诈骗场景命中词',
  },
] as const

export async function seedSystemReferenceData(db: Db) {
  console.log('🌱 初始化系统参考数据...')

  for (const dictFixture of DICTIONARY_FIXTURES) {
    const existingDictionary = await db.query.dictionary.findFirst({
      where: (table, { eq }) => eq(table.code, dictFixture.code),
    })

    let currentDictionary = existingDictionary

    if (!currentDictionary) {
      ;[currentDictionary] = await db
        .insert(dictionary)
        .values({
          name: dictFixture.name,
          code: dictFixture.code,
          description: dictFixture.description,
          isEnabled: true,
        })
        .returning()
      console.log(`  ✓ 字典创建: ${dictFixture.name}`)
    } else {
      ;[currentDictionary] = await db
        .update(dictionary)
        .set({
          name: dictFixture.name,
          description: dictFixture.description,
          isEnabled: true,
        })
        .where(eq(dictionary.id, currentDictionary.id))
        .returning()
      console.log(`  ↺ 字典更新: ${dictFixture.name}`)
    }

    for (const itemFixture of dictFixture.items) {
      const existingItem = await db.query.dictionaryItem.findFirst({
        where: and(
          eq(dictionaryItem.dictionaryCode, dictFixture.code),
          eq(dictionaryItem.code, itemFixture.code),
        ),
      })

      if (!existingItem) {
        await db.insert(dictionaryItem).values({
          dictionaryCode: dictFixture.code,
          name: itemFixture.name,
          code: itemFixture.code,
          sortOrder: itemFixture.sortOrder,
          isEnabled: true,
          description: `${dictFixture.name} seed 项`,
        })
      } else {
        await db
          .update(dictionaryItem)
          .set({
            name: itemFixture.name,
            sortOrder: itemFixture.sortOrder,
            isEnabled: true,
            description: `${dictFixture.name} seed 项`,
          })
          .where(eq(dictionaryItem.id, existingItem.id))
      }
    }
  }

  console.log('✅ 系统参考数据完成')
}

export async function seedSystemOperationalData(db: Db) {
  console.log('🌱 初始化系统运行数据...')

  const admin = await db.query.adminUser.findFirst({
    where: eq(adminUser.username, SEED_ADMIN_USERNAME),
  })
  const readerA = await db.query.appUser.findFirst({
    where: eq(appUser.account, SEED_ACCOUNTS.readerA),
  })

  const [latestConfig] = await db
    .select()
    .from(systemConfig)
    .orderBy(desc(systemConfig.id))
    .limit(1)

  const configPayload = {
    updatedById: admin?.id,
    aliyunConfig: {
      regionId: 'cn-shanghai',
      bucket: 'seed-bucket',
    },
    siteConfig: {
      name: 'Seed 漫读社区',
      slogan: '用于本地联调的完整示例数据集',
      keywords: ['seed', 'drizzle', 'forum', 'reader'],
    },
    maintenanceConfig: {
      enabled: false,
      message: 'seed 环境维护开关关闭',
    },
    contentReviewPolicy: {
      severe: 'block',
      medium: 'manual-review',
      mild: 'pass-with-log',
    },
    uploadConfig: {
      provider: 'local',
      cdnBaseUrl: 'https://static.example.com',
    },
  }

  if (!latestConfig) {
    await db.insert(systemConfig).values(configPayload)
    console.log('  ✓ 系统配置创建')
  } else {
    await db
      .update(systemConfig)
      .set(configPayload)
      .where(eq(systemConfig.id, latestConfig.id))
    console.log('  ↺ 系统配置更新')
  }

  for (const wordFixture of SENSITIVE_WORD_FIXTURES) {
    const [existingWord] = await db
      .select()
      .from(sensitiveWord)
      .where(eq(sensitiveWord.word, wordFixture.word))
      .limit(1)

    if (!existingWord) {
      await db.insert(sensitiveWord).values({
        ...wordFixture,
        createdBy: admin?.id,
        updatedBy: admin?.id,
      })
    } else {
      await db
        .update(sensitiveWord)
        .set({
          ...wordFixture,
          createdBy: admin?.id,
          updatedBy: admin?.id,
        })
        .where(eq(sensitiveWord.id, existingWord.id))
    }
  }
  console.log('  ✓ 敏感词完成')

  const requestFixtures = [
    {
      userId: admin?.id,
      username: admin?.username ?? null,
      apiType: 'admin',
      method: 'POST',
      path: '/api/admin/task/create',
      params: { code: 'daily_read_chapter' },
      ip: '127.0.0.1',
      userAgent: 'seed-script/admin',
      device: { platform: 'desktop', role: 'admin' },
      actionType: 'TASK_CREATE',
      isSuccess: true,
      content: 'seed admin create task',
      createdAt: SEED_TIMELINE.previousDay,
    },
    {
      userId: readerA?.id,
      username: readerA?.account ?? null,
      apiType: 'app',
      method: 'POST',
      path: '/api/app/chat/send-message',
      params: { bizKey: 'seed-chat' },
      ip: '127.0.0.1',
      userAgent: 'seed-script/app',
      device: { platform: 'mobile', role: 'reader' },
      actionType: 'SEND_MESSAGE',
      isSuccess: true,
      content: 'seed reader send message',
      createdAt: SEED_TIMELINE.seedAt,
    },
  ]

  for (const logFixture of requestFixtures) {
    const [existingLog] = await db
      .select()
      .from(requestLog)
      .where(
        and(
          eq(requestLog.method, logFixture.method),
          eq(requestLog.path, logFixture.path),
          eq(requestLog.actionType, logFixture.actionType),
        ),
      )
      .limit(1)

    if (!existingLog) {
      await db.insert(requestLog).values(logFixture)
    } else {
      await db
        .update(requestLog)
        .set(logFixture)
        .where(eq(requestLog.id, existingLog.id))
    }
  }
  console.log('  ✓ 请求日志完成')

  console.log('✅ 系统运行数据完成')
}
