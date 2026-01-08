import process from 'node:process'
import { makePrismaClient } from '@libs/base/database'
import { isProduction } from '@libs/base/utils'
import { DbConfig } from '../../config'

// ==================== 模块化种子数据导入 ====================
import { createInitialAdminAccount } from './modules/admin' // 管理员账户初始化
import {
  createInitialClientNotice,
  createInitialClientPage,
  createInitialClientUser,
} from './modules/client' // 客户端配置模块
import {
  createInitialForumBadges,
  createInitialForumLevelRules,
  createInitialForumPointRules,
  createInitialForumSectionGroups,
  createInitialForumSections,
  createInitialForumSensitiveWords,
  createInitialForumTags,
  createInitialForumProfile,
} from './modules/forum' // 论坛模块种子数据
import { createInitialMemberLevels } from './modules/operationManagement' // 会员等级管理
import { createInitialDataDictionary } from './modules/system' // 数据字典（语言、国籍、出版社等）
import {
  createInitialAuthors,
  createInitialComicAuthors,
  createInitialComicCategories,
  createInitialComicChapters,
  createInitialComics,
  createInitialComicTags,
  createInitialWorkCategory,
  createInitialWorkTag,
} from './modules/work' // 作品管理模块

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
    createInitialAdminAccount(prisma), // 管理员账户
    createInitialDataDictionary(prisma), // 数据字典
    createInitialMemberLevels(prisma), // 会员等级配置
    createInitialWorkCategory(prisma), // 作品分类
    createInitialWorkTag(prisma), // 作品标签
    createInitialClientPage(prisma), // 页面配置
    createInitialForumSectionGroups(prisma), // 论坛板块分组配置（必须在板块之前）
    createInitialForumSections(prisma), // 论坛板块配置
    createInitialForumTags(prisma), // 论坛标签配置
    createInitialForumBadges(prisma), // 论坛徽章配置
    createInitialForumPointRules(prisma), // 论坛积分规则
    createInitialForumLevelRules(prisma), // 论坛等级规则
    createInitialForumSensitiveWords(prisma), // 论坛敏感词配置
  ])

  console.log('✅ 基础配置数据初始化完成')

  // 第二批：依赖于第一批数据的业务数据
  await createInitialAuthors(prisma) // 作者信息
  await createInitialComics(prisma) // 漫画基础信息

  console.log('✅ 核心业务数据初始化完成')

  // 第三批：关联关系和详细数据
  await createInitialComicAuthors(prisma) // 漫画-作者关联
  await createInitialComicCategories(prisma) // 漫画-分类关联
  await createInitialComicTags(prisma) // 漫画-标签关联
  await createInitialComicChapters(prisma) // 漫画章节
  await createInitialClientNotice(prisma) // 客户端通知
  await createInitialClientUser(prisma) // 客户端用户
  await createInitialForumProfile(prisma) // 论坛用户资料

  console.log('🎉 所有种子数据初始化完成！')
}

runSeeds()
  .catch((error) => {
    console.log('🚀 ~ error:', error)
    void process.exit(1)
  })
  .finally(() => void prisma.$disconnect())
