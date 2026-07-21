import type { Db } from '../../db-client'
import {
  dictionary,
  dictionaryItem,
  requestLog,
  sensitiveWord,
  systemConfig,
} from '@db/schema'
import { ApiTypeEnum } from '@libs/platform/constant'
import { and, desc, eq } from 'drizzle-orm'
import {
  addHours,
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
      { name: '韩文', code: DICTIONARY_ITEMS.workLanguage.ko, sortOrder: 4 },
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
      {
        name: '讲谈社',
        code: DICTIONARY_ITEMS.workPublisher.kodansha,
        sortOrder: 1,
      },
      {
        name: '集英社',
        code: DICTIONARY_ITEMS.workPublisher.shueisha,
        sortOrder: 2,
      },
      {
        name: 'KADOKAWA',
        code: DICTIONARY_ITEMS.workPublisher.kadokawa,
        sortOrder: 3,
      },
      {
        name: '新潮社',
        code: DICTIONARY_ITEMS.workPublisher.shinchosha,
        sortOrder: 4,
      },
      {
        name: 'Square Enix',
        code: DICTIONARY_ITEMS.workPublisher.squareEnix,
        sortOrder: 5,
      },
      {
        name: '小学馆',
        code: DICTIONARY_ITEMS.workPublisher.shogakukan,
        sortOrder: 6,
      },
    ],
  },
  {
    name: '作品年龄分级',
    code: DICTIONARY_CODES.workAgeRating,
    description: '作品年龄分级字典',
    items: [
      {
        name: '全年龄',
        code: DICTIONARY_ITEMS.workAgeRating.all,
        sortOrder: 1,
      },
      {
        name: 'PG-13',
        code: DICTIONARY_ITEMS.workAgeRating.pg13,
        sortOrder: 2,
      },
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
    remark: 'seed: 高风险违规内容',
  },
  {
    word: '诈骗',
    replaceWord: '**',
    level: 1,
    type: 5,
    matchMode: 2,
    isEnabled: true,
    remark: 'seed: 诈骗场景命中词',
  },
  {
    word: '色情',
    replaceWord: '**',
    level: 1,
    type: 1,
    matchMode: 1,
    isEnabled: true,
    remark: 'seed: 色情违规内容',
  },
  {
    word: '暴力',
    replaceWord: '**',
    level: 2,
    type: 2,
    matchMode: 1,
    isEnabled: true,
    remark: 'seed: 暴力违规内容',
  },
  {
    word: '反动',
    replaceWord: '**',
    level: 1,
    type: 5,
    matchMode: 1,
    isEnabled: true,
    remark: 'seed: 政治敏感内容',
  },
  {
    word: '毒品',
    replaceWord: '**',
    level: 1,
    type: 5,
    matchMode: 2,
    isEnabled: true,
    remark: 'seed: 毒品相关内容',
  },
  {
    word: '传销',
    replaceWord: '**',
    level: 2,
    type: 5,
    matchMode: 2,
    isEnabled: true,
    remark: 'seed: 传销违规内容',
  },
  {
    word: '违禁品',
    replaceWord: '**',
    level: 1,
    type: 5,
    matchMode: 1,
    isEnabled: true,
    remark: 'seed: 违禁品交易',
  },
] as const

