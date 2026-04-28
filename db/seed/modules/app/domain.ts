import type { Db } from '../../db-client'
import {
  GrowthAssetTypeEnum,
  GrowthAuditDecisionEnum,
  GrowthLedgerActionEnum,
  GrowthRuleUsageSlotTypeEnum,
} from '@libs/growth/growth-ledger/growth-ledger.constant'
import { TokenTypeEnum } from '@libs/platform/modules/auth/types'
import { and, desc, eq, inArray, isNull } from 'drizzle-orm'
import {
  adminUser,
  appAgreement,
  appAgreementLog,
  appAnnouncement,
  appAnnouncementRead,
  appConfig,
  appPage,
  appUser,
  appUserCount,
  appUserToken,
  forumSection,
  forumTopic,
  forumUserActionLog,
  growthAuditLog,
  growthLedgerRecord,
  growthRewardRule,
  growthRuleUsageCounter,
  taskDefinition,
  taskEventLog,
  taskInstance,
  taskInstanceStep,
  taskStep,
  userAssetBalance,
  userBadge,
  userBadgeAssignment,
  userBrowseLog,
  userComment,
  userDownloadRecord,
  userFavorite,
  userLevelRule,
  userLike,
  userPurchaseRecord,
  userReport,
  userWorkReadingState,
  work,
  workChapter,
} from '../../../schema'
import {
  addHours,
  addMinutes,
  createAvatar,
  SEED_ACCOUNTS,
  SEED_ADMIN_USERNAME,
  SEED_PASSWORD_HASH,
  SEED_PLATFORM_ALL,
  SEED_TIMELINE,
} from '../../shared'

const DEFAULT_APP_CONFIG = {
  appName: '默认应用',
  appDesc: '这是一个默认的应用配置',
  appLogo: '',
  onboardingImage: '',
  themeColor: '#007AFF',
  secondaryColor: '#5856D6',
  optionalThemeColors: '#FF9500,#FF3B30,#4CD964,#5AC8FA,#007AFF',
  enableMaintenanceMode: false,
  maintenanceMessage: '系统维护中，请稍后再试',
  version: '1.0.0',
} as const

const LEVEL_FIXTURES = [
  {
    name: '新手读者',
    requiredExperience: 0,
    loginDays: 0,
    description: '用于初次进入社区的基础等级。',
    icon: 'https://static.example.com/levels/lv1.svg',
    badge: 'https://static.example.com/levels/lv1-badge.svg',
    color: '#5B8FF9',
    sortOrder: 1,
    business: 'app',
    dailyTopicLimit: 2,
    dailyReplyCommentLimit: 10,
    postInterval: 60,
    dailyLikeLimit: 20,
    dailyFavoriteLimit: 10,
    blacklistLimit: 20,
    workCollectionLimit: 50,
    purchasePayableRate: '1.00',
  },
  {
    name: '活跃读者',
    requiredExperience: 200,
    loginDays: 7,
    description: '具备稳定活跃度的读者等级。',
    icon: 'https://static.example.com/levels/lv2.svg',
    badge: 'https://static.example.com/levels/lv2-badge.svg',
    color: '#36CFC9',
    sortOrder: 2,
    business: 'app',
    dailyTopicLimit: 5,
    dailyReplyCommentLimit: 30,
    postInterval: 30,
    dailyLikeLimit: 50,
    dailyFavoriteLimit: 20,
    blacklistLimit: 30,
    workCollectionLimit: 120,
    purchasePayableRate: '0.95',
  },
  {
    name: '资深读者',
    requiredExperience: 600,
    loginDays: 30,
    description: '活跃度和阅读深度都更高的读者等级。',
    icon: 'https://static.example.com/levels/lv3.svg',
    badge: 'https://static.example.com/levels/lv3-badge.svg',
    color: '#F6BD16',
    sortOrder: 3,
    business: 'app',
    dailyTopicLimit: 10,
    dailyReplyCommentLimit: 80,
    postInterval: 10,
    dailyLikeLimit: 100,
    dailyFavoriteLimit: 50,
    blacklistLimit: 50,
    workCollectionLimit: 300,
    purchasePayableRate: '0.90',
  },
] as const

const REWARD_RULE_FIXTURES = [
  {
    type: 1,
    assetType: GrowthAssetTypeEnum.POINTS,
    assetKey: '',
    delta: 20,
    dailyLimit: 40,
    totalLimit: 0,
    remark: '发表主题奖励',
  },
  {
    type: 2,
    assetType: GrowthAssetTypeEnum.POINTS,
    assetKey: '',
    delta: 5,
    dailyLimit: 50,
    totalLimit: 0,
    remark: '发表回复奖励',
  },
  {
    type: 300,
    assetType: GrowthAssetTypeEnum.POINTS,
    assetKey: '',
    delta: 3,
    dailyLimit: 30,
    totalLimit: 0,
    remark: '章节阅读奖励',
  },
  {
    type: 1,
    assetType: GrowthAssetTypeEnum.EXPERIENCE,
    assetKey: '',
    delta: 20,
    dailyLimit: 40,
    totalLimit: 0,
    remark: '发帖经验奖励',
  },
  {
    type: 2,
    assetType: GrowthAssetTypeEnum.EXPERIENCE,
    assetKey: '',
    delta: 8,
    dailyLimit: 80,
    totalLimit: 0,
    remark: '回复经验奖励',
  },
] as const

const USER_FIXTURES = [
  {
    account: SEED_ACCOUNTS.readerA,
    levelName: '活跃读者',
    nickname: '小光',
    phoneNumber: '13800138001',
    emailAddress: 'seed.reader.001@example.com',
    avatarUrl: createAvatar('seed-reader-001'),
    signature: '把追更变成日常习惯。',
    bio: '偏爱长线叙事和世界观铺陈。',
    genderType: 1,
    birthDate: '1998-05-12',
    points: 90,
    experience: 280,
    status: 1,
    lastLoginAt: addHours(SEED_TIMELINE.seedAt, -2),
    lastLoginIp: '127.0.0.11',
  },
  {
    account: SEED_ACCOUNTS.readerB,
    levelName: '活跃读者',
    nickname: '阿澈',
    phoneNumber: '13800138002',
    emailAddress: 'seed.reader.002@example.com',
    avatarUrl: createAvatar('seed-reader-002'),
    signature: '喜欢推理，也喜欢讨论角色动机。',
    bio: '小说和漫画都会看，偏爱悬疑题材。',
    genderType: 2,
    birthDate: '1996-11-04',
    points: 180,
    experience: 520,
    status: 1,
    lastLoginAt: addHours(SEED_TIMELINE.seedAt, -4),
    lastLoginIp: '127.0.0.12',
  },
  {
    account: SEED_ACCOUNTS.readerC,
    levelName: '资深读者',
    nickname: '团子',
    phoneNumber: '13800138003',
    emailAddress: 'seed.reader.003@example.com',
    avatarUrl: createAvatar('seed-reader-003'),
    signature: '更喜欢帮大家整理资料和目录。',
    bio: '社区维护型用户，擅长整理时间线和设定。',
    genderType: 0,
    birthDate: '1994-08-21',
    points: 360,
    experience: 860,
    status: 1,
    lastLoginAt: addHours(SEED_TIMELINE.seedAt, -1),
    lastLoginIp: '127.0.0.13',
  },
] as const

const PAGE_FIXTURES = [
  {
    code: 'user_agreement',
    path: '/legal/user-agreement',
    name: '用户协议',
    title: '用户协议',
    description: '应用用户协议页面',
    accessLevel: 0,
  },
  {
    code: 'privacy_policy',
    path: '/legal/privacy-policy',
    name: '隐私政策',
    title: '隐私政策',
    description: '应用隐私政策页面',
    accessLevel: 0,
  },
  {
    code: 'about_us',
    path: '/about',
    name: '关于我们',
    title: '关于我们',
    description: '应用介绍页面',
    accessLevel: 0,
  },
] as const

const AGREEMENT_FIXTURES = [
  {
    title: '用户协议',
    content: '<h1>用户协议</h1><p>seed 环境协议内容，用于协议签署联调。</p>',
    version: '2026.03',
    isForce: false,
    showInAuth: true,
    isPublished: true,
    publishedAt: SEED_TIMELINE.releaseDay,
  },
  {
    title: '隐私政策',
    content:
      '<h1>隐私政策</h1><p>seed 环境隐私政策内容，用于登录页和同意记录联调。</p>',
    version: '2026.03',
    isForce: true,
    showInAuth: true,
    isPublished: true,
    publishedAt: addHours(SEED_TIMELINE.releaseDay, 1),
  },
] as const

