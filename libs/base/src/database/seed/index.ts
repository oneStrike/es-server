import process from 'node:process'
import { makePrismaClient } from '@libs/base/database'
import { isProduction } from '@libs/base/utils'
import { DbConfig } from '../../config'

// ==================== 模块化种子数据导入 ====================
import { createInitialAdminAccount } from './modules/admin'
import {
  createInitialAppConfig,
  createInitialAppNotice,
  createInitialAppPage,
  createInitialClientUser,
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
import { createInitialMemberLevels } from './modules/operationManagement'
import { createInitialDataDictionary } from './modules/system'
import {
  createInitialAuthors,
  createInitialComicAuthors,
  createInitialComicCategories,
  createInitialComicChapters,
  createInitialComics,
  createInitialComicTags,
  createInitialWorkCategory,
  createInitialWorkTag,
} from './modules/work'

const connectUrl = isProduction()
  ? DbConfig.connection.url
  : 'postgresql://postgres:259158@localhost:5432/foo'
const prisma = makePrismaClient(connectUrl)
/**
 * 执行数据库种子数据初始化
 */
async function runSeeds() {
  console.log('🌱 开始初始化种子数据...')

  // 第一批：基础配置和枚举数据（必须先执行）
  await Promise.all([
    createInitialAdminAccount(prisma),
    createInitialDataDictionary(prisma),
    createInitialMemberLevels(prisma),
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
  ])

  console.log('✅ 基础配置数据初始化完成')

  // 第二批：依赖于第一批数据的业务数据
  await createInitialAuthors(prisma) // 作者信息
  await createInitialComics(prisma) // 漫画基础信息

  console.log('✅ 核心业务数据初始化完成')

  // 第三批：关联关系和详细数据
  await createInitialComicAuthors(prisma)
  await createInitialComicCategories(prisma)
  await createInitialComicTags(prisma)
  await createInitialComicChapters(prisma)
  await createInitialAppNotice(prisma)
  await createInitialClientUser(prisma)
  await createInitialForumProfile(prisma)

  console.log('🎉 所有种子数据初始化完成！')
}

runSeeds()
  .catch((error) => {
    console.log('🚀 ~ error:', error)
    void process.exit(1)
  })
  .finally(() => void prisma.$disconnect())
