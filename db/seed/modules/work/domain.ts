import type { Db } from '../../db-client'
import {
  forumSection,
  work,
  workAuthor,
  workAuthorRelation,
  workCategory,
  workCategoryRelation,
  workChapter,
  workComic,
  workNovel,
  workTag,
  workTagRelation,
} from '@db/schema'
import { WorkSerialStatusEnum } from '@libs/content/work/core/work.constant'
import { and, eq } from 'drizzle-orm'
import {
  addHours,
  createAvatar,
  DICTIONARY_ITEMS,
  SEED_TIMELINE,
} from '../../shared'

const WORK_SECTION_GROUP_NAME = '作品讨论'
const ADVANCED_LEVEL_NAME = '活跃读者'

const CATEGORY_FIXTURES = [
  { name: '热血', description: '强调成长、对抗与热血冒险', icon: 'https://static.example.com/categories/hot-blood.svg', contentType: [1, 2], sortOrder: 1, popularity: 120 },
  { name: '奇幻', description: '包含奇幻设定、超自然规则与异世界元素', icon: 'https://static.example.com/categories/fantasy.svg', contentType: [1, 2], sortOrder: 2, popularity: 100 },
  { name: '悬疑', description: '强调谜题、推理与心理张力', icon: 'https://static.example.com/categories/mystery.svg', contentType: [1, 2], sortOrder: 3, popularity: 110 },
  { name: '情感', description: '关注人物关系与情绪表达', icon: 'https://static.example.com/categories/emotion.svg', contentType: [1, 2], sortOrder: 4, popularity: 90 },
  { name: '现实', description: '基于现实生活经验的内容主题', icon: 'https://static.example.com/categories/realism.svg', contentType: [2], sortOrder: 5, popularity: 80 },
  { name: '日常', description: '日常生活中的轻松故事', icon: 'https://static.example.com/categories/daily.svg', contentType: [1, 2], sortOrder: 6, popularity: 70 },
  { name: '搞笑', description: '以幽默和搞笑情节为主', icon: 'https://static.example.com/categories/comedy.svg', contentType: [1, 2], sortOrder: 7, popularity: 85 },
  { name: '冒险', description: '以探索和冒险旅程为核心', icon: 'https://static.example.com/categories/adventure.svg', contentType: [1, 2], sortOrder: 8, popularity: 95 },
  { name: '科幻', description: '包含科幻设定和未来世界观', icon: 'https://static.example.com/categories/scifi.svg', contentType: [1, 2], sortOrder: 9, popularity: 75 },
  { name: '治愈', description: '温暖治愈、让人放松的内容', icon: 'https://static.example.com/categories/healing.svg', contentType: [1, 2], sortOrder: 10, popularity: 65 },
] as const

const TAG_FIXTURES = [
  { name: '高热度', description: '站内高讨论度内容', icon: 'https://static.example.com/tags/hot.svg', sortOrder: 1, popularity: 150 },
  { name: '动画改编', description: '有动画化或影视化内容', icon: 'https://static.example.com/tags/adaptation.svg', sortOrder: 2, popularity: 120 },
  { name: '长篇连载', description: '篇幅较长、世界观展开丰富', icon: 'https://static.example.com/tags/long-run.svg', sortOrder: 3, popularity: 90 },
  { name: '口碑佳作', description: '评分稳定、口碑较高的内容', icon: 'https://static.example.com/tags/recommended.svg', sortOrder: 4, popularity: 130 },
  { name: '已完结', description: '作品已完结，可以放心追完', icon: 'https://static.example.com/tags/completed.svg', sortOrder: 5, popularity: 80 },
  { name: '新番推荐', description: '近期开始连载的新作品', icon: 'https://static.example.com/tags/new-season.svg', sortOrder: 6, popularity: 100 },
  { name: '经典必读', description: '公认的经典作品，入坑必读', icon: 'https://static.example.com/tags/classic.svg', sortOrder: 7, popularity: 140 },
  { name: '冷门佳作', description: '讨论度不高但质量出色的作品', icon: 'https://static.example.com/tags/hidden-gem.svg', sortOrder: 8, popularity: 60 },
] as const

const AUTHOR_FIXTURES = [
  { name: '谏山创', avatar: createAvatar('isayama-hajime'), description: '以强叙事推进和压迫感见长的漫画作者。', nationality: DICTIONARY_ITEMS.nationality.jp, gender: 1, type: [1], isRecommended: true },
  { name: '吾峠呼世晴', avatar: createAvatar('gotouge-koyoharu'), description: '以情绪表达和角色羁绊著称的漫画作者。', nationality: DICTIONARY_ITEMS.nationality.jp, gender: 2, type: [1], isRecommended: true },
  { name: '芥见下下', avatar: createAvatar('gege-akutami'), description: '咒术回战作者，以战斗设计和世界观构建见长。', nationality: DICTIONARY_ITEMS.nationality.jp, gender: 1, type: [1], isRecommended: true },
  { name: '藤本树', avatar: createAvatar('fujimoto-tatsuki'), description: '链锯人作者，以不按常理出牌的叙事风格闻名。', nationality: DICTIONARY_ITEMS.nationality.jp, gender: 1, type: [1], isRecommended: true },
  { name: '山田鐘人', avatar: createAvatar('yamada-kanehito'), description: '葬送的芙莉莲作者，以细腻的情感描写和世界观设定著称。', nationality: DICTIONARY_ITEMS.nationality.jp, gender: 1, type: [1], isRecommended: true },
  { name: '远藤达哉', avatar: createAvatar('endo-tatsuya'), description: '间谍过家家作者，擅长轻松幽默的家庭喜剧。', nationality: DICTIONARY_ITEMS.nationality.jp, gender: 1, type: [1], isRecommended: true },
  { name: '堀越耕平', avatar: createAvatar('horikoshi-kohei'), description: '我的英雄学院作者，以超英雄题材和角色成长线见长。', nationality: DICTIONARY_ITEMS.nationality.jp, gender: 1, type: [1], isRecommended: true },
  { name: '尾田荣一郎', avatar: createAvatar('oda-eiichiro'), description: '海贼王作者，以宏大世界观和长篇叙事能力闻名。', nationality: DICTIONARY_ITEMS.nationality.jp, gender: 1, type: [1], isRecommended: true },
  { name: '岸本齐史', avatar: createAvatar('kishimoto-masashi'), description: '火影忍者作者，以忍者世界设定和角色羁绊著称。', nationality: DICTIONARY_ITEMS.nationality.jp, gender: 1, type: [1], isRecommended: false },
  { name: '久保带人', avatar: createAvatar('kubo-tite'), description: '死神作者，以独特的美学风格和战斗设计见长。', nationality: DICTIONARY_ITEMS.nationality.jp, gender: 1, type: [1], isRecommended: false },
  { name: '荒川弘', avatar: createAvatar('arakawa-hiromu'), description: '钢之炼金术师作者，以严谨的设定和哲学主题闻名。', nationality: DICTIONARY_ITEMS.nationality.jp, gender: 2, type: [1], isRecommended: true },
  { name: '空知英秋', avatar: createAvatar('sorachi-hideaki'), description: '银魂作者，以搞笑与正经并行独特的风格著称。', nationality: DICTIONARY_ITEMS.nationality.jp, gender: 1, type: [1], isRecommended: false },
  { name: '古馆春一', avatar: createAvatar('furudate-haruichi'), description: '排球少年作者，以群像描写和比赛节奏感见长。', nationality: DICTIONARY_ITEMS.nationality.jp, gender: 1, type: [1], isRecommended: true },
  { name: 'natsu', avatar: createAvatar('natsu-yamada'), description: '药师少女的独语作者，以悬疑推理和独特主角设定著称。', nationality: DICTIONARY_ITEMS.nationality.jp, gender: 2, type: [1], isRecommended: false },
  { name: '赤坂茜', avatar: createAvatar('akasaka-aka'), description: '我推是作者，以娱乐圈题材和反转叙事闻名。', nationality: DICTIONARY_ITEMS.nationality.jp, gender: 1, type: [1], isRecommended: true },
  { name: '村上春树', avatar: createAvatar('murakami-haruki'), description: '以现代都市情绪与个人记忆叙事闻名的作者。', nationality: DICTIONARY_ITEMS.nationality.jp, gender: 1, type: [2], isRecommended: true },
  { name: '东野圭吾', avatar: createAvatar('keigo-higashino'), description: '以推理结构与人物命运并重见长的小说作者。', nationality: DICTIONARY_ITEMS.nationality.jp, gender: 1, type: [2], isRecommended: true },
] as const