const ANNOUNCEMENT_FIXTURES = [
  {
    title: '2026 春季版本更新',
    summary: '新增长线追更能力和社区话题联动。',
    content: 'seed 版本更新公告：补齐作品、论坛、消息和成长相关联调数据。',
    announcementType: 2,
    priorityLevel: 2,
    isPublished: true,
    isPinned: true,
    showAsPopup: true,
    popupBackgroundImage:
      'https://static.example.com/announcements/update-2026-03.jpg',
    publishStartTime: SEED_TIMELINE.releaseDay,
    publishEndTime: addHours(SEED_TIMELINE.seedAt, 72),
    pageCode: 'about_us',
  },
  {
    title: '社区发言规范升级',
    summary: '统一社区发言边界和处理流程。',
    content:
      'seed 政策公告：更新社区发言规范和处理建议，用于公告、通知、已读联调。',
    announcementType: 1,
    priorityLevel: 1,
    isPublished: true,
    isPinned: false,
    showAsPopup: false,
    popupBackgroundImage: null,
    publishStartTime: addHours(SEED_TIMELINE.releaseDay, 2),
    publishEndTime: addHours(SEED_TIMELINE.seedAt, 96),
    pageCode: null,
  },
] as const

const BADGE_FIXTURES = [
  {
    name: '新手启程',
    type: 1,
    description: '完成基础注册与首次阅读后获得。',
    icon: 'https://static.example.com/badges/seed-start.svg',
    business: 'app',
    eventKey: 'user.register',
    sortOrder: 1,
  },
  {
    name: '讨论发起者',
    type: 2,
    description: '首次发起高质量主题后获得。',
    icon: 'https://static.example.com/badges/forum-topic.svg',
    business: 'forum',
    eventKey: 'forum.topic.create',
    sortOrder: 2,
  },
  {
    name: '深夜追更',
    type: 3,
    description: '完成一次深夜章节追更后获得。',
    icon: 'https://static.example.com/badges/night-reader.svg',
    business: 'content',
    eventKey: 'chapter.purchase',
    sortOrder: 3,
  },
] as const

const TASK_FIXTURES = [
  {
    code: 'daily_read_chapter',
    title: '每日阅读付费章节',
    description: '每天完成一次付费章节阅读。',
    cover: 'https://static.example.com/tasks/read-chapter.jpg',
    sceneType: 2,
    status: 1,
    claimMode: 1,
    completionPolicy: 1,
    repeatType: 1,
    rewardItems: [
      {
        assetType: GrowthAssetTypeEnum.POINTS,
        assetKey: '',
        amount: 5,
      },
      {
        assetType: GrowthAssetTypeEnum.EXPERIENCE,
        assetKey: '',
        amount: 12,
      },
    ],
    step: {
      stepKey: 'step_001',
      title: '阅读章节',
      description: '阅读任意一章漫画章节后推进任务。',
      stepNo: 1,
      triggerMode: 2,
      eventCode: 300,
      targetValue: 1,
      templateKey: 'COMIC_CHAPTER_READ',
      filterPayload: null,
      dedupeScope: null,
    },
  },
  {
    code: 'daily_forum_interaction',
    title: '每日参与讨论',
    description: '每天参与一次主题讨论或回复。',
    cover: 'https://static.example.com/tasks/forum-interaction.jpg',
    sceneType: 2,
    status: 1,
    claimMode: 2,
    completionPolicy: 1,
    repeatType: 1,
    rewardItems: [
      {
        assetType: GrowthAssetTypeEnum.POINTS,
        assetKey: '',
        amount: 3,
      },
      {
        assetType: GrowthAssetTypeEnum.EXPERIENCE,
        assetKey: '',
        amount: 8,
      },
    ],
    step: {
      stepKey: 'step_001',
      title: '参与讨论',
      description: '完成一次手动互动后推进任务。',
      stepNo: 1,
      triggerMode: 1,
      eventCode: null,
      targetValue: 1,
      templateKey: null,
      filterPayload: null,
      dedupeScope: null,
    },
  },
] as const

