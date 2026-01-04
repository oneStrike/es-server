import process from 'node:process'
import { makePrismaClient } from '@libs/base/database'
import { isProduction } from '@libs/base/utils'
import { DbConfig } from '../../config'

const connectUrl = isProduction()
  ? DbConfig.connection.url
  : 'postgresql://postgres:259158@localhost:5432/foo'
const prisma = makePrismaClient(connectUrl)

async function deleteAndRecreateSensitiveWords() {
  console.log('🗑️ 删除所有敏感词数据...')

  await prisma.forumSensitiveWord.deleteMany({})

  console.log('✅ 敏感词数据已清空')

  console.log('\n📝 重新创建敏感词数据...')

  const INITIAL_SENSITIVE_WORDS = [
    { word: '垃圾', isEnabled: true },
    { word: '笨蛋', isEnabled: true },
    { word: '白痴', isEnabled: true },
    { word: '傻瓜', isEnabled: true },
    { word: '混蛋', isEnabled: true },
    { word: '废物', isEnabled: true },
    { word: '脑残', isEnabled: true },
    { word: '白眼', isEnabled: true },
    { word: '弱智', isEnabled: true },
    { word: '傻逼', isEnabled: true },
    { word: '滚蛋', isEnabled: true },
    { word: '该死', isEnabled: true },
  ]

  for (const wordData of INITIAL_SENSITIVE_WORDS) {
    await prisma.forumSensitiveWord.create({
      data: wordData,
    })
  }

  console.log(`✅ 已创建 ${INITIAL_SENSITIVE_WORDS.length} 个敏感词`)

  const count = await prisma.forumSensitiveWord.count()
  console.log(`\n📊 当前数据库中的敏感词数量: ${count}`)
}

deleteAndRecreateSensitiveWords()
  .catch((error) => {
    console.error('🚀 ~ error:', error)
    void process.exit(1)
  })
  .finally(() => void prisma.$disconnect())