const WORK_FIXTURES = [
  {
    key: 'aot', name: '进击的巨人', alias: 'Attack on Titan,進撃の巨人', type: 1,
    cover: 'https://static.example.com/works/aot/cover.jpg',
    description: '围墙、人类与巨人的冲突被一点点翻开，设定和人物弧线都极具层次。',
    language: DICTIONARY_ITEMS.workLanguage.ja, region: DICTIONARY_ITEMS.workRegion.jp, ageRating: DICTIONARY_ITEMS.workAgeRating.r15,
    serialStatus: WorkSerialStatusEnum.COMPLETED, publisher: DICTIONARY_ITEMS.workPublisher.kodansha,
    originalSource: 'official-license', copyright: '© 諫山創・講談社', disclaimer: '本作品由平台授权发布，版权归原作方所有。',
    isPublished: true, isRecommended: true, isHot: true, isNew: false, publishAt: '2026-04-21',
    lastUpdated: addHours(SEED_TIMELINE.releaseDay, 1), viewRule: 1, requiredViewLevelName: null,
    chapterPrice: 30, canComment: true, recommendWeight: 9.6, popularity: 9800, rating: 9.3,
    categories: ['热血', '悬疑'], tags: ['高热度', '已完结', '经典必读'], authors: ['谏山创'],
    chapters: [
      { title: '第1话 致两千年后的你', subtitle: '开篇', sortOrder: 1, isPreview: true, isPublished: true, viewRule: 1, price: 0, content: '艾伦第一次意识到墙外世界与巨人的威胁。', wordCount: 1200 },
      { title: '第2话 那一天', subtitle: '风暴来袭', sortOrder: 2, isPreview: false, isPublished: true, viewRule: 3, price: 30, content: '城墙被破坏之后，角色命运开始转向。', wordCount: 1300 },
    ],
  },
  {
    key: 'demon-slayer', name: '鬼灭之刃', alias: 'Demon Slayer,鬼滅の刃', type: 1,
    cover: 'https://static.example.com/works/demon-slayer/cover.jpg',
    description: '以家庭羁绊和成长为核心，兼具强烈动作感和情绪张力。',
    language: DICTIONARY_ITEMS.workLanguage.ja, region: DICTIONARY_ITEMS.workRegion.jp, ageRating: DICTIONARY_ITEMS.workAgeRating.r15,
    serialStatus: WorkSerialStatusEnum.COMPLETED, publisher: DICTIONARY_ITEMS.workPublisher.shueisha,
    originalSource: 'official-license', copyright: '© 吾峠呼世晴・集英社', disclaimer: '本作品由平台授权发布，版权归原作方所有。',
    isPublished: true, isRecommended: true, isHot: true, isNew: false, publishAt: '2026-04-21',
    lastUpdated: addHours(SEED_TIMELINE.releaseDay, 2), viewRule: 1, requiredViewLevelName: null,
    chapterPrice: 28, canComment: true, recommendWeight: 9.2, popularity: 9600, rating: 9.1,
    categories: ['热血', '奇幻'], tags: ['高热度', '动画改编', '已完结'], authors: ['吾峠呼世晴'],
    chapters: [
      { title: '第1话 残酷', subtitle: '雪夜', sortOrder: 1, isPreview: true, isPublished: true, viewRule: 1, price: 0, content: '炭治郎平静的生活被突如其来的惨剧打破。', wordCount: 1100 },
      { title: '第2话 培育师', subtitle: '启程', sortOrder: 2, isPreview: false, isPublished: true, viewRule: 3, price: 28, content: '鬼杀队修行真正开始，目标逐步明确。', wordCount: 1180 },
    ],
  },
  {
    key: 'jjk', name: '咒术回战', alias: 'Jujutsu Kaisen,呪術廻戦', type: 1,
    cover: 'https://static.example.com/works/jjk/cover.jpg',
    description: '咒力与术式的对战系统设计出色，角色群像鲜明。',
    language: DICTIONARY_ITEMS.workLanguage.ja, region: DICTIONARY_ITEMS.workRegion.jp, ageRating: DICTIONARY_ITEMS.workAgeRating.r15,
    serialStatus: WorkSerialStatusEnum.SERIALIZING, publisher: DICTIONARY_ITEMS.workPublisher.shueisha,
    originalSource: 'official-license', copyright: '© 芥見下々・集英社', disclaimer: '本作品由平台授权发布，版权归原作方所有。',
    isPublished: true, isRecommended: true, isHot: true, isNew: false, publishAt: '2026-04-21',
    lastUpdated: addHours(SEED_TIMELINE.releaseDay, 3), viewRule: 1, requiredViewLevelName: null,
    chapterPrice: 30, canComment: true, recommendWeight: 9.0, popularity: 9200, rating: 8.9,
    categories: ['热血', '奇幻'], tags: ['高热度', '动画改编', '长篇连载'], authors: ['芥见下下'],
    chapters: [
      { title: '第1话 宿虎', subtitle: '两面宿傩', sortOrder: 1, isPreview: true, isPublished: true, viewRule: 1, price: 0, content: '虎杖吞下咒物，两面宿傩的力量开始觉醒。', wordCount: 1200 },
      { title: '第2话 咒术高专', subtitle: '入学', sortOrder: 2, isPreview: false, isPublished: true, viewRule: 3, price: 30, content: '虎杖进入咒术高专，正式开始咒术师修行。', wordCount: 1250 },
    ],
  },
  {
    key: 'chainsaw-man', name: '链锯人', alias: 'Chainsaw Man,チェンソーマン', type: 1,
    cover: 'https://static.example.com/works/csm/cover.jpg',
    description: '恶魔与人类的边界模糊，叙事风格大胆且不按常理出牌。',
    language: DICTIONARY_ITEMS.workLanguage.ja, region: DICTIONARY_ITEMS.workRegion.jp, ageRating: DICTIONARY_ITEMS.workAgeRating.r18,
    serialStatus: WorkSerialStatusEnum.SERIALIZING, publisher: DICTIONARY_ITEMS.workPublisher.shueisha,
    originalSource: 'official-license', copyright: '© 藤本タツキ・集英社', disclaimer: '本作品由平台授权发布，版权归原作方所有。',
    isPublished: true, isRecommended: true, isHot: true, isNew: true, publishAt: '2026-05-01',
    lastUpdated: addHours(SEED_TIMELINE.releaseDay, 4), viewRule: 1, requiredViewLevelName: null,
    chapterPrice: 32, canComment: true, recommendWeight: 8.8, popularity: 8900, rating: 8.7,
    categories: ['热血', '奇幻'], tags: ['高热度', '动画改编', '新番推荐'], authors: ['藤本树'],
    chapters: [
      { title: '第1话 狗与链锯', subtitle: '相遇', sortOrder: 1, isPreview: true, isPublished: true, viewRule: 1, price: 0, content: '电次与波奇塔的相遇改变了命运。', wordCount: 1000 },
      { title: '第2话 出发', subtitle: '公安', sortOrder: 2, isPreview: false, isPublished: true, viewRule: 3, price: 32, content: '电次加入公安对恶魔猎人，新生活开始。', wordCount: 1100 },
    ],
  },
  {
    key: 'frieren', name: '葬送的芙莉莲', alias: 'Frieren: Beyond Journey\'s End,葬送のフリーレン', type: 1,
    cover: 'https://static.example.com/works/frieren/cover.jpg',
    description: '勇者归来后的故事，以时间跨度感悟生命的珍贵。',
    language: DICTIONARY_ITEMS.workLanguage.ja, region: DICTIONARY_ITEMS.workRegion.jp, ageRating: DICTIONARY_ITEMS.workAgeRating.all,
    serialStatus: WorkSerialStatusEnum.SERIALIZING, publisher: DICTIONARY_ITEMS.workPublisher.kodansha,
    originalSource: 'official-license', copyright: '© 山田鐘人・アベツカサ・講談社', disclaimer: '本作品由平台授权发布，版权归原作方所有。',
    isPublished: true, isRecommended: true, isHot: true, isNew: true, publishAt: '2026-04-28',
    lastUpdated: addHours(SEED_TIMELINE.releaseDay, 5), viewRule: 1, requiredViewLevelName: null,
    chapterPrice: 25, canComment: true, recommendWeight: 9.4, popularity: 9100, rating: 9.2,
    categories: ['奇幻', '治愈'], tags: ['高热度', '动画改编', '口碑佳作'], authors: ['山田鐘人'],
    chapters: [
      { title: '第1话 旅行的开始', subtitle: '精灵的旅程', sortOrder: 1, isPreview: true, isPublished: true, viewRule: 1, price: 0, content: '芙莉莲踏上了解人类的旅途。', wordCount: 1300 },
      { title: '第2话 魔族', subtitle: '再会', sortOrder: 2, isPreview: false, isPublished: true, viewRule: 3, price: 25, content: '旅途中遭遇魔族，过去的记忆涌现。', wordCount: 1400 },
    ],
  },
  {
    key: 'spy-family', name: '间谍过家家', alias: 'Spy x Family,SPY×FAMILY', type: 1,
    cover: 'https://static.example.com/works/spy-family/cover.jpg',
    description: '间谍、杀手和超能力少女组成了虚假家庭，笑料与温情并存。',
    language: DICTIONARY_ITEMS.workLanguage.ja, region: DICTIONARY_ITEMS.workRegion.jp, ageRating: DICTIONARY_ITEMS.workAgeRating.all,
    serialStatus: WorkSerialStatusEnum.SERIALIZING, publisher: DICTIONARY_ITEMS.workPublisher.shueisha,
    originalSource: 'official-license', copyright: '© 遠藤達哉・集英社', disclaimer: '本作品由平台授权发布，版权归原作方所有。',
    isPublished: true, isRecommended: true, isHot: true, isNew: false, publishAt: '2026-04-21',
    lastUpdated: addHours(SEED_TIMELINE.releaseDay, 6), viewRule: 1, requiredViewLevelName: null,
    chapterPrice: 20, canComment: true, recommendWeight: 8.6, popularity: 8800, rating: 8.5,
    categories: ['搞笑', '日常'], tags: ['高热度', '动画改编', '长篇连载'], authors: ['远藤达哉'],
    chapters: [
      { title: '第1话 任务开始', subtitle: '伪装家族', sortOrder: 1, isPreview: true, isPublished: true, viewRule: 1, price: 0, content: '黄昏接到了组建家庭的任务。', wordCount: 1000 },
      { title: '第2话 入学面试', subtitle: '星赏', sortOrder: 2, isPreview: false, isPublished: true, viewRule: 3, price: 20, content: '为了阿尼亚的入学面试，一家人开始准备。', wordCount: 1100 },
    ],
  },
  {
    key: 'mha', name: '我的英雄学院', alias: 'My Hero Academia,僕のヒーローアカデミア', type: 1,
    cover: 'https://static.example.com/works/mha/cover.jpg',
    description: '超英雄题材的王道作品，角色成长线丰富。',
    language: DICTIONARY_ITEMS.workLanguage.ja, region: DICTIONARY_ITEMS.workRegion.jp, ageRating: DICTIONARY_ITEMS.workAgeRating.r15,
    serialStatus: WorkSerialStatusEnum.SERIALIZING, publisher: DICTIONARY_ITEMS.workPublisher.shueisha,
    originalSource: 'official-license', copyright: '© 堀越耕平・集英社', disclaimer: '本作品由平台授权发布，版权归原作方所有。',
    isPublished: true, isRecommended: true, isHot: false, isNew: false, publishAt: '2026-04-21',
    lastUpdated: addHours(SEED_TIMELINE.releaseDay, 7), viewRule: 1, requiredViewLevelName: null,
    chapterPrice: 26, canComment: true, recommendWeight: 8.4, popularity: 8500, rating: 8.3,
    categories: ['热血', '冒险'], tags: ['动画改编', '长篇连载'], authors: ['堀越耕平'],
    chapters: [
      { title: '第1话 绿谷出久', subtitle: '无个性', sortOrder: 1, isPreview: true, isPublished: true, viewRule: 1, price: 0, content: '没有个性的少年梦想成为英雄。', wordCount: 1100 },
      { title: '第2话 个性继承', subtitle: 'One for All', sortOrder: 2, isPreview: false, isPublished: true, viewRule: 3, price: 26, content: '欧尔麦特将个性托付给出久。', wordCount: 1200 },
    ],
  },
  {
    key: 'one-piece', name: '海贼王', alias: 'One Piece,ONE PIECE', type: 1,
    cover: 'https://static.example.com/works/op/cover.jpg',
    description: '以宏大的世界观和长篇叙事能力闻名，冒险与友情贯穿始终。',
    language: DICTIONARY_ITEMS.workLanguage.ja, region: DICTIONARY_ITEMS.workRegion.jp, ageRating: DICTIONARY_ITEMS.workAgeRating.r15,
    serialStatus: WorkSerialStatusEnum.SERIALIZING, publisher: DICTIONARY_ITEMS.workPublisher.shueisha,
    originalSource: 'official-license', copyright: '© 尾田栄一郎・集英社', disclaimer: '本作品由平台授权发布，版权归原作方所有。',
    isPublished: true, isRecommended: true, isHot: true, isNew: false, publishAt: '2026-04-21',
    lastUpdated: addHours(SEED_TIMELINE.releaseDay, 8), viewRule: 1, requiredViewLevelName: null,
    chapterPrice: 25, canComment: true, recommendWeight: 9.8, popularity: 9900, rating: 9.5,
    categories: ['热血', '冒险', '奇幻'], tags: ['高热度', '动画改编', '经典必读', '长篇连载'], authors: ['尾田荣一郎'],
    chapters: [
      { title: '第1话 冒险的黎明', subtitle: '大海贼时代', sortOrder: 1, isPreview: true, isPublished: true, viewRule: 1, price: 0, content: '路飞出海，大海贼时代正式开启。', wordCount: 1300 },
      { title: '第2话 索隆', subtitle: '剑客', sortOrder: 2, isPreview: false, isPublished: true, viewRule: 3, price: 25, content: '路飞邀请索隆加入，第一位伙伴登场。', wordCount: 1400 },
    ],
  },
  {
    key: 'naruto', name: '火影忍者', alias: 'Naruto,NARUTO -ナルト-', type: 1,
    cover: 'https://static.example.com/works/naruto/cover.jpg',
    description: '忍者世界的物语，以角色羁绊和成长为核心。',
    language: DICTIONARY_ITEMS.workLanguage.ja, region: DICTIONARY_ITEMS.workRegion.jp, ageRating: DICTIONARY_ITEMS.workAgeRating.r15,
    serialStatus: WorkSerialStatusEnum.COMPLETED, publisher: DICTIONARY_ITEMS.workPublisher.shueisha,
    originalSource: 'official-license', copyright: '© 岸本斉史・集英社', disclaimer: '本作品由平台授权发布，版权归原作方所有。',
    isPublished: true, isRecommended: false, isHot: false, isNew: false, publishAt: '2026-04-21',
    lastUpdated: addHours(SEED_TIMELINE.releaseDay, 9), viewRule: 1, requiredViewLevelName: null,
    chapterPrice: 22, canComment: true, recommendWeight: 8.2, popularity: 8200, rating: 8.1,
    categories: ['热血', '冒险'], tags: ['已完结', '经典必读'], authors: ['岸本齐史'],
    chapters: [
      { title: '第1话 旋涡鸣人', subtitle: '忍者学校', sortOrder: 1, isPreview: true, isPublished: true, viewRule: 1, price: 0, content: '鸣人梦想成为火影。', wordCount: 1100 },
      { title: '第2话 佐助', subtitle: '宿敌', sortOrder: 2, isPreview: false, isPublished: true, viewRule: 3, price: 22, content: '第七班结成，鸣人与佐助的羁绊开始。', wordCount: 1200 },
    ],
  },
  {
    key: 'bleach', name: '死神', alias: 'Bleach,BLEACH', type: 1,
    cover: 'https://static.example.com/works/bleach/cover.jpg',
    description: '以独特美学风格和战斗设计见长的灵异动作作品。',
    language: DICTIONARY_ITEMS.workLanguage.ja, region: DICTIONARY_ITEMS.workRegion.jp, ageRating: DICTIONARY_ITEMS.workAgeRating.r15,
    serialStatus: WorkSerialStatusEnum.COMPLETED, publisher: DICTIONARY_ITEMS.workPublisher.shueisha,
    originalSource: 'official-license', copyright: '© 久保帯人・集英社', disclaimer: '本作品由平台授权发布，版权归原作方所有。',
    isPublished: true, isRecommended: false, isHot: false, isNew: false, publishAt: '2026-04-21',
    lastUpdated: addHours(SEED_TIMELINE.releaseDay, 10), viewRule: 1, requiredViewLevelName: null,
    chapterPrice: 22, canComment: true, recommendWeight: 7.8, popularity: 7800, rating: 7.9,
    categories: ['热血', '奇幻'], tags: ['已完结', '经典必读'], authors: ['久保带人'],
    chapters: [
      { title: '第1话 死神代行', subtitle: '相遇', sortOrder: 1, isPreview: true, isPublished: true, viewRule: 1, price: 0, content: '一护遇见露琪亚，获得死神之力。', wordCount: 1000 },
      { title: '第2话 尸魂界', subtitle: '潜入', sortOrder: 2, isPreview: false, isPublished: true, viewRule: 3, price: 22, content: '为救露琪亚，一护等人潜入尸魂界。', wordCount: 1200 },
    ],
  },
  {
    key: 'fma', name: '钢之炼金术师', alias: 'Fullmetal Alchemist,鋼の錬金術師', type: 1,
    cover: 'https://static.example.com/works/fma/cover.jpg',
    description: '以等价交换为哲学核心，设定严谨、人物弧线完整。',
    language: DICTIONARY_ITEMS.workLanguage.ja, region: DICTIONARY_ITEMS.workRegion.jp, ageRating: DICTIONARY_ITEMS.workAgeRating.r15,
    serialStatus: WorkSerialStatusEnum.COMPLETED, publisher: DICTIONARY_ITEMS.workPublisher.squareEnix,
    originalSource: 'official-license', copyright: '© 荒川弘・スクウェア・エニックス', disclaimer: '本作品由平台授权发布，版权归原作方所有。',
    isPublished: true, isRecommended: true, isHot: false, isNew: false, publishAt: '2026-04-21',
    lastUpdated: addHours(SEED_TIMELINE.releaseDay, 11), viewRule: 1, requiredViewLevelName: null,
    chapterPrice: 25, canComment: true, recommendWeight: 9.2, popularity: 8700, rating: 9.1,
    categories: ['热血', '冒险', '奇幻'], tags: ['已完结', '经典必读', '口碑佳作'], authors: ['荒川弘'],
    chapters: [
      { title: '第1话 炼金术师', subtitle: '兄弟之旅', sortOrder: 1, isPreview: true, isPublished: true, viewRule: 1, price: 0, content: '艾尔林克兄弟踏上寻找贤者之石的旅途。', wordCount: 1200 },
      { title: '第2话 等价交换', subtitle: '代价', sortOrder: 2, isPreview: false, isPublished: true, viewRule: 3, price: 25, content: '炼金的代价与兄弟的决意交织。', wordCount: 1300 },
    ],
  },
  {
    key: 'gintama', name: '银魂', alias: 'Gintama,銀魂', type: 1,
    cover: 'https://static.example.com/works/gintama/cover.jpg',
    description: '搞笑与正经并行，以独特风格著称的时代剧。',
    language: DICTIONARY_ITEMS.workLanguage.ja, region: DICTIONARY_ITEMS.workRegion.jp, ageRating: DICTIONARY_ITEMS.workAgeRating.r15,
    serialStatus: WorkSerialStatusEnum.COMPLETED, publisher: DICTIONARY_ITEMS.workPublisher.shueisha,
    originalSource: 'official-license', copyright: '© 空知英秋・集英社', disclaimer: '本作品由平台授权发布，版权归原作方所有。',
    isPublished: true, isRecommended: false, isHot: false, isNew: false, publishAt: '2026-04-21',
    lastUpdated: addHours(SEED_TIMELINE.releaseDay, 12), viewRule: 1, requiredViewLevelName: null,
    chapterPrice: 20, canComment: true, recommendWeight: 8.0, popularity: 7900, rating: 8.2,
    categories: ['搞笑', '日常'], tags: ['已完结', '冷门佳作'], authors: ['空知英秋'],
    chapters: [
      { title: '第1话 万事屋', subtitle: '开张', sortOrder: 1, isPreview: true, isPublished: true, viewRule: 1, price: 0, content: '银时经营万事屋的故事开始。', wordCount: 1000 },
      { title: '第2话 真选组', subtitle: '相遇', sortOrder: 2, isPreview: false, isPublished: true, viewRule: 3, price: 20, content: '与真选组的碰撞拉开日常的帷幕。', wordCount: 1100 },
    ],
  },
  {
    key: 'haikyuu', name: '排球少年', alias: 'Haikyu!!,ハイキュー!!', type: 1,
    cover: 'https://static.example.com/works/haikyuu/cover.jpg',
    description: '以群像描写和比赛节奏感见长的体育作品。',
    language: DICTIONARY_ITEMS.workLanguage.ja, region: DICTIONARY_ITEMS.workRegion.jp, ageRating: DICTIONARY_ITEMS.workAgeRating.all,
    serialStatus: WorkSerialStatusEnum.COMPLETED, publisher: DICTIONARY_ITEMS.workPublisher.shueisha,
    originalSource: 'official-license', copyright: '© 古舘春一・集英社', disclaimer: '本作品由平台授权发布，版权归原作方所有。',
    isPublished: true, isRecommended: true, isHot: false, isNew: false, publishAt: '2026-04-21',
    lastUpdated: addHours(SEED_TIMELINE.releaseDay, 13), viewRule: 1, requiredViewLevelName: null,
    chapterPrice: 22, canComment: true, recommendWeight: 8.6, popularity: 8300, rating: 8.7,
    categories: ['热血', '日常'], tags: ['已完结', '口碑佳作', '动画改编'], authors: ['古馆春一'],
    chapters: [
      { title: '第1话 影日', subtitle: '矮个子', sortOrder: 1, isPreview: true, isPublished: true, viewRule: 1, price: 0, content: '日向翔阳立志成为排球选手。', wordCount: 1100 },
      { title: '第2话 乌野', subtitle: '入部', sortOrder: 2, isPreview: false, isPublished: true, viewRule: 3, price: 22, content: '加入乌野高中排球部，新的挑战开始。', wordCount: 1200 },
    ],
  },
  {
    key: 'kusuriya', name: '药师少女的独语', alias: 'The Apothecary Diaries,薬屋のひとりごと', type: 1,
    cover: 'https://static.example.com/works/kusuriya/cover.jpg',
    description: '以悬疑推理和独特主角设定著称的后宫推理作品。',
    language: DICTIONARY_ITEMS.workLanguage.ja, region: DICTIONARY_ITEMS.workRegion.jp, ageRating: DICTIONARY_ITEMS.workAgeRating.r15,
    serialStatus: WorkSerialStatusEnum.SERIALIZING, publisher: DICTIONARY_ITEMS.workPublisher.squareEnix,
    originalSource: 'official-license', copyright: '© natsu・スクウェア・エニックス', disclaimer: '本作品由平台授权发布，版权归原作方所有。',
    isPublished: true, isRecommended: false, isHot: false, isNew: true, publishAt: '2026-05-15',
    lastUpdated: addHours(SEED_TIMELINE.releaseDay, 14), viewRule: 1, requiredViewLevelName: null,
    chapterPrice: 24, canComment: true, recommendWeight: 8.4, popularity: 7600, rating: 8.5,
    categories: ['悬疑', '日常'], tags: ['新番推荐', '动画改编'], authors: ['natsu'],
    chapters: [
      { title: '第1话 猫猫', subtitle: '宫女', sortOrder: 1, isPreview: true, isPublished: true, viewRule: 1, price: 0, content: '猫猫在后宫作为宫女工作。', wordCount: 1200 },
      { title: '第2话 毒药', subtitle: '推理', sortOrder: 2, isPreview: false, isPublished: true, viewRule: 3, price: 24, content: '猫猫运用药学知识开始调查。', wordCount: 1300 },
    ],
  },
  {
    key: 'oshi-no-ko', name: '我推是', alias: 'Oshi no Ko,【推しの子】', type: 1,
    cover: 'https://static.example.com/works/oshi-no-ko/cover.jpg',
    description: '娱乐圈题材与反转叙事结合，揭示业界暗面。',
    language: DICTIONARY_ITEMS.workLanguage.ja, region: DICTIONARY_ITEMS.workRegion.jp, ageRating: DICTIONARY_ITEMS.workAgeRating.r15,
    serialStatus: WorkSerialStatusEnum.SERIALIZING, publisher: DICTIONARY_ITEMS.workPublisher.shueisha,
    originalSource: 'official-license', copyright: '© 赤坂アカ・集英社', disclaimer: '本作品由平台授权发布，版权归原作方所有。',
    isPublished: true, isRecommended: true, isHot: true, isNew: true, publishAt: '2026-05-10',
    lastUpdated: addHours(SEED_TIMELINE.releaseDay, 15), viewRule: 1, requiredViewLevelName: null,
    chapterPrice: 26, canComment: true, recommendWeight: 8.8, popularity: 8400, rating: 8.6,
    categories: ['悬疑', '现实'], tags: ['高热度', '新番推荐', '动画改编'], authors: ['赤坂茜'],
    chapters: [
      { title: '第1话 推的孩子', subtitle: '转生', sortOrder: 1, isPreview: true, isPublished: true, viewRule: 1, price: 0, content: '双胞胎转生为推的孩子，新的故事开始。', wordCount: 1100 },
      { title: '第2话 娱乐圈', subtitle: '修行', sortOrder: 2, isPreview: false, isPublished: true, viewRule: 3, price: 26, content: '在娱乐圈中追寻真相。', wordCount: 1200 },
    ],
  },
  {
    key: 'norwegian-wood', name: '挪威的森林', alias: 'Norwegian Wood,ノルウェイの森', type: 2,
    cover: 'https://static.example.com/works/norwegian-wood/cover.jpg',
    description: '通过回忆与现实交错的方式展开人物关系与青春伤痕。',
    language: DICTIONARY_ITEMS.workLanguage.ja, region: DICTIONARY_ITEMS.workRegion.jp, ageRating: DICTIONARY_ITEMS.workAgeRating.r18,
    serialStatus: WorkSerialStatusEnum.COMPLETED, publisher: DICTIONARY_ITEMS.workPublisher.shinchosha,
    originalSource: 'official-license', copyright: '© 村上春樹・新潮社', disclaimer: '本作品由平台授权发布，版权归原作方所有。',
    isPublished: true, isRecommended: true, isHot: false, isNew: false, publishAt: '2026-04-21',
    lastUpdated: addHours(SEED_TIMELINE.releaseDay, 16), viewRule: 2, requiredViewLevelName: ADVANCED_LEVEL_NAME,
    chapterPrice: 22, canComment: true, recommendWeight: 8.8, popularity: 8600, rating: 8.8,
    categories: ['情感', '现实'], tags: ['口碑佳作', '经典必读'], authors: ['村上春树'],
    chapters: [
      { title: '第一章 飞行中的旋律', subtitle: '回忆的入口', sortOrder: 1, isPreview: true, isPublished: true, viewRule: 1, price: 0, content: '飞机上的旋律把渡边拉回旧日东京。', wordCount: 2100 },
      { title: '第二章 直子的来信', subtitle: '迟到的回答', sortOrder: 2, isPreview: false, isPublished: true, viewRule: 3, price: 22, content: '通过信件，人物之间未说出口的情绪被拉近。', wordCount: 2600 },
    ],
  },
  {
    key: 'midnight-sun', name: '白夜行', alias: 'Journey Under the Midnight Sun,白夜行', type: 2,
    cover: 'https://static.example.com/works/byh/cover.jpg',
    description: '以案件脉络牵引人物命运，层层推进秘密与关系变化。',
    language: DICTIONARY_ITEMS.workLanguage.ja, region: DICTIONARY_ITEMS.workRegion.jp, ageRating: DICTIONARY_ITEMS.workAgeRating.r15,
    serialStatus: WorkSerialStatusEnum.COMPLETED, publisher: DICTIONARY_ITEMS.workPublisher.shueisha,
    originalSource: 'official-license', copyright: '© 東野圭吾・集英社', disclaimer: '本作品由平台授权发布，版权归原作方所有。',
    isPublished: true, isRecommended: true, isHot: true, isNew: false, publishAt: '2026-04-21',
    lastUpdated: addHours(SEED_TIMELINE.releaseDay, 17), viewRule: 2, requiredViewLevelName: ADVANCED_LEVEL_NAME,
    chapterPrice: 25, canComment: true, recommendWeight: 9.4, popularity: 9400, rating: 9.4,
    categories: ['悬疑', '现实'], tags: ['高热度', '口碑佳作', '经典必读'], authors: ['东野圭吾'],
    chapters: [
      { title: '第一章 案发之后', subtitle: '沉默的开端', sortOrder: 1, isPreview: true, isPublished: true, viewRule: 1, price: 0, content: '围绕旧案展开，人与案件都显得并不简单。', wordCount: 2400 },
      { title: '第二章 双线并进', subtitle: '更深的关系', sortOrder: 2, isPreview: false, isPublished: true, viewRule: 3, price: 25, content: '人物成长和悬疑线并行推进，信息量明显提升。', wordCount: 2800 },
    ],
  },
  {
    key: 'namiya', name: '解忧杂货店', alias: 'The Miracles of the Namiya General Store,ナミヤ雑貨店の奇蹟', type: 2,
    cover: 'https://static.example.com/works/namiya/cover.jpg',
    description: '通过一间神奇杂货店串联起跨越时空的温暖故事。',
    language: DICTIONARY_ITEMS.workLanguage.ja, region: DICTIONARY_ITEMS.workRegion.jp, ageRating: DICTIONARY_ITEMS.workAgeRating.all,
    serialStatus: WorkSerialStatusEnum.COMPLETED, publisher: DICTIONARY_ITEMS.workPublisher.kadokawa,
    originalSource: 'official-license', copyright: '© 東野圭吾・KADOKAWA', disclaimer: '本作品由平台授权发布，版权归原作方所有。',
    isPublished: true, isRecommended: true, isHot: false, isNew: false, publishAt: '2026-04-21',
    lastUpdated: addHours(SEED_TIMELINE.releaseDay, 18), viewRule: 1, requiredViewLevelName: null,
    chapterPrice: 20, canComment: true, recommendWeight: 8.6, popularity: 8100, rating: 8.5,
    categories: ['情感', '现实'], tags: ['口碑佳作', '已完结'], authors: ['东野圭吾'],
    chapters: [
      { title: '第一章 回信', subtitle: '烦恼咨询', sortOrder: 1, isPreview: true, isPublished: true, viewRule: 1, price: 0, content: '三个小偷误入一间杂货店，开始收到奇怪的信。', wordCount: 2200 },
      { title: '第二章 月兔', subtitle: '梦想与现实', sortOrder: 2, isPreview: false, isPublished: true, viewRule: 3, price: 20, content: '月兔的信揭示了追梦与放弃之间的挣扎。', wordCount: 2500 },
    ],
  },
  {
    key: 'kafka-on-shore', name: '海边的卡夫卡', alias: 'Kafka on the Shore,海辺のカフカ', type: 2,
    cover: 'https://static.example.com/works/kafka/cover.jpg',
    description: '少年离家出走与老人寻猫两条线交织，充满隐喻与梦境。',
    language: DICTIONARY_ITEMS.workLanguage.ja, region: DICTIONARY_ITEMS.workRegion.jp, ageRating: DICTIONARY_ITEMS.workAgeRating.r15,
    serialStatus: WorkSerialStatusEnum.COMPLETED, publisher: DICTIONARY_ITEMS.workPublisher.shinchosha,
    originalSource: 'official-license', copyright: '© 村上春樹・新潮社', disclaimer: '本作品由平台授权发布，版权归原作方所有。',
    isPublished: true, isRecommended: true, isHot: false, isNew: false, publishAt: '2026-04-21',
    lastUpdated: addHours(SEED_TIMELINE.releaseDay, 19), viewRule: 2, requiredViewLevelName: ADVANCED_LEVEL_NAME,
    chapterPrice: 24, canComment: true, recommendWeight: 8.4, popularity: 7900, rating: 8.3,
    categories: ['情感', '奇幻'], tags: ['口碑佳作', '冷门佳作'], authors: ['村上春树'],
    chapters: [
      { title: '第一章 离家', subtitle: '十五岁', sortOrder: 1, isPreview: true, isPublished: true, viewRule: 1, price: 0, content: '十五岁的卡夫卡决定离家出走。', wordCount: 2300 },
      { title: '第二章 入口石', subtitle: '梦境', sortOrder: 2, isPreview: false, isPublished: true, viewRule: 3, price: 24, content: '梦境与现实的边界逐渐模糊。', wordCount: 2700 },
    ],
  },
] as const