export async function seedAppCoreDomain(db: Db) {
  console.log('🌱 初始化应用核心数据...')

  const admin = await db.query.adminUser.findFirst({
    where: eq(adminUser.username, SEED_ADMIN_USERNAME),
  })

  for (const levelFixture of LEVEL_FIXTURES) {
    const existing = await db.query.userLevelRule.findFirst({
      where: eq(userLevelRule.name, levelFixture.name),
    })

    if (!existing) {
      await db.insert(userLevelRule).values({
        ...levelFixture,
        isEnabled: true,
      })
    } else {
      await db
        .update(userLevelRule)
        .set({
          ...levelFixture,
          isEnabled: true,
        })
        .where(eq(userLevelRule.id, existing.id))
    }
  }
  console.log('  ✓ 等级规则完成')

  for (const ruleFixture of REWARD_RULE_FIXTURES) {
    const [existing] = await db
      .select()
      .from(growthRewardRule)
      .where(
        and(
          eq(growthRewardRule.type, ruleFixture.type),
          eq(growthRewardRule.assetType, ruleFixture.assetType),
          eq(growthRewardRule.assetKey, ruleFixture.assetKey),
        ),
      )
      .limit(1)

    if (!existing) {
      await db.insert(growthRewardRule).values({
        ...ruleFixture,
        isEnabled: true,
      })
    } else {
      await db
        .update(growthRewardRule)
        .set({
          ...ruleFixture,
          isEnabled: true,
        })
        .where(eq(growthRewardRule.id, existing.id))
    }
  }
  console.log('  ✓ 成长奖励规则完成')

  for (const badgeFixture of BADGE_FIXTURES) {
    const existing = await db.query.userBadge.findFirst({
      where: eq(userBadge.name, badgeFixture.name),
    })

    if (!existing) {
      await db.insert(userBadge).values({
        ...badgeFixture,
        isEnabled: true,
      })
    } else {
      await db
        .update(userBadge)
        .set({
          ...badgeFixture,
          isEnabled: true,
        })
        .where(eq(userBadge.id, existing.id))
    }
  }
  console.log('  ✓ 徽章完成')

  for (const pageFixture of PAGE_FIXTURES) {
    const existing = await db.query.appPage.findFirst({
      where: eq(appPage.code, pageFixture.code),
    })

    if (!existing) {
      await db.insert(appPage).values({
        ...pageFixture,
        isEnabled: true,
        enablePlatform: SEED_PLATFORM_ALL,
      })
    } else {
      await db
        .update(appPage)
        .set({
          ...pageFixture,
          isEnabled: true,
          enablePlatform: SEED_PLATFORM_ALL,
        })
        .where(eq(appPage.id, existing.id))
    }
  }
  console.log('  ✓ 页面完成')

  const levelRules = await db.query.userLevelRule.findMany()
  const levelIdByName = new Map<string, number>(
    levelRules.map((item) => [item.name, item.id]),
  )

  for (const userFixture of USER_FIXTURES) {
    const existing = await db.query.appUser.findFirst({
      where: eq(appUser.account, userFixture.account),
    })

    const payload: typeof appUser.$inferInsert = {
      account: userFixture.account,
      phoneNumber: userFixture.phoneNumber,
      emailAddress: userFixture.emailAddress,
      levelId: levelIdByName.get(userFixture.levelName) ?? null,
      nickname: userFixture.nickname,
      password: SEED_PASSWORD_HASH,
      avatarUrl: userFixture.avatarUrl,
      signature: userFixture.signature,
      bio: userFixture.bio,
      isEnabled: true,
      genderType: userFixture.genderType,
      birthDate: userFixture.birthDate,
      status: userFixture.status,
      banReason: null,
      banUntil: null,
      lastLoginAt: userFixture.lastLoginAt,
      lastLoginIp: userFixture.lastLoginIp,
    }

    if (!existing) {
      await db.insert(appUser).values(payload)
    } else {
      await db.update(appUser).set(payload).where(eq(appUser.id, existing.id))
    }
  }
  console.log('  ✓ 应用用户完成')

  for (const userFixture of USER_FIXTURES) {
    const user = await db.query.appUser.findFirst({
      where: eq(appUser.account, userFixture.account),
    })
    if (!user) {
      continue
    }

    const balanceFixtures = [
      {
        userId: user.id,
        assetType: GrowthAssetTypeEnum.POINTS,
        assetKey: '',
        balance: userFixture.points,
      },
      {
        userId: user.id,
        assetType: GrowthAssetTypeEnum.EXPERIENCE,
        assetKey: '',
        balance: userFixture.experience,
      },
    ] as const

    for (const balanceFixture of balanceFixtures) {
      const existingBalance = await db.query.userAssetBalance.findFirst({
        where: and(
          eq(userAssetBalance.userId, balanceFixture.userId),
          eq(userAssetBalance.assetType, balanceFixture.assetType),
          eq(userAssetBalance.assetKey, balanceFixture.assetKey),
        ),
      })

      if (!existingBalance) {
        await db.insert(userAssetBalance).values(balanceFixture)
      } else {
        await db
          .update(userAssetBalance)
          .set({ balance: balanceFixture.balance })
          .where(eq(userAssetBalance.id, existingBalance.id))
      }
    }
  }
  console.log('  ✓ 用户资产余额完成')

  const tokenFixtures = [
    {
      account: SEED_ACCOUNTS.readerA,
      jti: 'seed-app-access-001',
      tokenType: TokenTypeEnum.ACCESS,
      expiresAt: new Date('2026-12-31T23:59:59.000Z'),
      deviceInfo: { device: 'ios', os: 'iOS 18', appVersion: '1.0.0-seed' },
      ipAddress: '127.0.0.21',
      userAgent: 'seed-script/app-reader-001',
    },
    {
      account: SEED_ACCOUNTS.readerB,
      jti: 'seed-app-access-002',
      tokenType: TokenTypeEnum.ACCESS,
      expiresAt: new Date('2026-12-31T23:59:59.000Z'),
      deviceInfo: {
        device: 'android',
        os: 'Android 16',
        appVersion: '1.0.0-seed',
      },
      ipAddress: '127.0.0.22',
      userAgent: 'seed-script/app-reader-002',
    },
  ] as const

  for (const tokenFixture of tokenFixtures) {
    const user = await db.query.appUser.findFirst({
      where: eq(appUser.account, tokenFixture.account),
    })
    if (!user) {
      continue
    }

    const existing = await db.query.appUserToken.findFirst({
      where: eq(appUserToken.jti, tokenFixture.jti),
    })

    if (!existing) {
      await db.insert(appUserToken).values({
        ...tokenFixture,
        userId: user.id,
      })
    } else {
      await db
        .update(appUserToken)
        .set({
          ...tokenFixture,
          userId: user.id,
        })
        .where(eq(appUserToken.id, existing.id))
    }
  }
  console.log('  ✓ 用户令牌完成')

  const [latestConfig] = await db
    .select()
    .from(appConfig)
    .orderBy(desc(appConfig.id))
    .limit(1)

  const configPayload = {
    ...DEFAULT_APP_CONFIG,
    appName: 'Seed 漫读',
    appDesc: '用于本地联调的完整种子数据环境。',
    appLogo: 'https://static.example.com/app/logo-seed.png',
    onboardingImage: 'https://static.example.com/app/onboarding-seed.png',
    themeColor: '#0F766E',
    secondaryColor: '#0EA5E9',
    optionalThemeColors: '#0F766E,#0EA5E9,#F59E0B,#EF4444,#8B5CF6',
    enableMaintenanceMode: false,
    maintenanceMessage: 'seed 环境当前可用。',
    version: '2026.03.20-seed',
    updatedById: admin?.id,
  }

  if (!latestConfig) {
    await db.insert(appConfig).values(configPayload)
  } else {
    await db
      .update(appConfig)
      .set(configPayload)
      .where(eq(appConfig.id, latestConfig.id))
  }
  console.log('  ✓ 应用配置完成')

  for (const agreementFixture of AGREEMENT_FIXTURES) {
    const existing = await db.query.appAgreement.findFirst({
      where: eq(appAgreement.title, agreementFixture.title),
    })

    if (!existing) {
      await db.insert(appAgreement).values(agreementFixture)
    } else {
      await db
        .update(appAgreement)
        .set(agreementFixture)
        .where(eq(appAgreement.id, existing.id))
    }
  }
  console.log('  ✓ 协议完成')

  for (const announcementFixture of ANNOUNCEMENT_FIXTURES) {
    const page = announcementFixture.pageCode
      ? await db.query.appPage.findFirst({
          where: eq(appPage.code, announcementFixture.pageCode),
        })
      : null

    const existing = await db.query.appAnnouncement.findFirst({
      where: eq(appAnnouncement.title, announcementFixture.title),
    })

    const payload = {
      pageId: page?.id ?? null,
      title: announcementFixture.title,
      summary: announcementFixture.summary,
      content: announcementFixture.content,
      announcementType: announcementFixture.announcementType,
      priorityLevel: announcementFixture.priorityLevel,
      isPublished: announcementFixture.isPublished,
      isPinned: announcementFixture.isPinned,
      showAsPopup: announcementFixture.showAsPopup,
      popupBackgroundImage: announcementFixture.popupBackgroundImage,
      enablePlatform: SEED_PLATFORM_ALL,
      publishStartTime: announcementFixture.publishStartTime,
      publishEndTime: announcementFixture.publishEndTime,
      viewCount: existing?.viewCount ?? 0,
    }

    if (!existing) {
      await db.insert(appAnnouncement).values(payload)
    } else {
      await db
        .update(appAnnouncement)
        .set(payload)
        .where(eq(appAnnouncement.id, existing.id))
    }
  }
  console.log('  ✓ 公告完成')

  for (const taskFixture of TASK_FIXTURES) {
    const existing = await db.query.taskDefinition.findFirst({
      where: eq(taskDefinition.code, taskFixture.code),
    })

    const payload = {
      code: taskFixture.code,
      title: taskFixture.title,
      description: taskFixture.description,
      cover: taskFixture.cover,
      sceneType: taskFixture.sceneType,
      status: taskFixture.status,
      sortOrder: taskFixture.code === 'daily_read_chapter' ? 1 : 2,
      claimMode: taskFixture.claimMode,
      completionPolicy: taskFixture.completionPolicy,
      repeatType: taskFixture.repeatType,
      createdById: admin?.id ?? null,
      updatedById: admin?.id ?? null,
      startAt: SEED_TIMELINE.releaseDay,
      endAt: addHours(SEED_TIMELINE.seedAt, 240),
      rewardItems: taskFixture.rewardItems,
    }

    if (!existing) {
      const [createdTask] = await db
        .insert(taskDefinition)
        .values(payload)
        .returning()
      await db.insert(taskStep).values({
        taskId: createdTask.id,
        stepKey: taskFixture.step.stepKey,
        title: taskFixture.step.title,
        description: taskFixture.step.description,
        stepNo: taskFixture.step.stepNo,
        triggerMode: taskFixture.step.triggerMode,
        eventCode: taskFixture.step.eventCode,
        targetValue: taskFixture.step.targetValue,
        templateKey: taskFixture.step.templateKey,
        filterPayload: taskFixture.step.filterPayload,
        dedupeScope: taskFixture.step.dedupeScope,
      })
    } else {
      await db
        .update(taskDefinition)
        .set(payload)
        .where(eq(taskDefinition.id, existing.id))

      const existingStep = await db.query.taskStep.findFirst({
        where: and(eq(taskStep.taskId, existing.id), eq(taskStep.stepNo, 1)),
      })
      const stepPayload = {
        taskId: existing.id,
        stepKey: taskFixture.step.stepKey,
        title: taskFixture.step.title,
        description: taskFixture.step.description,
        stepNo: taskFixture.step.stepNo,
        triggerMode: taskFixture.step.triggerMode,
        eventCode: taskFixture.step.eventCode,
        targetValue: taskFixture.step.targetValue,
        templateKey: taskFixture.step.templateKey,
        filterPayload: taskFixture.step.filterPayload,
        dedupeScope: taskFixture.step.dedupeScope,
      }
      if (!existingStep) {
        await db.insert(taskStep).values(stepPayload)
      } else {
        await db
          .update(taskStep)
          .set(stepPayload)
          .where(eq(taskStep.id, existingStep.id))
      }
    }
  }
  console.log('  ✓ 任务完成')

  console.log('✅ 应用核心数据完成')
}

