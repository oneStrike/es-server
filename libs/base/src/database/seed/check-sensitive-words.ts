import process from 'node:process'
import { makePrismaClient } from '@libs/base/database'
import { isProduction } from '@libs/base/utils'
import { DbConfig } from '../../config'

const connectUrl = isProduction()
  ? DbConfig.connection.url
  : 'postgresql://postgres:259158@localhost:5432/foo'
const prisma = makePrismaClient(connectUrl)

async function checkSensitiveWords() {
  console.log('🔍 检查敏感词数据...\n')

  const words = await prisma.forumSensitiveWord.findMany()

  console.log(`当前数据库中的敏感词数量: ${words.length}`)
  console.log('\n敏感词列表:')
  words.forEach((word: any) => {
    console.log(`  - ${word.word} (${word.isEnabled ? '启用' : '禁用'})`)
  })
}

checkSensitiveWords()
  .catch((error) => {
    console.error('🚀 ~ error:', error)
    void process.exit(1)
  })
  .finally(() => void prisma.$disconnect())