export async function seedWorkDomain(db: Db) {
  console.log('🌱 初始化作品域数据...')

  for (const categoryFixture of CATEGORY_FIXTURES) {
    const existing = await db.query.workCategory.findFirst({
      where: { name: categoryFixture.name },
      columns: {
        id: true,
      },
    })

    if (!existing) {
      await db.insert(workCategory).values({
        ...categoryFixture,
        contentType: [...categoryFixture.contentType],
        isEnabled: true,
      })
    } else {
      await db
        .update(workCategory)
        .set({
          ...categoryFixture,
          contentType: [...categoryFixture.contentType],
          isEnabled: true,
        })
        .where(eq(workCategory.id, existing.id))
    }
  }
  console.log('  ✓ 作品分类完成')

  for (const tagFixture of TAG_FIXTURES) {
    const existing = await db.query.workTag.findFirst({
      where: { name: tagFixture.name },
      columns: {
        id: true,
      },
    })

    if (!existing) {
      await db.insert(workTag).values({
        ...tagFixture,
        isEnabled: true,
      })
    } else {
      await db
        .update(workTag)
        .set({
          ...tagFixture,
          isEnabled: true,
        })
        .where(eq(workTag.id, existing.id))
    }
  }
  console.log('  ✓ 作品标签完成')

  for (const authorFixture of AUTHOR_FIXTURES) {
    const existing = await db.query.workAuthor.findFirst({
      where: { name: authorFixture.name },
      columns: {
        id: true,
      },
    })

    if (!existing) {
      await db.insert(workAuthor).values({
        ...authorFixture,
        type: [...authorFixture.type],
        isEnabled: true,
        remark: '初始化作者资料',
      })
    } else {
      await db
        .update(workAuthor)
        .set({
          ...authorFixture,
          type: [...authorFixture.type],
          isEnabled: true,
          remark: '初始化作者资料',
        })
        .where(eq(workAuthor.id, existing.id))
    }
  }
  console.log('  ✓ 作者完成')

  const workSectionGroup = await db.query.forumSectionGroup.findFirst({
    where: {
      AND: [{ name: WORK_SECTION_GROUP_NAME }, { deletedAt: { isNull: true } }],
    },
    columns: {
      id: true,
    },
  })
  const advancedLevel = await db.query.userLevelRule.findFirst({
    where: { name: ADVANCED_LEVEL_NAME },
    columns: {
      id: true,
    },
  })

  for (const [index, workFixture] of WORK_FIXTURES.entries()) {
    let section = await db.query.forumSection.findFirst({
      where: {
        AND: [{ name: workFixture.name }, { deletedAt: { isNull: true } }],
      },
      columns: {
        id: true,
        topicCount: true,
        commentCount: true,
        lastPostAt: true,
        lastTopicId: true,
      },
    })

    const sectionPayload = {
      groupId: workSectionGroup?.id ?? null,
      userLevelRuleId: null,
      name: workFixture.name,
      description: `${workFixture.name} 作品专属讨论板块`,
      icon: workFixture.cover,
      cover: workFixture.cover,
      sortOrder: index + 1,
      isEnabled: true,
      topicReviewPolicy: 1,
      remark: '初始化作品绑定论坛板块',
      topicCount: section?.topicCount ?? 0,
      commentCount: section?.commentCount ?? 0,
      lastPostAt: section?.lastPostAt ?? null,
      lastTopicId: section?.lastTopicId ?? null,
    }

    if (!section) {
      ;[section] = await db
        .insert(forumSection)
        .values(sectionPayload)
        .returning()
    } else {
      ;[section] = await db
        .update(forumSection)
        .set(sectionPayload)
        .where(eq(forumSection.id, section.id))
        .returning()
    }

    const existingWork = await db.query.work.findFirst({
      where: { AND: [{ name: workFixture.name }, { type: workFixture.type }] },
      columns: {
        id: true,
        name: true,
        viewCount: true,
        favoriteCount: true,
        likeCount: true,
        commentCount: true,
        downloadCount: true,
      },
    })

    const requiredLevelId =
      workFixture.requiredViewLevelName === ADVANCED_LEVEL_NAME
        ? (advancedLevel?.id ?? null)
        : null

    let currentWork = existingWork
    const workPayload = {
      type: workFixture.type,
      name: workFixture.name,
      alias: workFixture.alias,
      cover: workFixture.cover,
      description: workFixture.description,
      language: workFixture.language,
      region: workFixture.region,
      ageRating: workFixture.ageRating,
      serialStatus: workFixture.serialStatus,
      publisher: workFixture.publisher,
      originalSource: workFixture.originalSource,
      copyright: workFixture.copyright,
      disclaimer: workFixture.disclaimer,
      remark: '初始化作品基础信息',
      isPublished: workFixture.isPublished,
      isRecommended: workFixture.isRecommended,
      isHot: workFixture.isHot,
      isNew: workFixture.isNew,
      publishAt: workFixture.publishAt,
      lastUpdated: workFixture.lastUpdated,
      viewRule: workFixture.viewRule,
      requiredViewLevelId: requiredLevelId,
      forumSectionId: section.id,
      chapterPrice: workFixture.chapterPrice,
      canComment: workFixture.canComment,
      recommendWeight: workFixture.recommendWeight,
      viewCount: currentWork?.viewCount ?? 0,
      favoriteCount: currentWork?.favoriteCount ?? 0,
      likeCount: currentWork?.likeCount ?? 0,
      commentCount: currentWork?.commentCount ?? 0,
      downloadCount: currentWork?.downloadCount ?? 0,
      rating: workFixture.rating,
      popularity: workFixture.popularity,
    }

    if (!currentWork) {
      ;[currentWork] = await db.insert(work).values(workPayload).returning()
      console.log(`  ✓ 作品创建: ${currentWork.name}`)
    } else {
      ;[currentWork] = await db
        .update(work)
        .set(workPayload)
        .where(eq(work.id, currentWork.id))
        .returning()
      console.log(`  ↺ 作品更新: ${currentWork.name}`)
    }

    if (workFixture.type === 1) {
      const existingComic = await db.query.workComic.findFirst({
        where: { workId: currentWork.id },
        columns: {
          id: true,
        },
      })

      if (!existingComic) {
        await db.insert(workComic).values({ workId: currentWork.id })
      } else {
        await db
          .update(workComic)
          .set({ workId: currentWork.id })
          .where(eq(workComic.id, existingComic.id))
      }
    } else {
      const totalWordCount = workFixture.chapters.reduce(
        (sum, chapter) => sum + chapter.wordCount,
        0,
      )
      const existingNovel = await db.query.workNovel.findFirst({
        where: { workId: currentWork.id },
        columns: {
          id: true,
        },
      })

      if (!existingNovel) {
        await db.insert(workNovel).values({
          workId: currentWork.id,
          wordCount: totalWordCount,
        })
      } else {
        await db
          .update(workNovel)
          .set({
            workId: currentWork.id,
            wordCount: totalWordCount,
          })
          .where(eq(workNovel.id, existingNovel.id))
      }
    }

    for (const [
      chapterIndex,
      chapterFixture,
    ] of workFixture.chapters.entries()) {
      const publishAt = addHours(
        SEED_TIMELINE.releaseDay,
        index * 6 + chapterIndex,
      )
      const existingChapter = await db.query.workChapter.findFirst({
        where: {
          AND: [
            { workId: currentWork.id },
            { sortOrder: chapterFixture.sortOrder },
          ],
        },
        columns: {
          id: true,
          viewCount: true,
          likeCount: true,
          commentCount: true,
          purchaseCount: true,
          downloadCount: true,
        },
      })

      const chapterPayload = {
        workId: currentWork.id,
        workType: workFixture.type,
        title: chapterFixture.title,
        subtitle: chapterFixture.subtitle,
        cover: workFixture.cover,
        description: `${workFixture.name} ${chapterFixture.title}`,
        sortOrder: chapterFixture.sortOrder,
        isPublished: chapterFixture.isPublished,
        isPreview: chapterFixture.isPreview,
        publishAt,
        viewRule: chapterFixture.viewRule,
        requiredViewLevelId:
          chapterFixture.viewRule === 3 ? requiredLevelId : null,
        price: chapterFixture.price,
        canDownload: true,
        canComment: true,
        novelContentPath:
          workFixture.type === 2 ? chapterFixture.content : null,
        comicContentManifest:
          workFixture.type === 1
            ? [
                {
                  page: 1,
                  url: `https://static.example.com/works/${workFixture.key}/chapters/${chapterFixture.sortOrder}/page-1.png`,
                },
              ]
            : null,
        wordCount: chapterFixture.wordCount,
        viewCount: existingChapter?.viewCount ?? 0,
        likeCount: existingChapter?.likeCount ?? 0,
        commentCount: existingChapter?.commentCount ?? 0,
        purchaseCount: existingChapter?.purchaseCount ?? 0,
        downloadCount: existingChapter?.downloadCount ?? 0,
        remark: '初始化章节内容',
      }

      if (!existingChapter) {
        await db.insert(workChapter).values(chapterPayload)
      } else {
        await db
          .update(workChapter)
          .set(chapterPayload)
          .where(eq(workChapter.id, existingChapter.id))
      }
    }
  }
  console.log('  ✓ 作品与章节完成')

  for (const workFixture of WORK_FIXTURES) {
    const currentWork = await db.query.work.findFirst({
      where: { AND: [{ name: workFixture.name }, { type: workFixture.type }] },
      columns: {
        id: true,
      },
    })

    if (!currentWork) {
      continue
    }

    for (const [sortOrder, authorName] of workFixture.authors.entries()) {
      const author = await db.query.workAuthor.findFirst({
        where: { name: authorName },
        columns: {
          id: true,
        },
      })
      if (!author) {
        continue
      }

      const existingRelation = await db.query.workAuthorRelation.findFirst({
        where: { AND: [{ workId: currentWork.id }, { authorId: author.id }] },
        columns: {
          workId: true,
        },
      })

      if (!existingRelation) {
        await db.insert(workAuthorRelation).values({
          workId: currentWork.id,
          authorId: author.id,
          sortOrder,
        })
      } else {
        await db
          .update(workAuthorRelation)
          .set({
            sortOrder,
          })
          .where(
            and(
              eq(workAuthorRelation.workId, currentWork.id),
              eq(workAuthorRelation.authorId, author.id),
            ),
          )
      }
    }

    for (const [sortOrder, categoryName] of workFixture.categories.entries()) {
      const category = await db.query.workCategory.findFirst({
        where: { name: categoryName },
        columns: {
          id: true,
        },
      })
      if (!category) {
        continue
      }

      const existingRelation = await db.query.workCategoryRelation.findFirst({
        where: {
          AND: [{ workId: currentWork.id }, { categoryId: category.id }],
        },
        columns: {
          workId: true,
        },
      })

      if (!existingRelation) {
        await db.insert(workCategoryRelation).values({
          workId: currentWork.id,
          categoryId: category.id,
          sortOrder,
        })
      } else {
        await db
          .update(workCategoryRelation)
          .set({ sortOrder })
          .where(
            and(
              eq(workCategoryRelation.workId, currentWork.id),
              eq(workCategoryRelation.categoryId, category.id),
            ),
          )
      }
    }

    for (const [sortOrder, tagName] of workFixture.tags.entries()) {
      const tag = await db.query.workTag.findFirst({
        where: { name: tagName },
        columns: {
          id: true,
        },
      })
      if (!tag) {
        continue
      }

      const existingRelation = await db.query.workTagRelation.findFirst({
        where: { AND: [{ workId: currentWork.id }, { tagId: tag.id }] },
        columns: {
          sortOrder: true,
        },
      })

      if (!existingRelation) {
        await db.insert(workTagRelation).values({
          workId: currentWork.id,
          tagId: tag.id,
          sortOrder,
        })
      } else if (existingRelation.sortOrder !== sortOrder) {
        await db
          .update(workTagRelation)
          .set({ sortOrder })
          .where(
            and(
              eq(workTagRelation.workId, currentWork.id),
              eq(workTagRelation.tagId, tag.id),
            ),
          )
      }
    }
  }
  console.log('  ✓ 作品关联完成')

  const authors = await db.query.workAuthor.findMany({
    where: { deletedAt: { isNull: true } },
    columns: {
      id: true,
      followersCount: true,
    },
  })
  for (const author of authors) {
    const relations = await db.query.workAuthorRelation.findMany({
      where: { authorId: author.id },
      columns: {
        workId: true,
      },
    })

    await db
      .update(workAuthor)
      .set({
        workCount: relations.length,
        followersCount: author.followersCount || relations.length * 12,
      })
      .where(eq(workAuthor.id, author.id))
  }
  console.log('  ✓ 作者统计完成')

  console.log('✅ 作品域数据完成')
}