export async function seedSystemReferenceData(db: Db) {
  console.log('🌱 初始化系统参考数据...')

  for (const dictFixture of DICTIONARY_FIXTURES) {
    const existingDictionary = await db.query.dictionary.findFirst({
      where: { code: dictFixture.code },
      columns: {
        id: true,
      },
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
        where: {
          AND: [
            { dictionaryCode: dictFixture.code },
            { code: itemFixture.code },
          ],
        },
        columns: {
          id: true,
        },
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
    where: { username: SEED_ADMIN_USERNAME },
    columns: {
      id: true,
      username: true,
    },
  })
  const readerA = await db.query.appUser.findFirst({
    where: { account: SEED_ACCOUNTS.readerA },
    columns: {
      id: true,
      account: true,
    },
  })

  const [latestConfig] = await db
    .select({
      id: systemConfig.id,
    })
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
      name: '漫读社区',
      slogan: '发现你的下一部心动作品',
      keywords: ['漫画', '轻小说', '社区', '追番', '评论'],
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
      .select({
        id: sensitiveWord.id,
      })
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
      apiType: ApiTypeEnum.ADMIN,
      method: 'POST',
      path: '/api/admin/task/create',
      params: { code: 'daily_read_chapter' },
      ip: '127.0.0.1',
      userAgent: 'seed-script/admin',
      device: { platform: 'desktop', role: 'admin' },
      actionType: 3,
      isSuccess: true,
      content: 'seed admin create task',
      createdAt: SEED_TIMELINE.previousDay,
    },
    {
      userId: readerA?.id,
      username: readerA?.account ?? null,
      apiType: ApiTypeEnum.APP,
      method: 'POST',
      path: '/api/app/chat/send-message',
      params: { bizKey: 'seed-chat' },
      ip: '127.0.0.1',
      userAgent: 'seed-script/app',
      device: { platform: 'mobile', role: 'reader' },
      actionType: 3,
      isSuccess: true,
      content: 'seed reader send message',
      createdAt: SEED_TIMELINE.seedAt,
    },
    {
      userId: admin?.id,
      username: admin?.username ?? null,
      apiType: ApiTypeEnum.ADMIN,
      method: 'POST',
      path: '/api/admin/work/create',
      params: { name: '咒术回战' },
      ip: '127.0.0.1',
      userAgent: 'seed-script/admin',
      device: { platform: 'desktop', role: 'admin' },
      actionType: 1,
      isSuccess: true,
      content: 'seed admin create work',
      createdAt: addHours(SEED_TIMELINE.releaseDay, 48),
    },
    {
      userId: admin?.id,
      username: admin?.username ?? null,
      apiType: ApiTypeEnum.ADMIN,
      method: 'PUT',
      path: '/api/admin/work/update',
      params: { id: 1 },
      ip: '127.0.0.1',
      userAgent: 'seed-script/admin',
      device: { platform: 'desktop', role: 'admin' },
      actionType: 2,
      isSuccess: true,
      content: 'seed admin update work',
      createdAt: addHours(SEED_TIMELINE.releaseDay, 72),
    },
    {
      userId: admin?.id,
      username: admin?.username ?? null,
      apiType: ApiTypeEnum.ADMIN,
      method: 'POST',
      path: '/api/admin/dictionary/item/create',
      params: { dictionaryCode: 'work_publisher' },
      ip: '127.0.0.1',
      userAgent: 'seed-script/admin',
      device: { platform: 'desktop', role: 'admin' },
      actionType: 1,
      isSuccess: true,
      content: 'seed admin create dictionary item',
      createdAt: addHours(SEED_TIMELINE.releaseDay, 2),
    },
    {
      userId: admin?.id,
      username: admin?.username ?? null,
      apiType: ApiTypeEnum.ADMIN,
      method: 'POST',
      path: '/api/admin/sensitive-word/create',
      params: { word: '赌博' },
      ip: '127.0.0.1',
      userAgent: 'seed-script/admin',
      device: { platform: 'desktop', role: 'admin' },
      actionType: 1,
      isSuccess: true,
      content: 'seed admin create sensitive word',
      createdAt: addHours(SEED_TIMELINE.releaseDay, 96),
    },
    {
      userId: readerA?.id,
      username: readerA?.account ?? null,
      apiType: ApiTypeEnum.APP,
      method: 'POST',
      path: '/api/app/forum/topic/create',
      params: { sectionId: 1 },
      ip: '10.20.30.10',
      userAgent: 'seed-script/app',
      device: { platform: 'mobile', role: 'reader' },
      actionType: 1,
      isSuccess: true,
      content: 'seed reader create topic',
      createdAt: addHours(SEED_TIMELINE.releaseDay, 120),
    },
    {
      userId: readerA?.id,
      username: readerA?.account ?? null,
      apiType: ApiTypeEnum.APP,
      method: 'POST',
      path: '/api/app/comment/create',
      params: { targetType: 1 },
      ip: '10.20.30.10',
      userAgent: 'seed-script/app',
      device: { platform: 'mobile', role: 'reader' },
      actionType: 1,
      isSuccess: true,
      content: 'seed reader create comment',
      createdAt: addHours(SEED_TIMELINE.releaseDay, 121),
    },
    {
      userId: readerA?.id,
      username: readerA?.account ?? null,
      apiType: ApiTypeEnum.APP,
      method: 'POST',
      path: '/api/app/favorite/toggle',
      params: { targetType: 1 },
      ip: '10.20.30.10',
      userAgent: 'seed-script/app',
      device: { platform: 'mobile', role: 'reader' },
      actionType: 3,
      isSuccess: true,
      content: 'seed reader favorite work',
      createdAt: addHours(SEED_TIMELINE.releaseDay, 122),
    },
    {
      userId: readerA?.id,
      username: readerA?.account ?? null,
      apiType: ApiTypeEnum.APP,
      method: 'POST',
      path: '/api/app/like/toggle',
      params: { targetType: 2 },
      ip: '10.20.30.10',
      userAgent: 'seed-script/app',
      device: { platform: 'mobile', role: 'reader' },
      actionType: 3,
      isSuccess: true,
      content: 'seed reader like comment',
      createdAt: addHours(SEED_TIMELINE.releaseDay, 123),
    },
    {
      userId: readerA?.id,
      username: readerA?.account ?? null,
      apiType: ApiTypeEnum.APP,
      method: 'POST',
      path: '/api/app/purchase/chapter',
      params: { chapterId: 2 },
      ip: '10.20.30.10',
      userAgent: 'seed-script/app',
      device: { platform: 'mobile', role: 'reader' },
      actionType: 3,
      isSuccess: true,
      content: 'seed reader purchase chapter',
      createdAt: addHours(SEED_TIMELINE.releaseDay, 124),
    },
    {
      userId: readerA?.id,
      username: readerA?.account ?? null,
      apiType: ApiTypeEnum.APP,
      method: 'GET',
      path: '/api/app/work/list',
      params: { page: 1 },
      ip: '10.20.30.10',
      userAgent: 'seed-script/app',
      device: { platform: 'mobile', role: 'reader' },
      actionType: 4,
      isSuccess: true,
      content: 'seed reader browse work list',
      createdAt: addHours(SEED_TIMELINE.releaseDay, 125),
    },
    {
      userId: readerA?.id,
      username: readerA?.account ?? null,
      apiType: ApiTypeEnum.APP,
      method: 'GET',
      path: '/api/app/work/detail',
      params: { id: 1 },
      ip: '10.20.30.10',
      userAgent: 'seed-script/app',
      device: { platform: 'mobile', role: 'reader' },
      actionType: 4,
      isSuccess: true,
      content: 'seed reader browse work detail',
      createdAt: addHours(SEED_TIMELINE.releaseDay, 126),
    },
    {
      userId: readerA?.id,
      username: readerA?.account ?? null,
      apiType: ApiTypeEnum.APP,
      method: 'POST',
      path: '/api/app/upload/image',
      params: {},
      ip: '10.20.30.10',
      userAgent: 'seed-script/app',
      device: { platform: 'mobile', role: 'reader' },
      actionType: 3,
      isSuccess: true,
      content: 'seed reader upload image',
      createdAt: addHours(SEED_TIMELINE.releaseDay, 127),
    },
    {
      userId: readerA?.id,
      username: readerA?.account ?? null,
      apiType: ApiTypeEnum.APP,
      method: 'POST',
      path: '/api/app/user/login',
      params: {},
      ip: '10.20.30.10',
      userAgent: 'seed-script/app',
      device: { platform: 'mobile', role: 'reader' },
      actionType: 3,
      isSuccess: true,
      content: 'seed reader login',
      createdAt: addHours(SEED_TIMELINE.releaseDay, 24),
    },
    {
      userId: admin?.id,
      username: admin?.username ?? null,
      apiType: ApiTypeEnum.ADMIN,
      method: 'POST',
      path: '/api/admin/user/login',
      params: {},
      ip: '127.0.0.1',
      userAgent: 'seed-script/admin',
      device: { platform: 'desktop', role: 'admin' },
      actionType: 3,
      isSuccess: true,
      content: 'seed admin login',
      createdAt: addHours(SEED_TIMELINE.releaseDay, 12),
    },
  ]

  for (const logFixture of requestFixtures) {
    const [existingLog] = await db
      .select({
        id: requestLog.id,
      })
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
