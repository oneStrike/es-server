export async function createInitialForumSensitiveWords(prisma: any) {
  const INITIAL_SENSITIVE_WORDS = [
    { word: '垃圾', type: 5, level: 2, matchMode: 1, isEnabled: true, replaceWord: '***', remark: '一般敏感词' },
    { word: '笨蛋', type: 5, level: 2, matchMode: 1, isEnabled: true, replaceWord: '***', remark: '一般敏感词' },
    { word: '白痴', type: 5, level: 2, matchMode: 1, isEnabled: true, replaceWord: '***', remark: '一般敏感词' },
    { word: '傻瓜', type: 5, level: 2, matchMode: 1, isEnabled: true, replaceWord: '***', remark: '一般敏感词' },
    { word: '混蛋', type: 5, level: 2, matchMode: 1, isEnabled: true, replaceWord: '***', remark: '一般敏感词' },
    { word: '废物', type: 5, level: 2, matchMode: 1, isEnabled: true, replaceWord: '***', remark: '一般敏感词' },
    { word: '脑残', type: 5, level: 2, matchMode: 1, isEnabled: true, replaceWord: '***', remark: '一般敏感词' },
    { word: '白眼', type: 5, level: 2, matchMode: 1, isEnabled: true, replaceWord: '***', remark: '一般敏感词' },
    { word: '弱智', type: 5, level: 2, matchMode: 1, isEnabled: true, replaceWord: '***', remark: '一般敏感词' },
    { word: '傻逼', type: 5, level: 1, matchMode: 1, isEnabled: true, replaceWord: '***', remark: '严重敏感词' },
    { word: '滚蛋', type: 5, level: 2, matchMode: 1, isEnabled: true, replaceWord: '***', remark: '一般敏感词' },
    { word: '该死', type: 5, level: 3, matchMode: 1, isEnabled: true, replaceWord: '***', remark: '轻微敏感词' },
  ]

  for (const wordData of INITIAL_SENSITIVE_WORDS) {
    const existingWord = await prisma.forumSensitiveWord.findFirst({
      where: { word: wordData.word },
    })

    if (!existingWord) {
      await prisma.forumSensitiveWord.create({
        data: wordData,
      })
    }
  }
}
