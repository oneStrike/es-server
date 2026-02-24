import process from 'node:process'
import { makePrismaClient } from '../../libs/base/src/database'
import { isProduction } from '../../libs/base/src/utils'
import { DbConfig } from '../../libs/base/src/config'

import { createInitialAdminAccount } from './modules/admin'
import {
  createInitialAppConfig,
  createInitialAppNotice,
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
import { createInitialDataDictionary } from './modules/system'
import {
  createInitialAuthors,
  createInitialWorkAuthorRelations,
  createInitialWorkCategory,
  createInitialWorkCategoryRelations,
  createInitialWorkChapters,
  createInitialWorkComments,
  createInitialWorkComics,
  createInitialWorkGrowthRules,
  createInitialWorkNovels,
  createInitialWorks,
  createInitialWorkTag,
  createInitialWorkTagRelations,
} from './modules/work'

const connectUrl = isProduction()
  ? DbConfig.connection.url
  : 'postgresql://postgres:259158@localhost:5432/foo'
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
  await createInitialAppNotice(prisma)
  await createInitialAppUser(prisma)
  await createInitialForumProfile(prisma)

  console.log('🎉 所有种子数据初始化完成！')
}

runSeeds()
  .catch((error) => {
    console.log('🚀 ~ error:', error)
    void process.exit(1)
  })
  .finally(() => void prisma.$disconnect())
