import process from 'node:process'
import { prisma } from '@/prisma/prisma.connect'

// ==================== 用户管理模块 ====================
import { createInitialAdminAccount } from './modules/adminUser' // 管理员账户初始化

// ==================== 内容管理模块 ====================
import { createInitialAuthors } from './modules/author' // 作者信息管理
// ==================== 系统配置模块 ====================
// ==================== 运营功能模块 ====================
import { createInitialClientNotice } from './modules/clientNotice' // 客户端通知公告
import { createInitialClientPage } from './modules/clientPage' // 页面访问配置
import { createInitialComics } from './modules/comic' // 漫画基础信息
import { createInitialDataDictionary } from './modules/dataDictionary' // 数据字典（语言、国籍、出版社等）

import { createInitialMediums } from './modules/medium' // 作品媒介类型
import { seedWorkAuthorRoleType } from './modules/workAuthorRoleType' // 作者角色类型
import { createInitialWorkCategory } from './modules/workCategory' // 作品分类管理
import { createInitialWorkComicChapters } from './modules/workComicChapter' // 漫画章节内容
import { createInitialWorkComicRelations } from './modules/workComicRelations' // 作品关联关系（作者-漫画-分类）

import { createInitialWorkComicVersions } from './modules/workComicVersion' // 漫画多语言版本

/**
 * 执行数据库种子数据初始化
 */
async function runSeeds() {
  // 第一批：基础配置和枚举数据（必须先执行）
  await Promise.all([
    createInitialAdminAccount(prisma), // 用户管理：管理员账户
    createInitialDataDictionary(prisma), // 系统配置：数据字典
    createInitialMediums(prisma), // 内容管理：作品媒介类型（先于分类）
    createInitialWorkCategory(prisma), // 内容管理：作品分类
    seedWorkAuthorRoleType(prisma), // 内容管理：作者角色类型（必须在作者之前）
    createInitialClientPage(prisma), // 系统配置：页面配置
  ])

  // 第二批：依赖于第一批数据的业务数据
  await createInitialAuthors(prisma) // 内容管理：作者信息（依赖角色类型）
  await createInitialComics(prisma) // 内容管理：漫画基础信息

  // 第三批：关联关系和详细数据
  await Promise.all([
    createInitialWorkComicRelations(prisma), // 内容管理：作品关联关系
    createInitialWorkComicVersions(prisma), // 内容管理：多语言版本
  ])
  await createInitialWorkComicChapters(prisma) // 内容管理：漫画章节
  await createInitialClientNotice(prisma) // 运营功能：客户端通知
  console.log('🎉 所有种子数据初始化完成！')
}

runSeeds()
  .catch((error) => {
    console.log('🚀 ~ error:', error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
