import process from 'node:process'
import { createInitialAdminAccount } from './modules/admin'

import {
  createInitialAppAnnouncement,
  createInitialAppConfig,
  createInitialAppPage,
  createInitialAppUser,
} from './modules/app'
import {
  createInitialForumBadges,
  createInitialForumConfig,
  createInitialForumExperienceRules,
  createInitialForumLevelRules,
  createInitialForumPointRules,
  createInitialForumProfile,
  createInitialForumSectionGroups,
  createInitialForumSections,
  createInitialForumSensitiveWords,
  createInitialForumTags,
  createInitialForumTopics,
} from './modules/forum'
import {
  createInitialInteractionData,
  createInitialInteractionGrowthRules,
} from './modules/interaction'
import { createInitialDataDictionary } from './modules/system'
import {
  createInitialAuthors,
  createInitialWorkAuthorRelations,
  createInitialWorkCategory,
  createInitialWorkCategoryRelations,
  createInitialWorkChapters,
  createInitialWorkComics,
  createInitialWorkComments,
  createInitialWorkGrowthRules,
  createInitialWorkNovels,
  createInitialWorks,
  createInitialWorkTag,
  createInitialWorkTagRelations,
} from './modules/work'
import { getDatabaseUrl, makePrismaClient } from './prisma-client'

const connectUrl = getDatabaseUrl()
const prisma = makePrismaClient(connectUrl)

async function runSeeds() {
  console.log('🌱 开始初始化种子数据...')

  // ========== 第一阶段：基础配置数据（无依赖） ==========
  console.log('📦 第一阶段：基础配置数据')

  await Promise.all([
    createInitialAdminAccount(prisma),
    createInitialDataDictionary(prisma),
    createInitialWorkCategory(prisma),
    createInitialWorkTag(prisma),
    createInitialAppPage(prisma),
    createInitialForumConfig(prisma),
    createInitialForumSectionGroups(prisma),
    createInitialForumTags(prisma),
    createInitialForumBadges(prisma),
    createInitialForumPointRules(prisma),
    createInitialForumExperienceRules(prisma),
    createInitialForumLevelRules(prisma),
    createInitialForumSensitiveWords(prisma),
    createInitialWorkGrowthRules(prisma),
    createInitialInteractionGrowthRules(prisma),
  ])

  console.log('✅ 基础配置数据初始化完成')

  // ========== 第二阶段：业务基础数据 ==========
  console.log('📦 第二阶段：业务基础数据')

  // 论坛板块需要在作品之前创建（因为作品依赖论坛板块）
  await createInitialForumSections(prisma)
  await createInitialAuthors(prisma)

  console.log('✅ 业务基础数据初始化完成')

  // ========== 第三阶段：核心业务数据 ==========
  console.log('📦 第三阶段：核心业务数据')

  // 创建作品（会自动创建关联的论坛板块）
  await createInitialWorks(prisma)
  await createInitialWorkComics(prisma)
  await createInitialWorkNovels(prisma)

  console.log('✅ 核心业务数据初始化完成')

  // ========== 第四阶段：用户相关数据 ==========
  console.log('📦 第四阶段：用户相关数据')

  // 先创建用户，因为 appConfig 依赖用户
  await createInitialAppUser(prisma)
  await createInitialAppConfig(prisma)
  await createInitialAppAnnouncement(prisma)
  await createInitialForumProfile(prisma)

  console.log('✅ 用户相关数据初始化完成')

  // ========== 第五阶段：关联数据和内容数据 ==========
  console.log('📦 第五阶段：关联数据和内容数据')

  await createInitialWorkAuthorRelations(prisma)
  await createInitialWorkCategoryRelations(prisma)
  await createInitialWorkTagRelations(prisma)
  await createInitialWorkChapters(prisma)
  await createInitialWorkComments(prisma)
  await createInitialForumTopics(prisma)

  console.log('✅ 关联数据和内容数据初始化完成')

  // ========== 第六阶段：交互模块数据 ==========
  console.log('📦 第六阶段：交互模块数据')

  await createInitialInteractionData(prisma)

  console.log('🎉 所有种子数据初始化完成！')
}

runSeeds()
  .catch((error) => {
    console.log('🚀 ~ error:', error)
    void process.exit(1)
  })
  .finally(() => void prisma.$disconnect())
