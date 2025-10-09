/**
 * Prisma 数据库种子文件主入口
 *
 * 功能说明：
 * - 初始化数据库基础数据
 * - 按依赖关系分层执行种子数据
 * - 确保数据完整性和一致性
 *
 * 执行顺序：
 * 1. 基础数据（无依赖）
 * 2. 漫画基础数据
 * 3. 关联数据（依赖漫画和作者）
 * 4. 章节数据（依赖版本）
 * 5. 通知数据（依赖页面配置）
 */

import * as process from 'node:process'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../client/client'

// ==================== 用户管理模块 ====================
import { createInitialAdminAccount } from './modules/adminUser' // 管理员账户初始化

// ==================== 内容管理模块 ====================
import { createInitialAuthors } from './modules/author' // 作者信息管理
// ==================== 系统配置模块 ====================
import { createInitialClientConfig } from './modules/clientConfig' // 客户端全局配置
// ==================== 运营功能模块 ====================
import { createInitialClientNotice } from './modules/clientNotice' // 客户端通知公告
import { createInitialClientPageConfig } from './modules/clientPageConfig' // 页面访问配置
import { createInitialComics } from './modules/comic' // 漫画基础信息
import { createInitialDataDictionary } from './modules/dataDictionary' // 数据字典（语言、国籍、出版社等）

import { createInitialMediums } from './modules/medium' // 作品媒介类型
import { createInitialWorkCategory } from './modules/workCategory' // 作品分类管理
import { createInitialWorkComicChapters } from './modules/workComicChapter' // 漫画章节内容
import { createInitialWorkComicRelations } from './modules/workComicRelations' // 作品关联关系（作者-漫画-分类）

import { createInitialWorkComicVersions } from './modules/workComicVersion' // 漫画多语言版本

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
})
const prisma = new PrismaClient({ adapter })

/**
 * 执行数据库种子数据初始化
 *
 * 按照数据依赖关系分层执行，确保数据完整性：
 * 1. 第一层：基础数据（无依赖关系，可并行执行）
 * 2. 第二层：漫画基础数据（依赖作者和分类）
 * 3. 第三层：关联数据（依赖漫画基础数据）
 * 4. 第四层：章节数据（依赖版本数据）
 * 5. 第五层：通知数据（依赖页面配置）
 */
async function runSeeds() {
  await Promise.all([
    createInitialAdminAccount(prisma), // 用户管理：管理员账户
    createInitialDataDictionary(prisma), // 系统配置：数据字典
    createInitialMediums(prisma), // 内容管理：作品媒介类型（先于分类）
    createInitialWorkCategory(prisma), // 内容管理：作品分类
    createInitialAuthors(prisma), // 内容管理：作者信息
    createInitialClientConfig(prisma), // 系统配置：客户端配置
    createInitialClientPageConfig(prisma), // 系统配置：页面配置
  ])
  await createInitialComics(prisma) // 内容管理：漫画基础信息

  await Promise.all([
    createInitialWorkComicRelations(prisma), // 内容管理：作品关联关系
    createInitialWorkComicVersions(prisma), // 内容管理：多语言版本
  ])
  await createInitialWorkComicChapters(prisma) // 内容管理：漫画章节
  await createInitialClientNotice(prisma) // 运营功能：客户端通知
  console.log('🎉 所有种子数据初始化完成！')
}

runSeeds()
  .catch(() => {
    void process.exit(1)
  })
  .finally(() => void prisma.$disconnect())
