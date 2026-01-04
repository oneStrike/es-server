import process from 'node:process'
import { makePrismaClient } from '@libs/base/database'
import { isProduction } from '@libs/base/utils'
import { DbConfig } from '../../config'

const connectUrl = isProduction()
  ? DbConfig.connection.url
  : 'postgresql://postgres:259158@localhost:5432/foo'
const prisma = makePrismaClient(connectUrl)

async function checkDataRelationships() {
  console.log('🔍 检查数据关联性...\n')

  const comics = await prisma.workComic.findMany({
    include: {
      comicAuthors: {
        include: {
          author: true,
        },
      },
      comicCategories: {
        include: {
          category: true,
        },
      },
      comicTags: {
        include: {
          tag: true,
        },
      },
    },
  })

  console.log(`📚 作品数量: ${comics.length}`)
  console.log('\n作品详细信息:')
  console.log('='.repeat(100))

  for (const comic of comics) {
    console.log(`\n📖 作品: ${comic.name}`)
    console.log(`   作者: ${comic.comicAuthors.map((ca: any) => ca.author.name).join(', ') || '无'}`)
    console.log(`   分类: ${comic.comicCategories.map((cc: any) => cc.category.name).join(', ') || '无'}`)
    console.log(`   标签: ${comic.comicTags.map((ct: any) => ct.tag.name).join(', ') || '无'}`)
    console.log(`   章节数: ${comic.chapterCount || 0}`)
    console.log(`   热度: ${comic.popularity}`)
  }

  console.log(`\n${'='.repeat(100)}`)
  console.log('\n📊 统计信息:')
  console.log(`   有作者的作品: ${comics.filter((c: any) => c.comicAuthors.length > 0).length}`)
  console.log(`   有分类的作品: ${comics.filter((c: any) => c.comicCategories.length > 0).length}`)
  console.log(`   有标签的作品: ${comics.filter((c: any) => c.comicTags.length > 0).length}`)
}

checkDataRelationships()
  .catch((error) => {
    console.error('🚀 ~ error:', error)
    void process.exit(1)
  })
  .finally(() => void prisma.$disconnect())
