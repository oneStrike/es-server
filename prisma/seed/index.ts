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

  await Promise.all([
    createInitialAdminAccount(prisma),
    createInitialDataDictionary(prisma),
    createInitialWorkCategory(prisma),
    createInitialWorkTag(prisma),
    createInitialAppConfig(prisma),
    createInitialAppPage(prisma),
    createInitialForumConfig(prisma),
    createInitialForumSectionGroups(prisma),
    createInitialForumSections(prisma),
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

  await createInitialAuthors(prisma)
  await createInitialWorks(prisma)
  await createInitialWorkComics(prisma)
  await createInitialWorkNovels(prisma)

  console.log('✅ 核心业务数据初始化完成')

  await createInitialWorkAuthorRelations(prisma)
  await createInitialWorkCategoryRelations(prisma)
  await createInitialWorkTagRelations(prisma)
  await createInitialWorkChapters(prisma)
  await createInitialWorkComments(prisma)
  await createInitialAppAnnouncement(prisma)
  await createInitialAppUser(prisma)
  await createInitialForumProfile(prisma)

  console.log('✅ 核心业务数据初始化完成')

  // 初始化交互模块数据
  await createInitialInteractionData(prisma)

  console.log('🎉 所有种子数据初始化完成！')
}

runSeeds()
  .catch((error) => {
    console.log('🚀 ~ error:', error)
    void process.exit(1)
  })
  .finally(() => void prisma.$disconnect())
