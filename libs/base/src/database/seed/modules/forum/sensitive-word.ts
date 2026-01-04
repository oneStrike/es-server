export async function createInitialForumSensitiveWords(prisma: any) {
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