export async function seedAppActivityDomain(db: Db) {
  console.log('🌱 初始化应用互动数据...')

  const userA = await db.query.appUser.findFirst({
    where: eq(appUser.account, SEED_ACCOUNTS.readerA),
  })
  const userB = await db.query.appUser.findFirst({
    where: eq(appUser.account, SEED_ACCOUNTS.readerB),
  })
  const userC = await db.query.appUser.findFirst({
    where: eq(appUser.account, SEED_ACCOUNTS.readerC),
  })

  if (!userA || !userB || !userC) {
    console.log('  ℹ 缺少 seed 用户，跳过应用互动数据')
    return
  }

  const aotWork = await db.query.work.findFirst({
    where: and(eq(work.name, '进击的巨人'), eq(work.type, 1)),
  })
  const whiteNightWork = await db.query.work.findFirst({
    where: and(eq(work.name, '白夜行'), eq(work.type, 2)),
  })
  const aotChapterTwo = aotWork
    ? await db.query.workChapter.findFirst({
        where: and(
          eq(workChapter.workId, aotWork.id),
          eq(workChapter.sortOrder, 2),
        ),
      })
    : null
  const whiteNightChapterTwo = whiteNightWork
    ? await db.query.workChapter.findFirst({
        where: and(
          eq(workChapter.workId, whiteNightWork.id),
          eq(workChapter.sortOrder, 2),
        ),
      })
    : null
  const aotTopic = await db.query.forumTopic.findFirst({
    where: and(
      eq(forumTopic.title, '进击的巨人：前三卷伏笔整理'),
      isNull(forumTopic.deletedAt),
    ),
  })
  const whiteNightTopic = await db.query.forumTopic.findFirst({
    where: and(
      eq(forumTopic.title, '白夜行：你更在意悬疑线还是人物线？'),
      isNull(forumTopic.deletedAt),
    ),
  })

  if (
    !aotWork ||
    !whiteNightWork ||
    !aotChapterTwo ||
    !whiteNightChapterTwo ||
    !aotTopic ||
    !whiteNightTopic
  ) {
    console.log('  ℹ 缺少作品或主题数据，跳过应用互动数据')
    return
  }

  const moderatorUser = userC

  const agreements = await db.query.appAgreement.findMany()
  for (const agreement of agreements) {
    const agreementUsers =
      agreement.title === '隐私政策' ? [userA, userB] : [userA]
    for (const user of agreementUsers) {
      const existingLog = await db.query.appAgreementLog.findFirst({
        where: and(
          eq(appAgreementLog.userId, user.id),
          eq(appAgreementLog.agreementId, agreement.id),
        ),
      })

      const payload = {
        userId: user.id,
        agreementId: agreement.id,
        version: agreement.version,
        agreedAt: addMinutes(SEED_TIMELINE.releaseDay, user.id),
        ipAddress: '127.0.0.1',
        deviceInfo: `seed-device-${user.account}`,
      }

      if (!existingLog) {
        await db.insert(appAgreementLog).values(payload)
      } else {
        await db
          .update(appAgreementLog)
          .set(payload)
          .where(eq(appAgreementLog.id, existingLog.id))
      }
    }
  }
  console.log('  ✓ 协议签署记录完成')

  const announcements = await db.query.appAnnouncement.findMany()
  for (const [index, announcement] of announcements.entries()) {
    const targetUser = index % 2 === 0 ? userA : userB
    const existingRead = await db.query.appAnnouncementRead.findFirst({
      where: and(
        eq(appAnnouncementRead.announcementId, announcement.id),
        eq(appAnnouncementRead.userId, targetUser.id),
      ),
    })

    if (!existingRead) {
      await db.insert(appAnnouncementRead).values({
        announcementId: announcement.id,
        userId: targetUser.id,
        readAt: addHours(SEED_TIMELINE.seedAt, index),
      })
    } else {
      await db
        .update(appAnnouncementRead)
        .set({
          readAt: addHours(SEED_TIMELINE.seedAt, index),
        })
        .where(
          and(
            eq(appAnnouncementRead.announcementId, announcement.id),
            eq(appAnnouncementRead.userId, targetUser.id),
          ),
        )
    }
  }
  console.log('  ✓ 公告已读记录完成')

  const existingWorkComment = await db.query.userComment.findFirst({
    where: and(
      eq(userComment.targetType, 1),
      eq(userComment.targetId, aotWork.id),
      eq(userComment.userId, userB.id),
      eq(
        userComment.content,
        '墙内外的信息差在这部作品里几乎从第一话就埋下了。',
      ),
    ),
  })

  let workComment = existingWorkComment
  const workCommentPayload = {
    targetType: 1,
    targetId: aotWork.id,
    userId: userB.id,
    content: '墙内外的信息差在这部作品里几乎从第一话就埋下了。',
    floor: 1,
    isHidden: false,
    auditStatus: 1,
    auditById: moderatorUser.id,
    auditRole: 2,
    auditReason: 'seed: 通过',
    auditAt: addHours(SEED_TIMELINE.previousDay, 2),
    likeCount: existingWorkComment?.likeCount ?? 0,
    sensitiveWordHits: [],
    createdAt: addHours(SEED_TIMELINE.previousDay, 2),
  }

  if (!workComment) {
    ;[workComment] = await db
      .insert(userComment)
      .values(workCommentPayload)
      .returning()
  } else {
    ;[workComment] = await db
      .update(userComment)
      .set(workCommentPayload)
      .where(eq(userComment.id, workComment.id))
      .returning()
  }

  const existingChapterComment = await db.query.userComment.findFirst({
    where: and(
      eq(userComment.targetType, 2),
      eq(userComment.targetId, aotChapterTwo.id),
      eq(userComment.userId, userA.id),
      eq(userComment.content, '第二话的节奏明显收紧，购买后继续读的体验很顺。'),
    ),
  })

  let chapterComment = existingChapterComment
  const chapterCommentPayload = {
    targetType: 2,
    targetId: aotChapterTwo.id,
    userId: userA.id,
    content: '第二话的节奏明显收紧，购买后继续读的体验很顺。',
    floor: 1,
    isHidden: false,
    auditStatus: 1,
    auditById: moderatorUser.id,
    auditRole: 2,
    auditReason: 'seed: 通过',
    auditAt: addHours(SEED_TIMELINE.previousDay, 3),
    likeCount: existingChapterComment?.likeCount ?? 0,
    sensitiveWordHits: [],
    createdAt: addHours(SEED_TIMELINE.previousDay, 3),
  }

  if (!chapterComment) {
    ;[chapterComment] = await db
      .insert(userComment)
      .values(chapterCommentPayload)
      .returning()
  } else {
    ;[chapterComment] = await db
      .update(userComment)
      .set(chapterCommentPayload)
      .where(eq(userComment.id, chapterComment.id))
      .returning()
  }

  const existingForumRootComment = await db.query.userComment.findFirst({
    where: and(
      eq(userComment.targetType, 3),
      eq(userComment.targetId, aotTopic.id),
      eq(userComment.userId, userB.id),
      eq(userComment.content, '我觉得第一卷就把未来冲突埋得很深。'),
    ),
  })

  let forumRootComment = existingForumRootComment
  const forumRootCommentPayload = {
    targetType: 3,
    targetId: aotTopic.id,
    userId: userB.id,
    content: '我觉得第一卷就把未来冲突埋得很深。',
    floor: 1,
    isHidden: false,
    auditStatus: 1,
    auditById: moderatorUser.id,
    auditRole: 2,
    auditReason: 'seed: 通过',
    auditAt: addHours(SEED_TIMELINE.previousDay, 4),
    likeCount: existingForumRootComment?.likeCount ?? 0,
    sensitiveWordHits: [],
    createdAt: addHours(SEED_TIMELINE.previousDay, 4),
  }

  if (!forumRootComment) {
    ;[forumRootComment] = await db
      .insert(userComment)
      .values(forumRootCommentPayload)
      .returning()
  } else {
    ;[forumRootComment] = await db
      .update(userComment)
      .set(forumRootCommentPayload)
      .where(eq(userComment.id, forumRootComment.id))
      .returning()
  }

  const existingForumComment = await db.query.userComment.findFirst({
    where: and(
      eq(userComment.targetType, 3),
      eq(userComment.targetId, aotTopic.id),
      eq(userComment.userId, userA.id),
      eq(userComment.content, '而且艾伦和调查兵团的立场差异很早就有预警。'),
    ),
  })

  const forumCommentPayload = {
    targetType: 3,
    targetId: aotTopic.id,
    userId: userA.id,
    content: '而且艾伦和调查兵团的立场差异很早就有预警。',
    floor: 2,
    replyToId: forumRootComment.id,
    actualReplyToId: forumRootComment.id,
    isHidden: false,
    auditStatus: 1,
    auditById: moderatorUser.id,
    auditRole: 2,
    auditReason: 'seed: 通过',
    auditAt: addHours(SEED_TIMELINE.previousDay, 5),
    likeCount: existingForumComment?.likeCount ?? 0,
    sensitiveWordHits: [],
    createdAt: addHours(SEED_TIMELINE.previousDay, 5),
  }

  if (!existingForumComment) {
    await db.insert(userComment).values(forumCommentPayload)
  } else {
    await db
      .update(userComment)
      .set(forumCommentPayload)
      .where(eq(userComment.id, existingForumComment.id))
  }
  console.log('  ✓ 论坛评论完成')

  const forumTopicComments = await db.query.userComment.findMany({
    where: and(
      eq(userComment.targetType, 3),
      eq(userComment.targetId, aotTopic.id),
      isNull(userComment.deletedAt),
    ),
  })

  for (const comment of forumTopicComments) {
    const existingAction = await db.query.forumUserActionLog.findFirst({
      where: and(
        eq(forumUserActionLog.userId, comment.userId),
        eq(forumUserActionLog.targetId, comment.id),
        eq(forumUserActionLog.actionType, 3),
      ),
    })

    if (!existingAction) {
      await db.insert(forumUserActionLog).values({
        userId: comment.userId,
        targetId: comment.id,
        actionType: 2,
        targetType: 2,
        afterData: JSON.stringify({ content: comment.content }),
        ipAddress: '127.0.0.1',
        userAgent: 'seed-script/comment',
        createdAt: comment.createdAt,
      })
    }
  }
  console.log('  ✓ 论坛评论操作日志完成')

  const likeFixtures = [
    {
      targetType: 3,
      targetId: aotTopic.id,
      sceneType: 3,
      sceneId: aotTopic.id,
      userId: userC.id,
      commentLevel: null,
    },
    {
      targetType: 4,
      targetId: forumRootComment.id,
      sceneType: 3,
      sceneId: aotTopic.id,
      userId: userA.id,
      commentLevel: 1,
    },
    {
      targetType: 1,
      targetId: aotWork.id,
      sceneType: 1,
      sceneId: aotWork.id,
      userId: userB.id,
      commentLevel: null,
    },
    {
      targetType: 2,
      targetId: aotChapterTwo.id,
      sceneType: 2,
      sceneId: aotChapterTwo.id,
      userId: userA.id,
      commentLevel: null,
    },
  ] as const

  for (const likeFixture of likeFixtures) {
    const existingLike = await db.query.userLike.findFirst({
      where: and(
        eq(userLike.targetType, likeFixture.targetType),
        eq(userLike.targetId, likeFixture.targetId),
        eq(userLike.userId, likeFixture.userId),
      ),
    })

    if (!existingLike) {
      await db.insert(userLike).values(likeFixture)
    }
  }
  console.log('  ✓ 点赞记录完成')

  const favoriteFixtures = [
    {
      targetType: 1,
      targetId: aotWork.id,
      userId: userC.id,
    },
    {
      targetType: 3,
      targetId: whiteNightTopic.id,
      userId: userA.id,
    },
    {
      targetType: 2,
      targetId: whiteNightWork.id,
      userId: userB.id,
    },
  ] as const

  for (const favoriteFixture of favoriteFixtures) {
    const existingFavorite = await db.query.userFavorite.findFirst({
      where: and(
        eq(userFavorite.targetType, favoriteFixture.targetType),
        eq(userFavorite.targetId, favoriteFixture.targetId),
        eq(userFavorite.userId, favoriteFixture.userId),
      ),
    })

    if (!existingFavorite) {
      await db.insert(userFavorite).values(favoriteFixture)
    }
  }
  console.log('  ✓ 收藏记录完成')

  const downloadFixtures = [
    {
      targetType: 1,
      targetId: aotChapterTwo.id,
      userId: userA.id,
      createdAt: addHours(SEED_TIMELINE.seedAt, -5),
    },
    {
      targetType: 2,
      targetId: whiteNightChapterTwo.id,
      userId: userB.id,
      createdAt: addHours(SEED_TIMELINE.seedAt, -4),
    },
  ] as const

  for (const downloadFixture of downloadFixtures) {
    const existingDownload = await db.query.userDownloadRecord.findFirst({
      where: and(
        eq(userDownloadRecord.targetType, downloadFixture.targetType),
        eq(userDownloadRecord.targetId, downloadFixture.targetId),
        eq(userDownloadRecord.userId, downloadFixture.userId),
      ),
    })

    if (!existingDownload) {
      await db.insert(userDownloadRecord).values(downloadFixture)
    } else {
      await db
        .update(userDownloadRecord)
        .set(downloadFixture)
        .where(eq(userDownloadRecord.id, existingDownload.id))
    }
  }
  console.log('  ✓ 下载记录完成')

  const purchaseFixtures = [
    {
      targetType: 1,
      targetId: aotChapterTwo.id,
      userId: userA.id,
      originalPrice: 30,
      paidPrice: 30,
      payableRate: '1.00',
      status: 2,
      paymentMethod: 1,
      outTradeNo: 'seed-purchase-aot-chapter-2',
      createdAt: addHours(SEED_TIMELINE.seedAt, -3),
      updatedAt: addHours(SEED_TIMELINE.seedAt, -3),
    },
    {
      targetType: 2,
      targetId: whiteNightChapterTwo.id,
      userId: userB.id,
      originalPrice: 25,
      paidPrice: 25,
      payableRate: '1.00',
      status: 2,
      paymentMethod: 1,
      outTradeNo: 'seed-purchase-byh-chapter-2',
      createdAt: addHours(SEED_TIMELINE.seedAt, -2),
      updatedAt: addHours(SEED_TIMELINE.seedAt, -2),
    },
  ] as const

  for (const purchaseFixture of purchaseFixtures) {
    const existingPurchase = await db.query.userPurchaseRecord.findFirst({
      where: and(
        eq(userPurchaseRecord.userId, purchaseFixture.userId),
        eq(userPurchaseRecord.targetType, purchaseFixture.targetType),
        eq(userPurchaseRecord.targetId, purchaseFixture.targetId),
        eq(userPurchaseRecord.status, purchaseFixture.status),
      ),
    })

    if (!existingPurchase) {
      await db.insert(userPurchaseRecord).values(purchaseFixture)
    } else {
      await db
        .update(userPurchaseRecord)
        .set(purchaseFixture)
        .where(eq(userPurchaseRecord.id, existingPurchase.id))
    }
  }
  console.log('  ✓ 购买记录完成')

  const browseFixtures = [
    {
      targetType: 1,
      targetId: aotWork.id,
      userId: userA.id,
      ipAddress: '127.0.0.31',
      device: 'ios',
      userAgent: 'seed-script/browse-work',
      viewedAt: addHours(SEED_TIMELINE.seedAt, -6),
    },
    {
      targetType: 3,
      targetId: aotChapterTwo.id,
      userId: userA.id,
      ipAddress: '127.0.0.31',
      device: 'ios',
      userAgent: 'seed-script/browse-chapter',
      viewedAt: addHours(SEED_TIMELINE.seedAt, -5),
    },
    {
      targetType: 5,
      targetId: aotTopic.id,
      userId: userB.id,
      ipAddress: '127.0.0.32',
      device: 'android',
      userAgent: 'seed-script/browse-topic',
      viewedAt: addHours(SEED_TIMELINE.seedAt, -4),
    },
  ] as const

  for (const browseFixture of browseFixtures) {
    const existingBrowse = await db.query.userBrowseLog.findFirst({
      where: and(
        eq(userBrowseLog.targetType, browseFixture.targetType),
        eq(userBrowseLog.targetId, browseFixture.targetId),
        eq(userBrowseLog.userId, browseFixture.userId),
      ),
    })

    if (!existingBrowse) {
      await db.insert(userBrowseLog).values(browseFixture)
    } else {
      await db
        .update(userBrowseLog)
        .set(browseFixture)
        .where(eq(userBrowseLog.id, existingBrowse.id))
    }
  }
  console.log('  ✓ 浏览记录完成')

  const reportFixture = {
    reporterId: userC.id,
    targetType: 4,
    targetId: forumRootComment.id,
    sceneType: 3,
    sceneId: aotTopic.id,
    commentLevel: 1,
    reasonType: 1,
    description: 'seed: 用于举报流程联调。',
    evidenceUrl: 'https://static.example.com/evidence/report-seed.png',
    status: 1,
  }

  const existingReport = await db.query.userReport.findFirst({
    where: and(
      eq(userReport.reporterId, reportFixture.reporterId),
      eq(userReport.targetType, reportFixture.targetType),
      eq(userReport.targetId, reportFixture.targetId),
    ),
  })

  if (!existingReport) {
    await db.insert(userReport).values(reportFixture)
  } else {
    await db
      .update(userReport)
      .set(reportFixture)
      .where(eq(userReport.id, existingReport.id))
  }
  console.log('  ✓ 举报记录完成')

  const readingFixtures = [
    {
      userId: userA.id,
      workId: aotWork.id,
      workType: 1,
      lastReadAt: addHours(SEED_TIMELINE.seedAt, -1),
      lastReadChapterId: aotChapterTwo.id,
    },
    {
      userId: userB.id,
      workId: whiteNightWork.id,
      workType: 2,
      lastReadAt: addHours(SEED_TIMELINE.seedAt, -2),
      lastReadChapterId: whiteNightChapterTwo.id,
    },
  ] as const

  for (const readingFixture of readingFixtures) {
    const existingState = await db.query.userWorkReadingState.findFirst({
      where: and(
        eq(userWorkReadingState.userId, readingFixture.userId),
        eq(userWorkReadingState.workId, readingFixture.workId),
      ),
    })

    if (!existingState) {
      await db.insert(userWorkReadingState).values(readingFixture)
    } else {
      await db
        .update(userWorkReadingState)
        .set(readingFixture)
        .where(
          and(
            eq(userWorkReadingState.userId, readingFixture.userId),
            eq(userWorkReadingState.workId, readingFixture.workId),
          ),
        )
    }
  }
  console.log('  ✓ 阅读状态完成')

  const badges = await db.query.userBadge.findMany()
  const badgeByName = new Map<string, (typeof badges)[number]>(
    badges.map((item) => [item.name, item]),
  )
  const badgeAssignments = [
    { userId: userA.id, badgeName: '新手启程' },
    { userId: userB.id, badgeName: '讨论发起者' },
  ] as const

  for (const assignment of badgeAssignments) {
    const badge = badgeByName.get(assignment.badgeName)
    if (!badge) {
      continue
    }

    const existingAssignment = await db.query.userBadgeAssignment.findFirst({
      where: and(
        eq(userBadgeAssignment.userId, assignment.userId),
        eq(userBadgeAssignment.badgeId, badge.id),
      ),
    })

    if (!existingAssignment) {
      await db.insert(userBadgeAssignment).values({
        userId: assignment.userId,
        badgeId: badge.id,
      })
    }
  }
  console.log('  ✓ 徽章发放完成')

  const [pointPurchaseRule] = await db
    .select()
    .from(growthRewardRule)
    .where(
      and(
        eq(growthRewardRule.type, 302),
        eq(growthRewardRule.assetType, GrowthAssetTypeEnum.POINTS),
      ),
    )
    .limit(1)
  const [experienceTopicRule] = await db
    .select()
    .from(growthRewardRule)
    .where(
      and(
        eq(growthRewardRule.type, 1),
        eq(growthRewardRule.assetType, GrowthAssetTypeEnum.EXPERIENCE),
      ),
    )
    .limit(1)

  const ledgerFixtures = [
    {
      userId: userA.id,
      assetType: GrowthAssetTypeEnum.POINTS,
      delta: -30,
      beforeValue: 120,
      afterValue: 90,
      bizKey: 'purchase:seed:aot:chapter-2',
      source: 'purchase',
      ruleType: 302,
      ruleId: pointPurchaseRule?.id ?? null,
      targetType: 2,
      targetId: aotChapterTwo.id,
      remark: 'seed: 漫画章节购买扣点',
      context: { source: 'seed', target: 'aot-chapter-2' },
    },
    {
      userId: userA.id,
      assetType: GrowthAssetTypeEnum.EXPERIENCE,
      delta: 20,
      beforeValue: 260,
      afterValue: 280,
      bizKey: 'topic:create:seed:aot',
      source: 'growth_rule',
      ruleType: 1,
      ruleId: experienceTopicRule?.id ?? null,
      targetType: 5,
      targetId: aotTopic.id,
      remark: 'seed: 发帖经验奖励',
      context: { source: 'seed', target: 'forum-topic' },
    },
  ] as const

  for (const ledgerFixture of ledgerFixtures) {
    const existingLedger = await db.query.growthLedgerRecord.findFirst({
      where: and(
        eq(growthLedgerRecord.userId, ledgerFixture.userId),
        eq(growthLedgerRecord.bizKey, ledgerFixture.bizKey),
      ),
    })

    if (!existingLedger) {
      await db.insert(growthLedgerRecord).values(ledgerFixture)
    } else {
      await db
        .update(growthLedgerRecord)
        .set(ledgerFixture)
        .where(eq(growthLedgerRecord.id, existingLedger.id))
    }
  }

  const auditFixtures = [
    {
      userId: userA.id,
      requestId: 'seed-request-purchase',
      bizKey: 'purchase:seed:aot:chapter-2',
      assetType: GrowthAssetTypeEnum.POINTS,
      action: GrowthLedgerActionEnum.CONSUME,
      ruleType: 302,
      decision: GrowthAuditDecisionEnum.ALLOW,
      reason: null,
      deltaRequested: -30,
      deltaApplied: -30,
      context: { source: 'seed', targetType: 'comic_chapter' },
    },
    {
      userId: userA.id,
      requestId: 'seed-request-topic',
      bizKey: 'topic:create:seed:aot',
      assetType: GrowthAssetTypeEnum.EXPERIENCE,
      action: GrowthLedgerActionEnum.GRANT,
      ruleType: 1,
      decision: GrowthAuditDecisionEnum.ALLOW,
      reason: null,
      deltaRequested: 20,
      deltaApplied: 20,
      context: { source: 'seed', targetType: 'forum_topic' },
    },
  ] as const

  for (const auditFixture of auditFixtures) {
    const existingAudit = await db.query.growthAuditLog.findFirst({
      where: and(
        eq(growthAuditLog.userId, auditFixture.userId),
        eq(growthAuditLog.bizKey, auditFixture.bizKey),
      ),
    })

    if (!existingAudit) {
      await db.insert(growthAuditLog).values(auditFixture)
    } else {
      await db
        .update(growthAuditLog)
        .set(auditFixture)
        .where(eq(growthAuditLog.id, existingAudit.id))
    }
  }

  const slotFixtures = [
    {
      userId: userA.id,
      assetType: GrowthAssetTypeEnum.POINTS,
      assetKey: '',
      ruleKey: 'points:302',
      scopeType: GrowthRuleUsageSlotTypeEnum.TOTAL,
      scopeKey: 'purchase:seed:aot:chapter-2',
      usedCount: 1,
    },
    {
      userId: userA.id,
      assetType: GrowthAssetTypeEnum.EXPERIENCE,
      assetKey: '',
      ruleKey: 'experience:1',
      scopeType: GrowthRuleUsageSlotTypeEnum.DAILY,
      scopeKey: '2026-03-19',
      usedCount: 1,
    },
  ] as const

  for (const slotFixture of slotFixtures) {
    const existingSlot = await db.query.growthRuleUsageCounter.findFirst({
      where: and(
        eq(growthRuleUsageCounter.userId, slotFixture.userId),
        eq(growthRuleUsageCounter.assetType, slotFixture.assetType),
        eq(growthRuleUsageCounter.assetKey, slotFixture.assetKey),
        eq(growthRuleUsageCounter.ruleKey, slotFixture.ruleKey),
        eq(growthRuleUsageCounter.scopeType, slotFixture.scopeType),
        eq(growthRuleUsageCounter.scopeKey, slotFixture.scopeKey),
      ),
    })

    if (!existingSlot) {
      await db.insert(growthRuleUsageCounter).values(slotFixture)
    }
  }
  console.log('  ✓ 成长流水完成')

  const readChapterTask = await db.query.taskDefinition.findFirst({
    where: eq(taskDefinition.code, 'daily_read_chapter'),
  })
  const forumTask = await db.query.taskDefinition.findFirst({
    where: eq(taskDefinition.code, 'daily_forum_interaction'),
  })

  if (readChapterTask) {
    const assignmentPayload = {
      taskId: readChapterTask.id,
      userId: userA.id,
      cycleKey: '20260320',
      status: 2,
      rewardApplicable: 1,
      rewardSettlementId: null,
      snapshotPayload: {
        code: readChapterTask.code,
        title: readChapterTask.title,
      },
      context: { source: 'seed', chapterId: aotChapterTwo.id },
      version: 1,
      claimedAt: addHours(SEED_TIMELINE.seedAt, -3),
      completedAt: addHours(SEED_TIMELINE.seedAt, -2),
      expiredAt: null,
    }

    const existingAssignment = await db.query.taskInstance.findFirst({
      where: and(
        eq(taskInstance.taskId, readChapterTask.id),
        eq(taskInstance.userId, userA.id),
        eq(taskInstance.cycleKey, '20260320'),
      ),
    })

    let currentAssignment = existingAssignment
    if (!currentAssignment) {
      ;[currentAssignment] = await db
        .insert(taskInstance)
        .values(assignmentPayload)
        .returning()
    } else {
      ;[currentAssignment] = await db
        .update(taskInstance)
        .set(assignmentPayload)
        .where(eq(taskInstance.id, currentAssignment.id))
        .returning()
    }

    const [readChapterStep] = await db
      .select()
      .from(taskStep)
      .where(eq(taskStep.taskId, readChapterTask.id))
      .limit(1)

    if (readChapterStep) {
      const existingStep = await db.query.taskInstanceStep.findFirst({
        where: and(
          eq(taskInstanceStep.instanceId, currentAssignment.id),
          eq(taskInstanceStep.stepId, readChapterStep.id),
        ),
      })
      const stepPayload = {
        instanceId: currentAssignment.id,
        stepId: readChapterStep.id,
        status: 2,
        currentValue: 1,
        targetValue: 1,
        completedAt: addHours(SEED_TIMELINE.seedAt, -2),
        context: { chapterId: aotChapterTwo.id },
        version: 1,
      }
      if (!existingStep) {
        await db.insert(taskInstanceStep).values(stepPayload)
      } else {
        await db
          .update(taskInstanceStep)
          .set(stepPayload)
          .where(eq(taskInstanceStep.id, existingStep.id))
      }
    }

    const progressLogs = [
      {
        taskId: readChapterTask.id,
        stepId: readChapterStep?.id ?? null,
        instanceId: currentAssignment.id,
        instanceStepId: currentAssignment.id,
        userId: userA.id,
        actionType: 1,
        progressSource: 1,
        accepted: true,
        delta: 0,
        beforeValue: 0,
        afterValue: 0,
        targetType: null,
        targetId: null,
        dimensionKey: null,
        dimensionValue: null,
        occurredAt: addHours(SEED_TIMELINE.seedAt, -3),
        context: { source: 'seed' },
      },
      {
        taskId: readChapterTask.id,
        stepId: readChapterStep?.id ?? null,
        instanceId: currentAssignment.id,
        instanceStepId: currentAssignment.id,
        userId: userA.id,
        eventCode: 300,
        eventBizKey: 'seed:read:daily_read_chapter:userA:20260320',
        actionType: 2,
        progressSource: 2,
        accepted: true,
        delta: 1,
        beforeValue: 0,
        afterValue: 1,
        targetType: 'comic_chapter',
        targetId: aotChapterTwo.id,
        dimensionKey: null,
        dimensionValue: null,
        occurredAt: addHours(SEED_TIMELINE.seedAt, -2),
        context: { chapterId: aotChapterTwo.id },
      },
      {
        assignmentId: currentAssignment.id,
        userId: userA.id,
        actionType: 3,
        delta: 0,
        beforeValue: 1,
        afterValue: 1,
        context: { reward: { points: 5, experience: 12 } },
      },
    ] as const

    for (const progressLog of progressLogs) {
      const existingLog = await db.query.taskEventLog.findFirst({
        where: and(
          eq(taskEventLog.instanceId, progressLog.instanceId),
          eq(taskEventLog.actionType, progressLog.actionType),
          eq(taskEventLog.afterValue, progressLog.afterValue),
        ),
      })

      if (!existingLog) {
        await db.insert(taskEventLog).values(progressLog)
      }
    }
  }

  if (forumTask) {
    const existingAssignment = await db.query.taskInstance.findFirst({
      where: and(
        eq(taskInstance.taskId, forumTask.id),
        eq(taskInstance.userId, userB.id),
        eq(taskInstance.cycleKey, '20260320'),
      ),
    })

    const forumAssignmentPayload = {
      taskId: forumTask.id,
      userId: userB.id,
      cycleKey: '20260320',
      status: 2,
      rewardApplicable: 1,
      rewardSettlementId: null,
      snapshotPayload: { code: forumTask.code, title: forumTask.title },
      context: { source: 'seed', topicId: whiteNightTopic.id },
      version: 1,
      claimedAt: addHours(SEED_TIMELINE.seedAt, -1),
      completedAt: null,
      expiredAt: null,
    }

    let currentAssignment = existingAssignment
    if (!currentAssignment) {
      ;[currentAssignment] = await db
        .insert(taskInstance)
        .values(forumAssignmentPayload)
        .returning()
    } else {
      ;[currentAssignment] = await db
        .update(taskInstance)
        .set(forumAssignmentPayload)
        .where(eq(taskInstance.id, currentAssignment.id))
        .returning()
    }

    const [forumStep] = await db
      .select()
      .from(taskStep)
      .where(eq(taskStep.taskId, forumTask.id))
      .limit(1)

    if (forumStep) {
      const existingStep = await db.query.taskInstanceStep.findFirst({
        where: and(
          eq(taskInstanceStep.instanceId, currentAssignment.id),
          eq(taskInstanceStep.stepId, forumStep.id),
        ),
      })
      const stepPayload = {
        instanceId: currentAssignment.id,
        stepId: forumStep.id,
        status: 0,
        currentValue: 0,
        targetValue: 1,
        completedAt: null,
        context: { topicId: whiteNightTopic.id },
        version: 1,
      }
      if (!existingStep) {
        await db.insert(taskInstanceStep).values(stepPayload)
      } else {
        await db
          .update(taskInstanceStep)
          .set(stepPayload)
          .where(eq(taskInstanceStep.id, existingStep.id))
      }
    }

    const existingClaimLog = await db.query.taskEventLog.findFirst({
      where: and(
        eq(taskEventLog.instanceId, currentAssignment.id),
        eq(taskEventLog.actionType, 1),
      ),
    })

    if (!existingClaimLog) {
      await db.insert(taskEventLog).values({
        taskId: forumTask.id,
        stepId: forumStep?.id ?? null,
        instanceId: currentAssignment.id,
        instanceStepId: currentAssignment.id,
        userId: userB.id,
        actionType: 1,
        progressSource: 1,
        accepted: true,
        delta: 0,
        beforeValue: 0,
        afterValue: 0,
        targetType: null,
        targetId: null,
        dimensionKey: null,
        dimensionValue: null,
        occurredAt: addHours(SEED_TIMELINE.seedAt, -1),
        context: { source: 'seed' },
      })
    }
  }
  console.log('  ✓ 任务执行记录完成')

  const touchedTopics = [aotTopic, whiteNightTopic]
  for (const topicItem of touchedTopics) {
    const topicComments = await db.query.userComment.findMany({
      where: and(
        eq(userComment.targetType, 3),
        eq(userComment.targetId, topicItem.id),
        isNull(userComment.deletedAt),
      ),
    })
    const latestComment = [...topicComments]
      .sort(
        (a, b) =>
          (a.createdAt?.getTime?.() ?? 0) - (b.createdAt?.getTime?.() ?? 0),
      )
      .at(-1)
    const topicLikes = await db.query.userLike.findMany({
      where: and(
        eq(userLike.targetType, 3),
        eq(userLike.targetId, topicItem.id),
      ),
    })
    const topicFavorites = await db.query.userFavorite.findMany({
      where: and(
        eq(userFavorite.targetType, 3),
        eq(userFavorite.targetId, topicItem.id),
      ),
    })

    await db
      .update(forumTopic)
      .set({
        commentCount: topicComments.length,
        likeCount: topicLikes.length,
        favoriteCount: topicFavorites.length,
        lastCommentUserId: latestComment?.userId ?? null,
        lastCommentAt: latestComment?.createdAt ?? topicItem.createdAt,
      })
      .where(eq(forumTopic.id, topicItem.id))
  }

  const touchedSectionIds = [
    aotTopic.sectionId,
    whiteNightTopic.sectionId,
  ].filter(
    (value, index, array): value is number =>
      Boolean(value) && array.indexOf(value) === index,
  )
  const touchedSections = touchedSectionIds.length
    ? await db.query.forumSection.findMany({
        where: inArray(forumSection.id, touchedSectionIds),
      })
    : []

  for (const section of touchedSections) {
    const sectionTopics = await db.query.forumTopic.findMany({
      where: and(
        eq(forumTopic.sectionId, section.id),
        isNull(forumTopic.deletedAt),
      ),
    })
    const lastTopic = [...sectionTopics]
      .sort((a, b) => {
        const left = a.lastCommentAt ?? a.createdAt
        const right = b.lastCommentAt ?? b.createdAt
        return (left?.getTime?.() ?? 0) - (right?.getTime?.() ?? 0)
      })
      .at(-1)

    await db
      .update(forumSection)
      .set({
        topicCount: sectionTopics.length,
        commentCount: sectionTopics.reduce(
          (sum, item) => sum + item.commentCount,
          0,
        ),
        lastTopicId: lastTopic?.id ?? null,
        lastPostAt:
          lastTopic?.lastCommentAt ??
          lastTopic?.createdAt ??
          section.lastPostAt,
      })
      .where(eq(forumSection.id, section.id))
  }
  console.log('  ✓ 论坛统计完成')

  const workTargets = [
    {
      row: aotWork,
      contentType: 1,
      likeTargetType: 1,
      favoriteTargetType: 1,
      browseTargetType: 1,
    },
    {
      row: whiteNightWork,
      contentType: 2,
      likeTargetType: 2,
      favoriteTargetType: 2,
      browseTargetType: 2,
    },
  ] as const

  for (const target of workTargets) {
    const likes = await db.query.userLike.findMany({
      where: and(
        eq(userLike.targetType, target.likeTargetType),
        eq(userLike.targetId, target.row.id),
      ),
    })
    const favorites = await db.query.userFavorite.findMany({
      where: and(
        eq(userFavorite.targetType, target.favoriteTargetType),
        eq(userFavorite.targetId, target.row.id),
      ),
    })
    const comments = await db.query.userComment.findMany({
      where: and(
        eq(userComment.targetType, target.contentType),
        eq(userComment.targetId, target.row.id),
        isNull(userComment.deletedAt),
      ),
    })
    const browseLogs = await db.query.userBrowseLog.findMany({
      where: and(
        eq(userBrowseLog.targetType, target.browseTargetType),
        eq(userBrowseLog.targetId, target.row.id),
      ),
    })
    const chapters = await db.query.workChapter.findMany({
      where: eq(workChapter.workId, target.row.id),
    })

    await db
      .update(work)
      .set({
        likeCount: likes.length,
        favoriteCount: favorites.length,
        commentCount: comments.length,
        viewCount: browseLogs.length,
        downloadCount: chapters.reduce(
          (sum, item) => sum + item.downloadCount,
          0,
        ),
      })
      .where(eq(work.id, target.row.id))
  }

  const chapterTargets = [
    {
      row: aotChapterTwo,
      commentTargetType: 2,
      likeTargetType: 2,
      browseTargetType: 3,
      downloadTargetType: 1,
      purchaseTargetType: 1,
    },
    {
      row: whiteNightChapterTwo,
      commentTargetType: 4,
      likeTargetType: 4,
      browseTargetType: 4,
      downloadTargetType: 2,
      purchaseTargetType: 2,
    },
  ] as const

  for (const target of chapterTargets) {
    const likes = await db.query.userLike.findMany({
      where: and(
        eq(userLike.targetType, target.likeTargetType),
        eq(userLike.targetId, target.row.id),
      ),
    })
    const comments = await db.query.userComment.findMany({
      where: and(
        eq(userComment.targetType, target.commentTargetType),
        eq(userComment.targetId, target.row.id),
        isNull(userComment.deletedAt),
      ),
    })
    const browseLogs = await db.query.userBrowseLog.findMany({
      where: and(
        eq(userBrowseLog.targetType, target.browseTargetType),
        eq(userBrowseLog.targetId, target.row.id),
      ),
    })
    const downloads = await db.query.userDownloadRecord.findMany({
      where: and(
        eq(userDownloadRecord.targetType, target.downloadTargetType),
        eq(userDownloadRecord.targetId, target.row.id),
      ),
    })
    const purchases = await db.query.userPurchaseRecord.findMany({
      where: and(
        eq(userPurchaseRecord.targetType, target.purchaseTargetType),
        eq(userPurchaseRecord.targetId, target.row.id),
        eq(userPurchaseRecord.status, 2),
      ),
    })

    await db
      .update(workChapter)
      .set({
        likeCount: likes.length,
        commentCount: comments.length,
        viewCount: browseLogs.length,
        downloadCount: downloads.length,
        purchaseCount: purchases.length,
      })
      .where(eq(workChapter.id, target.row.id))
  }
  console.log('  ✓ 作品统计完成')

  const appUsers = await db.query.appUser.findMany({
    where: inArray(appUser.id, [userA.id, userB.id, userC.id]),
  })

  for (const user of appUsers) {
    const comments = await db.query.userComment.findMany({
      where: and(
        eq(userComment.userId, user.id),
        isNull(userComment.deletedAt),
      ),
    })
    const likes = await db.query.userLike.findMany({
      where: eq(userLike.userId, user.id),
    })
    const favorites = await db.query.userFavorite.findMany({
      where: eq(userFavorite.userId, user.id),
    })
    const topics = await db.query.forumTopic.findMany({
      where: and(eq(forumTopic.userId, user.id), isNull(forumTopic.deletedAt)),
    })

    const commentIds = comments.map((item) => item.id)
    const topicIds = topics.map((item) => item.id)

    const commentReceivedLikes = commentIds.length
      ? await db.query.userLike.findMany({
          where: and(
            eq(userLike.targetType, 4),
            inArray(userLike.targetId, commentIds),
          ),
        })
      : []
    const topicReceivedLikes = topicIds.length
      ? await db.query.userLike.findMany({
          where: and(
            eq(userLike.targetType, 3),
            inArray(userLike.targetId, topicIds),
          ),
        })
      : []
    const topicReceivedFavorites = topicIds.length
      ? await db.query.userFavorite.findMany({
          where: and(
            eq(userFavorite.targetType, 3),
            inArray(userFavorite.targetId, topicIds),
          ),
        })
      : []

    const existingCount = await db.query.appUserCount.findFirst({
      where: eq(appUserCount.userId, user.id),
    })

    const countPayload = {
      userId: user.id,
      commentCount: comments.length,
      likeCount: likes.length,
      favoriteCount: favorites.length,
      forumTopicCount: topics.length,
      commentReceivedLikeCount: commentReceivedLikes.length,
      forumTopicReceivedLikeCount: topicReceivedLikes.length,
      forumTopicReceivedFavoriteCount: topicReceivedFavorites.length,
    }

    if (!existingCount) {
      await db.insert(appUserCount).values(countPayload)
    } else {
      await db
        .update(appUserCount)
        .set(countPayload)
        .where(eq(appUserCount.userId, user.id))
    }
  }
  console.log('  ✓ 用户统计完成')

  console.log('✅ 应用互动数据完成')
}
