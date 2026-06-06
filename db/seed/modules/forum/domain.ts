import type { BodyToken } from '@libs/interaction/body/body-token.type'
import type { BodyDoc, BodyInlineNode } from '@libs/interaction/body/body.type'
import type { Db } from '../../db-client'
import {
  appUser,
  appUserCount,
  forumHashtag,
  forumHashtagReference,
  forumModerator,
  forumModeratorActionLog,
  forumModeratorApplication,
  forumModeratorSection,
  forumSection,
  forumSectionGroup,
  forumTopic,
  forumUserActionLog,
  userBrowseLog,
  userComment,
  userFavorite,
  userLevelRule,
  userLike,
  userMention,
} from '@db/schema'
import {
  ForumUserActionTargetTypeEnum,
  ForumUserActionTypeEnum,
} from '@libs/forum/action-log/action-log.constant'
import {
  FORUM_HASHTAG_TEXT_REGEX,
  ForumHashtagCreateSourceTypeEnum,
  ForumHashtagReferenceSourceTypeEnum,
} from '@libs/forum/hashtag/forum-hashtag.constant'
import {
  ForumModeratorActionTargetTypeEnum,
  ForumModeratorActionTypeEnum,
} from '@libs/forum/moderator/moderator-action-log.constant'
import { buildForumTopicContentPreview } from '@libs/forum/topic/forum-topic-preview.helper'
import { createBodyDocFromPlainText } from '@libs/interaction/body/body-text.helper'
import { BODY_VERSION_V1 } from '@libs/interaction/body/body.constant'
import { BrowseLogTargetTypeEnum } from '@libs/interaction/browse-log/browse-log.constant'
import { CommentTargetTypeEnum } from '@libs/interaction/comment/comment.constant'
import { FavoriteTargetTypeEnum } from '@libs/interaction/favorite/favorite.constant'
import { LikeTargetTypeEnum } from '@libs/interaction/like/like.constant'
import { MentionSourceTypeEnum } from '@libs/interaction/mention/mention.constant'
import {
  AuditStatusEnum,
  CommentLevelEnum,
  SceneTypeEnum,
} from '@libs/platform/constant'
import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import {
  addMinutes,
  SEED_READER_ACCOUNT_SLUGS,
  SEED_TIMELINE,
} from '../../shared'

const BASIC_LEVEL_NAME = '新手读者'
const FORUM_SEED_USER_AGENT = 'seed-script/forum-simulation'
const FORUM_TOPIC_COMMENT_TARGET_TYPE = CommentTargetTypeEnum.FORUM_TOPIC
const FORUM_TOPIC_LIKE_TARGET_TYPE = LikeTargetTypeEnum.FORUM_TOPIC
const FORUM_TOPIC_FAVORITE_TARGET_TYPE = FavoriteTargetTypeEnum.FORUM_TOPIC
const FORUM_TOPIC_BROWSE_TARGET_TYPE = BrowseLogTargetTypeEnum.FORUM_TOPIC

const FORUM_SECTION_NAMES = {
  newcomer: '新人报到',
  seasonAnime: '新番追更',
  manga: '漫画安利',
  lightNovel: '轻小说茶会',
  character: '角色厨集合',
  doujin: '同人创作',
  merch: '谷子与痛包',
  cosplay: 'Cosplay 与漫展',
} as const

const SECTION_HASHTAGS: Record<string, readonly string[]> = {
  [FORUM_SECTION_NAMES.newcomer]: [
    '新人报道',
    '补番路线',
    '社区礼仪',
    '入坑记录',
  ],
  [FORUM_SECTION_NAMES.seasonAnime]: [
    '新番追更',
    '作画讨论',
    '动画党视角',
    '本周集中楼',
  ],
  [FORUM_SECTION_NAMES.manga]: [
    '漫画安利',
    '分镜研究',
    '冷门佳作',
    '纸质书体验',
  ],
  [FORUM_SECTION_NAMES.lightNovel]: [
    '轻小说',
    '书荒互助',
    '原作补完',
    '翻译讨论',
  ],
  [FORUM_SECTION_NAMES.character]: [
    '角色厨',
    '名场面回看',
    '关系性讨论',
    '冷静分析',
  ],
  [FORUM_SECTION_NAMES.doujin]: [
    '同人创作',
    '无料制作',
    '手书分镜',
    '互评求助',
  ],
  [FORUM_SECTION_NAMES.merch]: ['谷子交流', '痛包搭配', '收纳方案', '预售避坑'],
  [FORUM_SECTION_NAMES.cosplay]: [
    'Cosplay',
    '漫展准备',
    '摄影沟通',
    '场照返图',
  ],
}

const COMMON_HASHTAGS = [
  '二次元日常',
  '同好交流',
  '轻微剧透',
  '经验求助',
] as const

const SECTION_GROUP_FIXTURES = [
  {
    name: '站务与新人',
    description: '新人提问、社区规则、反馈建议和版务说明。',
    sortOrder: 1,
    maxModerators: 6,
  },
  {
    name: '番剧漫画讨论',
    description: '围绕新番、漫画、轻小说与角色剧情的日常讨论。',
    sortOrder: 2,
    maxModerators: 12,
  },
  {
    name: '创作与同人',
    description: '同人创作、OC 设定、手书、绘画和写作交流。',
    sortOrder: 3,
    maxModerators: 10,
  },
  {
    name: '周边与线下',
    description: '谷子、痛包、cos、漫展、圣地巡礼和线下经验。',
    sortOrder: 4,
    maxModerators: 8,
  },
] as const

const SECTION_FIXTURES = [
  {
    name: '新人报到',
    groupName: '站务与新人',
    description: '新人自我介绍、入坑经历、社区使用问题和日常寒暄。',
    icon: 'https://api.dicebear.com/9.x/icons/svg?seed=forum-newcomer',
    cover: 'https://api.dicebear.com/9.x/shapes/svg?seed=forum-newcomer-cover',
    sortOrder: 1,
    topicReviewPolicy: 1,
    topicCount: 88,
  },
  {
    name: '新番追更',
    groupName: '番剧漫画讨论',
    description: '每周新番观感、作画演出、OP/ED 和追更碎碎念。',
    icon: 'https://api.dicebear.com/9.x/icons/svg?seed=forum-season-anime',
    cover:
      'https://api.dicebear.com/9.x/shapes/svg?seed=forum-season-anime-cover',
    sortOrder: 1,
    topicReviewPolicy: 1,
    topicCount: 112,
  },
  {
    name: '漫画安利',
    groupName: '番剧漫画讨论',
    description: '漫画推荐、分镜讨论、单行本体验和补坑记录。',
    icon: 'https://api.dicebear.com/9.x/icons/svg?seed=forum-manga',
    cover: 'https://api.dicebear.com/9.x/shapes/svg?seed=forum-manga-cover',
    sortOrder: 2,
    topicReviewPolicy: 1,
    topicCount: 104,
  },
  {
    name: '轻小说茶会',
    groupName: '番剧漫画讨论',
    description: '轻小说阅读、翻译版本、设定整理和书荒互助。',
    icon: 'https://api.dicebear.com/9.x/icons/svg?seed=forum-light-novel',
    cover:
      'https://api.dicebear.com/9.x/shapes/svg?seed=forum-light-novel-cover',
    sortOrder: 3,
    topicReviewPolicy: 1,
    topicCount: 96,
  },
  {
    name: '角色厨集合',
    groupName: '番剧漫画讨论',
    description: '角色分析、CP 倾向、名场面、台词和情绪价值讨论。',
    icon: 'https://api.dicebear.com/9.x/icons/svg?seed=forum-character',
    cover: 'https://api.dicebear.com/9.x/shapes/svg?seed=forum-character-cover',
    sortOrder: 4,
    topicReviewPolicy: 1,
    topicCount: 108,
  },
  {
    name: '同人创作',
    groupName: '创作与同人',
    description: '同人文、同人图、OC、手书、排版和创作互助。',
    icon: 'https://api.dicebear.com/9.x/icons/svg?seed=forum-doujin',
    cover: 'https://api.dicebear.com/9.x/shapes/svg?seed=forum-doujin-cover',
    sortOrder: 1,
    topicReviewPolicy: 1,
    topicCount: 100,
  },
  {
    name: '谷子与痛包',
    groupName: '周边与线下',
    description: '吧唧、立牌、小卡、痛包、预售和周边避坑。',
    icon: 'https://api.dicebear.com/9.x/icons/svg?seed=forum-merch',
    cover: 'https://api.dicebear.com/9.x/shapes/svg?seed=forum-merch-cover',
    sortOrder: 1,
    topicReviewPolicy: 1,
    topicCount: 92,
  },
  {
    name: 'Cosplay 与漫展',
    groupName: '周边与线下',
    description: 'cos 妆造、假毛、道具、摄影、漫展交通和场贩经验。',
    icon: 'https://api.dicebear.com/9.x/icons/svg?seed=forum-cosplay',
    cover: 'https://api.dicebear.com/9.x/shapes/svg?seed=forum-cosplay-cover',
    sortOrder: 2,
    topicReviewPolicy: 1,
    topicCount: 94,
  },
] as const

const COMMON_SUFFIXES = [
  '想听听大家怎么想',
  '有没有同好聊聊',
  '求一个冷静分析',
  '先说个人体感',
  '欢迎补充细节',
  '不剧透讨论',
  '二刷之后有点改观',
  '今天刚追平',
  '轻微剧透慎入',
  '厨力发言预警',
  '适合周末慢慢聊',
  '想开个集中楼',
] as const

const COMMENT_TEXTS = [
  '同感，我也是看到后面才意识到前面埋了这么多东西。',
  '这个角度挺有意思，我之前完全没往这里想。',
  '先蹲一下，等楼里大佬补充，我也想听更多分析。',
  '我觉得这里不能只看剧情，还要看演出和节奏。',
  '说得很细，不过我对结论保留一点意见。',
  '这个问题我也卡过，后来换个顺序看就顺很多。',
  '太真实了，我收藏夹里也有一堆等着补。',
  '建议标题标一下轻微剧透，后面新人会比较好避开。',
  '这一段我反复看了几遍，确实越看越有味道。',
  '楼主可以继续写，这种长帖社区很需要。',
  '补充一个小细节，台词里的称呼变化其实很关键。',
  '我偏向另一种理解，但你这个说法也讲得通。',
  '如果是新入坑，我建议先别急着看解析，自己体验一遍更好。',
  '这类帖子看着就很有社区感，感谢整理。',
  '别的不说，这个截图点真的很会抓。',
  '我已经被说服了，今晚回去重看这一段。',
  '这类讨论比单纯刷评分有意思多了，能看到很多不同入口。',
  '如果按原作节奏看，这里其实没那么突兀，只是动画压得比较紧。',
  '我也蹲一个后续，楼里有人贴访谈出处的话会更完整。',
  '角色厨先承认有滤镜，但这个细节真的不是硬嗑。',
  '谷圈那边也在聊这个图，感觉后续周边会很好卖。',
  '建议补一下标题预警，尤其是还没追到最新话的朋友。',
] as const

const SECTION_TOPIC_POOLS: Record<
  string,
  {
    subjects: readonly string[]
    angles: readonly string[]
    questions: readonly string[]
    details: readonly string[]
  }
> = {
  [FORUM_SECTION_NAMES.newcomer]: {
    subjects: [
      '刚入坑二次元社区',
      '新人第一次发帖',
      '从短视频剪辑摸进来的新人',
      '想补番但不知道从哪开始',
      '社恐新人想找同好',
      '第一次认真写观后感',
      '刚开始看漫画单行本',
      '想从轻小说入坑',
      '被朋友按头安利《孤独摇滚！》',
      '刚补完《葬送的芙莉莲》',
      '第一次看完剧场版动画',
      '从游戏联动活动摸进来的新人',
    ],
    angles: [
      '有哪些不容易踩雷的入门建议',
      '社区里发长评会不会太打扰',
      '求一份温柔一点的补番路线',
      '大家平时怎么记录追更进度',
      '有没有适合新人参与的讨论方式',
      '想问问哪些词算比较常用的圈内黑话',
      '第一次去漫展要注意什么',
      '如何避免一上来就被剧透',
    ],
    questions: [
      '你们刚入坑时最先看的是什么类型？',
      '有没有那种看完会想马上找人聊的作品？',
      '大家会介意新人问基础问题吗？',
      '补旧番时会先看评分还是先看简介？',
      '长评发在主题里还是评论里比较合适？',
      '哪些社区礼仪是新人最容易忽略的？',
    ],
    details: [
      '我最近才发现讨论区比单纯刷推荐更有意思，尤其是大家会把演出、台词和角色动机拆开聊。',
      '之前一直只看剪辑，现在想慢慢把正片和原作补起来，不想只停留在名场面。',
      '有些帖子里大家默认懂很多缩写，我会边看边查，感觉像打开新地图。',
      '目前比较喜欢日常、奇幻和群像题材，太重口的刀子可能还要缓一缓。',
    ],
  },
  [FORUM_SECTION_NAMES.seasonAnime]: {
    subjects: [
      '这季度原创番',
      '昨晚更新那集',
      '本周最稳的一集',
      '第六集的演出',
      '片尾曲进来的时机',
      '这一季的黑马',
      '周更追番体验',
      '作画突然拉满那段',
      '中盘转折',
      '预告里的信息量',
      '《药屋少女的呢喃》追更体验',
      '《迷宫饭》的改编节奏',
      '《吹响！上低音号》里的社团空气',
      '《BanG Dream!》相关企划',
      '原创动画前三集',
    ],
    angles: [
      '是不是比开播时好看很多',
      '节奏突然顺起来了',
      '有点被低估了',
      '感觉监督终于开始发力',
      '台词留白比我想象中细',
      '作画资源是不是都压在这集了',
      '适合养肥还是适合周更',
      '会不会后面开始发刀',
    ],
    questions: [
      '大家会继续周更追吗？',
      '你们更喜欢这种慢热还是前三集就爆点拉满？',
      '这集的分镜有没有人想展开聊？',
      'OP/ED 有没有越听越上头？',
      '如果推荐给没追的人，你们会怎么形容？',
      '目前最担心后面哪条线收不住？',
    ],
    details: [
      '我一开始只是随手点开，结果这两周越来越期待更新，尤其是角色之间的沉默和停顿很有味道。',
      '这集没有硬塞设定说明，反而靠几个小动作把关系推了一步，观感比前面轻很多。',
      '虽然剧情还没完全爆开，但镜头和音乐已经在铺情绪，感觉后面可能会回收得很漂亮。',
      '弹幕里有人说太慢，我倒觉得这种周更留白刚好，适合看完以后慢慢想。',
    ],
  },
  [FORUM_SECTION_NAMES.manga]: {
    subjects: [
      '最近补到一部冷门漫画',
      '这种分镜密度高的漫画',
      '单行本装帧很舒服的作品',
      '前期平淡但后劲很大的漫画',
      '画风一开始劝退但越看越香',
      '短篇漫画',
      '长篇连载追到中段',
      '适合睡前看的漫画',
      '被封面骗进去的漫画',
      '想安利一部慢热作品',
      '《跃动青春》的日常感',
      '《蓝色时期》的创作焦虑',
      '《蜂蜜与四叶草》的青春后劲',
      '《排球少年!!》漫画补完',
      '《海街diary》的生活流',
    ],
    angles: [
      '真的很适合细读',
      '比简介看起来有意思',
      '分镜节奏太舒服了',
      '人物关系写得很克制',
      '后劲比爽点更强',
      '适合喜欢群像的人',
      '不是神作但很真诚',
      '读完会想找人聊',
    ],
    questions: [
      '大家会因为画风劝退一部作品吗？',
      '你们看漫画更在意分镜还是故事？',
      '有没有类似这种慢热但稳定的作品？',
      '冷门作品安利时怎么避免剧透？',
      '电子版和纸质版体验差异大吗？',
      '你们会为了装帧买实体书吗？',
    ],
    details: [
      '它不是那种开篇就甩设定的类型，更多是靠日常对话慢慢把人物推出来。',
      '我最喜欢的是它会留出空镜和沉默，不急着解释，读起来像在跟角色一起呼吸。',
      '分镜没有炫技，但视线引导很自然，翻页点也卡得很准。',
      '如果只看前三话可能觉得普通，看到后面再回头会发现很多表情都不是随便画的。',
    ],
  },
  [FORUM_SECTION_NAMES.lightNovel]: {
    subjects: [
      '最近读到一本轻小说',
      'web 版和文库版差异',
      '翻译腔太重的问题',
      '第一人称叙述',
      '异世界设定',
      '校园恋爱轻小说',
      '推理线混进日常系',
      '台版和简中版',
      '书荒期翻旧坑',
      '插画和正文的关系',
      '《86 -不存在的战区-》原作补卷',
      '《青春猪头少年》系列',
      '《冰菓》原作和动画的气质差异',
      '《文学少女》旧坑回补',
      '设定党读外传',
    ],
    angles: [
      '比预期耐读',
      '设定展开得很稳',
      '主角吐槽有点过量',
      '插画反而影响想象',
      '后记信息量很大',
      '适合慢慢看',
      '翻译影响观感太明显',
      '越到后面越吃角色关系',
    ],
    questions: [
      '大家会优先看 web 版还是文库版？',
      '轻小说最劝退你们的点是什么？',
      '有没有节奏轻一点但不水的推荐？',
      '插画会影响你们对角色的第一印象吗？',
      '翻译不顺的时候你们会继续看吗？',
      '长卷数作品怎么判断值不值得追？',
    ],
    details: [
      '这本前面像普通日常，后面慢慢把设定压出来，读着比简介稳很多。',
      '我觉得轻小说最怕解释太满，但这本还算克制，很多设定是靠事件自然带出来的。',
      '翻译有些句子确实拗口，不过角色声音还在，所以我能接受。',
      '插画很漂亮，但某些场景和我脑内想象差距挺大，反而有点出戏。',
    ],
  },
  [FORUM_SECTION_NAMES.character]: {
    subjects: [
      '这个角色的成长线',
      '主角团里最容易被误解的人',
      '反派的动机',
      '配角高光',
      '角色关系里的沉默',
      '那句台词',
      '角色厨滤镜',
      'CP 向解读',
      '名场面回看',
      '角色人设变化',
      '《葬送的芙莉莲》里辛美尔的回响',
      '《排球少年!!》配角的高光',
      '《孤独摇滚！》的社恐表达',
      '《Fate》系角色厨滤镜',
      '《咒术回战》争议角色讨论',
    ],
    angles: [
      '其实比表面复杂',
      '不是单纯洗白',
      '我越想越难受',
      '细看很有层次',
      '可能被低估了',
      '情绪价值太强',
      '有点像在和自己和解',
      '二刷才看懂',
    ],
    questions: [
      '你们会因为角色缺点更喜欢他吗？',
      '这段算糖还是算刀？',
      '角色厨解读到什么程度会过度脑补？',
      '有没有一句台词让你瞬间入坑？',
      '大家更吃成长型还是完成型角色？',
      '反派塑造最重要的是动机还是魅力？',
    ],
    details: [
      '我第一次看只觉得他别扭，二刷才发现很多反应都和前面经历有关。',
      '这个角色最打动我的不是高光，而是他在小场景里露出的犹豫和自我保护。',
      '如果只按结果评价会显得很单薄，放回当时的信息差里看就能理解很多。',
      '我不想把他说成完美的人，正因为不完美才有讨论空间。',
    ],
  },
  [FORUM_SECTION_NAMES.doujin]: {
    subjects: [
      '同人文开头',
      'OC 设定',
      '手书分镜',
      '同人图构图',
      '短篇完结率',
      '排版和字体',
      '无料制作',
      '角色口吻',
      '互评方式',
      '灵感枯竭',
      'CP 向短篇',
      '本命生贺图',
      '漫展无料排版',
      '角色口吻校对',
      '手书选曲',
    ],
    angles: [
      '怎么写才不尴尬',
      '想求一点修改建议',
      '卡在中段了',
      '感觉越修越不像自己',
      '需要避开什么雷',
      '有没有更省钱的方案',
      '想做得更有完成度',
      '第一次尝试有点紧张',
    ],
    questions: [
      '大家写同人会先列大纲吗？',
      'OC 和原作角色互动怎么保持边界？',
      '互评时怎样说才不会伤人？',
      '手书用什么节奏点比较自然？',
      '无料印刷数量怎么估算？',
      '有没有适合新手的排版工具？',
    ],
    details: [
      '我现在最大的问题是脑内画面很清楚，落到文字里就变成流水账。',
      '想保留角色原本的说话习惯，但又怕写成复读原作台词。',
      '这次准备做成小册子，页数不多，主要想练一次完整流程。',
      '互评真的很需要分寸，我希望能收到具体建议，而不是单纯夸或单纯否定。',
    ],
  },
  [FORUM_SECTION_NAMES.merch]: {
    subjects: [
      '吧唧预售',
      '立牌到货',
      '小卡收纳',
      '痛包配色',
      '官谷和同人谷',
      '海景谷价格',
      '再贩消息',
      '交换谷子',
      '展示柜空间',
      '新手入谷坑',
      '本命生日谷',
      '日拍代购',
      '场贩无料交换',
      '吧唧排版',
      '小卡自印和官谷',
    ],
    angles: [
      '有没有必要冲首发',
      '这次质量还行吗',
      '预算突然失控',
      '怎么搭不容易乱',
      '避雷经验整理',
      '想听听收纳方案',
      '感觉价格有点离谱',
      '还是等现货更稳',
    ],
    questions: [
      '大家会为了特典多买一份吗？',
      '痛包更看重配色还是密度？',
      '谷子交换怎么确认状态比较稳？',
      '立牌刮痕算不算正常瑕疵？',
      '预售周期太长你们还会买吗？',
      '新手第一个痛包建议从什么尺寸开始？',
    ],
    details: [
      '我以前觉得自己很理性，直到本命出了新图，购物车瞬间不讲道理。',
      '这次想把包做得日常一点，不想太满，但又怕看起来没气势。',
      '收纳真的比买谷更难，尤其是小卡和吧唧越来越多以后。',
      '价格如果只是因为稀有还好，最怕的是品相描述不清楚。',
    ],
  },
  [FORUM_SECTION_NAMES.cosplay]: {
    subjects: [
      '第一次出 cos',
      '假毛修剪',
      '妆面翻车',
      '道具运输',
      '漫展排队',
      '摄影沟通',
      '场照返图',
      '夏天出外景',
      '自由行约拍',
      '摊位动线',
      'BW 和 CP 场次准备',
      '场照修图沟通',
      '假毛定型喷雾',
      '宅舞舞台排练',
      '摄影棚预约',
    ],
    angles: [
      '有哪些需要提前准备',
      '真的比想象中难',
      '求一点实用经验',
      '有没有不踩雷的方法',
      '怎么让状态更自然',
      '预算应该怎么分配',
      '体力消耗太真实了',
      '新手可以从哪里开始',
    ],
    questions: [
      '假毛第一次修坏了还有救吗？',
      '漫展当天怎么安排补妆和休息？',
      '摄影前需要提前沟通哪些点？',
      '道具过安检有什么经验？',
      '夏天出 cos 怎么防中暑？',
      '场照不满意怎么礼貌沟通？',
    ],
    details: [
      '我以前以为准备衣服就够了，真的开始做才发现妆造、道具、交通全是细节。',
      '最担心的不是不像角色，而是当天状态太紧绷，拍出来没有角色的感觉。',
      '这次准备尽量轻装，先保证能舒服地逛完，不想一上来就挑战高难度。',
      '摄影沟通比我想象中重要，提前说清楚想要的氛围会省很多时间。',
    ],
  },
}

const SECTION_REALISTIC_POOLS = {
  [FORUM_SECTION_NAMES.newcomer]: {
    works: [
      '《葬送的芙莉莲》',
      '《孤独摇滚！》',
      '《跃动青春》',
      '《排球少年!!》',
      '《迷宫饭》',
      '《吹响！上低音号》',
      '《夏目友人帐》',
      '《药屋少女的呢喃》',
    ],
    situations: [
      '从动画剪辑一路补到正片',
      '刚开始买漫画单行本',
      '第一次认真写长评',
      '想把补番清单重新排一下',
      '被朋友按头安利后入坑',
      '刚看完剧场版回来',
      '想找人一起追本季新番',
      '从手游联动摸进来的新人',
    ],
    questions: [
      '新人发帖要注意哪些礼仪',
      '补旧番会不会很容易被剧透',
      '大家怎么记录追更进度',
      '有没有适合慢慢补的入门路线',
      '长评直接发主题会不会太打扰',
      '圈内常见黑话有没有整理贴',
      '先补动画还是先看原作比较好',
      '想找同好应该从哪个板块开始',
    ],
    details: [
      '我不是想刷评分，主要是想找个能把剧情、演出和角色动机慢慢聊清楚的地方。',
      '之前只看过一些名场面剪辑，真正补正片以后才发现很多情绪要连着上下文看。',
      '现在比较喜欢日常、群像和成长线，太重的刀子可能要缓一缓再看。',
      '有些帖子里默认大家都懂缩写，我会边看边查，感觉像打开了新地图。',
      '我想先从不太吵、能认真讨论的作品开始补，慢一点也没关系。',
    ],
    endings: [
      '如果有适合新人看的索引贴，也麻烦丢一下链接名。',
      '先谢谢大家，我会慢慢回帖，不太会一次性聊很多。',
      '可以轻微剧透规则，但尽量别直接说结局。',
      '也欢迎说说你们刚入坑时踩过什么坑。',
    ],
  },
  [FORUM_SECTION_NAMES.seasonAnime]: {
    works: [
      '《葬送的芙莉莲》',
      '《迷宫饭》',
      '《药屋少女的呢喃》',
      '《败犬女主太多了！》',
      '《Girls Band Cry》',
      "《BanG Dream! It's MyGO!!!!!》",
      '《吹响！上低音号》',
      '《我心里危险的东西》',
      '《跃动青春》',
      '《赛马娘 Pretty Derby》',
    ],
    situations: [
      '这周更新',
      '第{episode}集',
      '中盘这一话',
      'OP 进来的那一段',
      '片尾曲卡点',
      '预告里的信息量',
      '作画突然拉满的镜头',
      '动画党刚追平',
    ],
    questions: [
      '你们觉得节奏是不是比前三集稳了',
      '这段分镜有没有必要单独开楼聊',
      '监督这集是不是终于开始发力',
      '适合周更追还是养肥一次看',
      '目前最担心哪条线收不住',
      '这一话算糖还是算刀',
      'OP/ED 有没有越听越上头',
      '动画党现在去补原作会不会太早',
    ],
    details: [
      '这集没有硬塞设定说明，反而靠几个停顿和眼神把关系往前推了一步。',
      '我本来以为会是普通过渡回，结果音乐进来的时机比预想中准很多。',
      '弹幕里有人嫌慢，但我觉得这种留白刚好，适合看完以后再回来翻细节。',
      '角色说出口的东西不多，但镜头一直在补情绪，这点挺吃监督功力。',
      '这一话如果单看剧情量不算大，可是放在前后两集之间很关键。',
    ],
    endings: [
      '楼里可以带轻微剧透，但麻烦标一下原作进度。',
      '我先按动画党视角聊，有原作党欢迎补充但别直接开大。',
      '如果有访谈或原画卡出处，也可以一起贴出来。',
      '这楼就当本周集中讨论，大家慢慢补。',
    ],
  },
  [FORUM_SECTION_NAMES.manga]: {
    works: [
      '《跃动青春》',
      '《蓝色时期》',
      '《蜂蜜与四叶草》',
      '《排球少年!!》',
      '《致不灭的你》',
      '《海街diary》',
      '《晚安，布布》',
      '《迷宫饭》',
      '《黄金神威》',
      '《听着这电波》',
    ],
    situations: [
      '翻到第{volume}卷',
      '补完前半段',
      '买了实体单行本',
      '被封面骗进去',
      '二刷才注意到',
      '睡前随手翻',
      '看到最新话',
      '从动画回补漫画',
    ],
    questions: [
      '有没有类似这种后劲很长的作品',
      '大家会因为画风劝退一部漫画吗',
      '安利冷门作品怎么避开剧透',
      '电子版和纸质版体验差异大吗',
      '你们更在意分镜还是故事',
      '这种慢热节奏是不是很挑人',
      '要不要继续收后面的实体书',
      '有没有同样适合细读的短篇',
    ],
    details: [
      '它不是第一话就甩爆点的类型，更多是靠日常对话把人物一点点推出来。',
      '分镜没有刻意炫技，但翻页点卡得很准，读着会自然停下来想一会儿。',
      '我最喜欢的是它敢留空镜和沉默，不急着解释角色为什么难过。',
      '如果只看简介会觉得普通，真正读进去才发现每个人都有自己的重量。',
      '实体书的纸感和跨页效果比我想象中好，尤其适合这种节奏慢的作品。',
    ],
    endings: [
      '尽量不剧透关键转折，只聊阅读体验。',
      '如果有人也在补，可以一起开个进度楼。',
      '欢迎反向安利，我最近确实有点书荒。',
      '不一定要神作，真诚、稳定就很加分。',
    ],
  },
  [FORUM_SECTION_NAMES.lightNovel]: {
    works: [
      '《86 -不存在的战区-》',
      '《青春猪头少年》',
      '《冰菓》',
      '《文学少女》',
      '《无职转生》',
      '《药师少女的独语》',
      '《欢迎来到实力至上主义的教室》',
      '《关于我转生变成史莱姆这档事》',
      '《败犬女主太多了！》',
      '《义妹生活》',
    ],
    situations: [
      '文库版读到第{volume}卷',
      'web 版和文库版对照看',
      '刚补完动画对应卷',
      '被插画吸引去读原作',
      '台版和简中版都翻了几页',
      '后记信息量有点大',
      '第一人称读着很顺',
      '设定展开到中段',
    ],
    questions: [
      '翻译腔会不会影响你们继续读',
      '长卷数作品怎么判断值不值得追',
      '插画会影响角色第一印象吗',
      '有没有节奏轻一点但不水的推荐',
      'web 版和文库版优先看哪个',
      '这种主角吐槽算加分还是扣分',
      '动画党补原作从哪卷开始比较好',
      '书荒期大家会回去翻旧坑吗',
    ],
    details: [
      '这本前面像普通日常，后面慢慢把设定压出来，比简介看起来稳很多。',
      '我最怕解释太满，但这一卷还算克制，很多规则是靠事件自然带出来的。',
      '有些句子确实有翻译腔，不过角色声音还在，所以我暂时能接受。',
      '插画很好看，但某几个场景和我脑内想象差距很大，反而有点出戏。',
      '后记里提到的创作方向挺有意思，感觉下一卷会明显转调。',
    ],
    endings: [
      '麻烦尽量别剧透后面大转折，我还没补完。',
      '欢迎按“轻松/胃痛/设定多”这种标签推荐。',
      '如果有版本差异整理，也想蹲一个。',
      '这楼就当书荒互助，大家随便聊。',
    ],
  },
  [FORUM_SECTION_NAMES.character]: {
    works: [
      '《葬送的芙莉莲》',
      '《排球少年!!》',
      '《孤独摇滚！》',
      '《Fate/stay night》',
      '《咒术回战》',
      '《文豪野犬》',
      '《新世纪福音战士》',
      '《银魂》',
      '《少女歌剧 Revue Starlight》',
      "《BanG Dream! It's MyGO!!!!!》",
    ],
    situations: [
      '二刷才看懂这条成长线',
      '那句台词越想越难受',
      '角色缺点反而让我更喜欢',
      '这段关系到底算糖还是刀',
      '反派动机不能只看结果',
      '配角高光真的被低估',
      '厨力发言但想冷静聊',
      '名场面回看还是会破防',
    ],
    questions: [
      '角色厨解读到什么程度算过度脑补',
      '大家更吃成长型还是完成型角色',
      '这段算洗白还是补完动机',
      '有没有一句台词让你瞬间入坑',
      '缺点明显的角色为什么反而更有魅力',
      'CP 向和原作向讨论怎么划边界',
      '反派塑造最重要的是动机还是魅力',
      '这类角色是不是特别适合二刷',
    ],
    details: [
      '我不想把他说成完美的人，正因为不完美，很多选择才有讨论空间。',
      '第一次看只觉得别扭，回头再看才发现很多反应都和前面经历有关。',
      '这个角色最打动我的不是高光，而是小场景里露出的犹豫和自我保护。',
      '如果只按结果评价会显得单薄，放回当时的信息差里就能理解很多。',
      '我承认有滤镜，但这几个镜头连起来看，确实不是随便给的。',
    ],
    endings: [
      '欢迎反驳，但希望别直接扣厨子滤镜。',
      '可以带 CP 向，不过麻烦先标一下倾向。',
      '楼里如果有台词截图或访谈出处，求补。',
      '轻微剧透注意，没追平的朋友先避一下。',
    ],
  },
  [FORUM_SECTION_NAMES.doujin]: {
    works: [
      '排球少年!!',
      '孤独摇滚！',
      '葬送的芙莉莲',
      '咒术回战',
      '文豪野犬',
      'BanG Dream!',
      'Fate',
      '原神',
      '明日方舟',
      '偶像企划',
    ],
    situations: [
      '短篇卡在中段',
      '第一次做无料小册',
      '手书分镜刚排完',
      '本命生贺图还差背景',
      'OC 设定越写越长',
      '互评时不知道怎么开口',
      '排版和字体选到头痛',
      '角色口吻校对了三遍',
    ],
    questions: [
      '怎么写才不容易 OOC',
      '互评怎样说才具体又不伤人',
      '无料印多少份比较稳',
      '手书节奏点怎么卡比较自然',
      '短篇开头要不要直接进冲突',
      'OC 和原作角色互动边界怎么把握',
      '新手排版工具有没有推荐',
      '越修越不像自己怎么办',
    ],
    details: [
      '脑内画面很清楚，落到文字里就容易变成流水账，这是我现在最卡的地方。',
      '想保留角色原本的说话习惯，但又怕写成复读原作台词。',
      '这次页数不多，主要想练一遍从草稿、校对到印刷的完整流程。',
      '互评真的很需要分寸，我更想收到能落地修改的建议，而不是单纯夸或否定。',
      '我知道完成比完美重要，但发出去之前还是会反复改一些很小的句子。',
    ],
    endings: [
      '可以直接指出问题，我会自己筛选能改的部分。',
      '如果有排版模板或印厂经验，也欢迎分享。',
      '先谢谢愿意看稿的人，真的救命。',
      '不求一步到位，想先把完成度拉上去。',
    ],
  },
  [FORUM_SECTION_NAMES.merch]: {
    works: [
      '葬送的芙莉莲',
      '排球少年!!',
      '咒术回战',
      '文豪野犬',
      'BanG Dream!',
      '初音未来',
      '偶像企划',
      '明日方舟',
      '原神',
      'Fate',
    ],
    situations: [
      '本命生日谷开预售',
      '吧唧到货发现轻微划痕',
      '痛包配色还差一块',
      '小卡收纳又爆了',
      '场贩无料想交换',
      '日拍代购价格突然涨了',
      '立牌摆不下了',
      '官谷和同人谷同时上新',
    ],
    questions: [
      '有没有必要冲首发',
      '这种瑕疵算正常范围吗',
      '痛包更看重配色还是密度',
      '交换谷子怎么确认品相比较稳',
      '预售周期太长你们还会买吗',
      '新手第一个痛包买多大合适',
      '特典要不要为了凑套多买一份',
      '收纳盒有没有不压膜的推荐',
    ],
    details: [
      '我以前觉得自己很理性，直到本命出了新图，购物车瞬间不讲道理。',
      '这次想做得日常一点，不想满到看不清图，但又怕太空没气势。',
      '收纳真的比买谷更难，尤其小卡和吧唧越来越多以后，找东西都要翻半天。',
      '价格高我还能理解，最怕的是卖家图和品相描述不清楚。',
      '同人谷有时候设计更戳我，但又担心材质和色差，想听听大家经验。',
    ],
    endings: [
      '欢迎晒包和收纳图，我想参考一下。',
      '如果有避雷经验也可以说，别挂具体人就好。',
      '预算有限，想听真实使用感。',
      '先蹲一下同担怎么选。',
    ],
  },
  [FORUM_SECTION_NAMES.cosplay]: {
    works: [
      '芙莉莲',
      '波奇酱',
      '药屋猫猫',
      '影山飞雄',
      '五条悟',
      '太宰治',
      '初音未来',
      '远坂凛',
      '星野爱',
      '原创制服角色',
    ],
    situations: [
      '第一次出 cos',
      '假毛修剪翻车',
      '妆面到下午开始斑驳',
      '道具太长不知道怎么运输',
      '摄影沟通还不熟',
      'BW/CP 场次准备清单',
      '场照返图想礼貌沟通',
      '夏天外景差点被热晕',
    ],
    questions: [
      '新手当天要带哪些救急物品',
      '假毛第一次修坏了还有救吗',
      '漫展怎么安排补妆和休息',
      '摄影前需要提前沟通哪些点',
      '道具过安检有什么经验',
      '夏天出 cos 怎么防中暑',
      '场照不满意怎么说比较礼貌',
      '自由行约拍预算怎么分配',
    ],
    details: [
      '我以前以为准备衣服就够了，真的开始做才发现妆造、道具、交通全是细节。',
      '最担心的不是不像角色，而是当天太紧绷，拍出来没有角色该有的状态。',
      '这次想先保证舒服地逛完，不想第一次就挑战太高难度。',
      '摄影沟通比我想象中重要，提前说清楚想要的氛围真的能省很多时间。',
      '大场排队和寄存太消耗体力了，感觉行程安排比妆造还影响体验。',
    ],
    endings: [
      '欢迎有经验的老师补充清单，我会照着检查。',
      '不求一步到位，先想把安全和体力安排好。',
      '如果有场馆避坑也可以说说。',
      '返图沟通这块尤其想听真实经验。',
    ],
  },
} as const

interface SeedUserRow {
  id: number
  account: string
  nickname: string
  lastLoginIp: string | null
  lastLoginGeoCountry: string | null
  lastLoginGeoProvince: string | null
  lastLoginGeoCity: string | null
  lastLoginGeoIsp: string | null
}

interface SeedTopicRow {
  id: number
  sectionId: number
  userId: number
  sectionName: string
  title: string
  createdAt: Date
}

interface SeedCommentRow {
  id: number
  userId: number
  floor: number | null
  createdAt: Date
}

interface SeedMentionTarget {
  userId: number
  nickname: string
}

interface SeedMentionFact extends SeedMentionTarget {
  start: number
  end: number
  text: string
}

interface SeedHashtagFact {
  hashtagId: number
  slug: string
  displayName: string
  occurrenceCount: number
}

interface SeedHashtagCandidate {
  slug: string
  displayName: string
}

interface SeedHashtagRecord extends SeedHashtagCandidate {
  id: number
}

interface SeedMaterializedBody {
  html: string
  content: string
  body: BodyDoc
  bodyVersion: number
  contentPreview: ReturnType<typeof buildForumTopicContentPreview>
  mentionFacts: SeedMentionFact[]
  hashtagFacts: SeedHashtagFact[]
}

export async function seedForumReferenceDomain(db: Db) {
  console.log('🌱 初始化论坛参考数据...')

  for (const groupFixture of SECTION_GROUP_FIXTURES) {
    const existing = await db.query.forumSectionGroup.findFirst({
      where: and(
        eq(forumSectionGroup.name, groupFixture.name),
        isNull(forumSectionGroup.deletedAt),
      ),
    })

    if (!existing) {
      await db.insert(forumSectionGroup).values({
        ...groupFixture,
        isEnabled: true,
      })
    } else {
      await db
        .update(forumSectionGroup)
        .set({
          ...groupFixture,
          isEnabled: true,
        })
        .where(eq(forumSectionGroup.id, existing.id))
    }
  }
  console.log('  ✓ 板块分组完成')

  const basicLevel = await db.query.userLevelRule.findFirst({
    where: eq(userLevelRule.name, BASIC_LEVEL_NAME),
  })

  for (const sectionFixture of SECTION_FIXTURES) {
    const group = await db.query.forumSectionGroup.findFirst({
      where: and(
        eq(forumSectionGroup.name, sectionFixture.groupName),
        isNull(forumSectionGroup.deletedAt),
      ),
    })

    const existing = await db.query.forumSection.findFirst({
      where: and(
        eq(forumSection.name, sectionFixture.name),
        isNull(forumSection.deletedAt),
      ),
    })

    const payload = {
      groupId: group?.id ?? null,
      userLevelRuleId: basicLevel?.id ?? null,
      name: sectionFixture.name,
      description: sectionFixture.description,
      icon: sectionFixture.icon,
      cover: sectionFixture.cover,
      sortOrder: sectionFixture.sortOrder,
      isEnabled: true,
      topicReviewPolicy: sectionFixture.topicReviewPolicy,
      remark: 'seed: 二次元论坛演示板块',
      topicCount: existing?.topicCount ?? 0,
      commentCount: existing?.commentCount ?? 0,
      followersCount: existing?.followersCount ?? 0,
      lastPostAt: existing?.lastPostAt ?? null,
      lastTopicId: existing?.lastTopicId ?? null,
    }

    if (!existing) {
      await db.insert(forumSection).values(payload)
    } else {
      await db
        .update(forumSection)
        .set(payload)
        .where(eq(forumSection.id, existing.id))
    }
  }
  console.log('  ✓ 公共板块完成')

  console.log('✅ 论坛参考数据完成')
}

export async function seedForumActivityDomain(db: Db) {
  console.log('🌱 初始化论坛演示数据...')

  const seedUsers = await loadSeedUsers(db)
  if (seedUsers.length < 8) {
    console.log('  ℹ seed 用户不足，跳过论坛演示数据')
    return
  }

  await resetForumSimulationData(db)

  const moderator = await ensureForumModerator(db, seedUsers)
  const touchedSectionIds = new Set<number>()

  for (const [sectionIndex, sectionFixture] of SECTION_FIXTURES.entries()) {
    const section = await db.query.forumSection.findFirst({
      where: and(
        eq(forumSection.name, sectionFixture.name),
        isNull(forumSection.deletedAt),
      ),
    })
    if (!section) {
      continue
    }

    touchedSectionIds.add(section.id)
    await ensureModeratorSection(db, moderator.id, section.id)

    const topics = await seedSectionTopics(db, {
      section,
      sectionIndex,
      sectionFixture,
      seedUsers,
      moderatorId: moderator.id,
      moderatorUserId: moderator.userId,
    })

    await seedTopicInteractions(db, topics, seedUsers)
    console.log(
      `  ✓ ${sectionFixture.name} 主题完成: ${sectionFixture.topicCount} 条`,
    )
  }

  await rebuildForumCounters(db, [...touchedSectionIds])
  await rebuildForumHashtagCounters(db)
  await rebuildSeedUserCounters(db, seedUsers)
  console.log('  ✓ 论坛统计与用户统计完成')

  console.log('✅ 论坛演示数据完成')
}

async function resetForumSimulationData(db: Db) {
  await db.execute(sql`
    WITH target_sections AS (
      SELECT id
      FROM forum_section
      WHERE name LIKE 'codex_perf_%'
        OR name LIKE 'cp260524%'
        OR name LIKE 'cpri24%'
        OR (
          name IN (
            '新人报到',
            '新番追更',
            '漫画安利',
            '轻小说茶会',
            '角色厨集合',
            '同人创作',
            '谷子与痛包',
            'Cosplay 与漫展'
          )
          AND COALESCE(remark, '') = 'seed: 二次元论坛演示板块'
        )
    ),
    target_topics AS (
      SELECT id
      FROM forum_topic
      WHERE title LIKE 'codex_perf_%'
        OR title LIKE 'cp260524%'
        OR title LIKE 'cpri24%'
        OR section_id IN (SELECT id FROM target_sections)
    ),
    target_comments AS (
      SELECT id
      FROM user_comment
      WHERE target_type = ${FORUM_TOPIC_COMMENT_TARGET_TYPE}
        AND target_id IN (SELECT id FROM target_topics)
    ),
    deleted_mentions AS (
      DELETE FROM user_mention
      WHERE (source_type = ${MentionSourceTypeEnum.FORUM_TOPIC}
          AND source_id IN (SELECT id FROM target_topics))
        OR (source_type = ${MentionSourceTypeEnum.COMMENT}
          AND source_id IN (SELECT id FROM target_comments))
      RETURNING id
    ),
    deleted_hashtag_refs AS (
      DELETE FROM forum_hashtag_reference
      WHERE topic_id IN (SELECT id FROM target_topics)
      RETURNING id
    ),
    deleted_orphan_seed_hashtags AS (
      DELETE FROM forum_hashtag h
      WHERE h.create_source_type IN (
          ${ForumHashtagCreateSourceTypeEnum.TOPIC_BODY},
          ${ForumHashtagCreateSourceTypeEnum.COMMENT_BODY}
        )
        AND NOT EXISTS (
          SELECT 1
          FROM forum_hashtag_reference r
          WHERE r.hashtag_id = h.id
        )
      RETURNING id
    ),
    deleted_comment_likes AS (
      DELETE FROM user_like
      WHERE target_type = ${LikeTargetTypeEnum.COMMENT}
        AND target_id IN (SELECT id FROM target_comments)
      RETURNING id
    ),
    deleted_topic_likes AS (
      DELETE FROM user_like
      WHERE target_type = ${FORUM_TOPIC_LIKE_TARGET_TYPE}
        AND target_id IN (SELECT id FROM target_topics)
      RETURNING id
    ),
    deleted_topic_favorites AS (
      DELETE FROM user_favorite
      WHERE target_type = ${FORUM_TOPIC_FAVORITE_TARGET_TYPE}
        AND target_id IN (SELECT id FROM target_topics)
      RETURNING id
    ),
    deleted_topic_browses AS (
      DELETE FROM user_browse_log
      WHERE target_type = ${FORUM_TOPIC_BROWSE_TARGET_TYPE}
        AND target_id IN (SELECT id FROM target_topics)
      RETURNING id
    ),
    deleted_user_logs AS (
      DELETE FROM forum_user_action_log
      WHERE (target_type = ${ForumUserActionTargetTypeEnum.TOPIC}
          AND target_id IN (SELECT id FROM target_topics))
        OR (target_type = ${ForumUserActionTargetTypeEnum.COMMENT}
          AND target_id IN (SELECT id FROM target_comments))
      RETURNING id
    ),
    deleted_moderator_logs AS (
      DELETE FROM forum_moderator_action_log
      WHERE (target_type = ${ForumModeratorActionTargetTypeEnum.TOPIC}
          AND target_id IN (SELECT id FROM target_topics))
        OR (target_type = ${ForumModeratorActionTargetTypeEnum.COMMENT}
          AND target_id IN (SELECT id FROM target_comments))
      RETURNING id
    ),
    deleted_comments AS (
      DELETE FROM user_comment
      WHERE id IN (SELECT id FROM target_comments)
      RETURNING id
    ),
    deleted_topics AS (
      DELETE FROM forum_topic
      WHERE id IN (SELECT id FROM target_topics)
      RETURNING id
    ),
    deleted_perf_moderator_sections AS (
      DELETE FROM forum_moderator_section
      WHERE section_id IN (
        SELECT id
        FROM forum_section
        WHERE name LIKE 'codex_perf_%'
          OR name LIKE 'cp260524%'
          OR name LIKE 'cpri24%'
      )
      RETURNING section_id
    ),
    deleted_perf_applications AS (
      DELETE FROM forum_moderator_application
      WHERE section_id IN (
        SELECT id
        FROM forum_section
        WHERE name LIKE 'codex_perf_%'
          OR name LIKE 'cp260524%'
          OR name LIKE 'cpri24%'
      )
      RETURNING section_id
    ),
    deleted_perf_sections AS (
      DELETE FROM forum_section
      WHERE name LIKE 'codex_perf_%'
        OR name LIKE 'cp260524%'
        OR name LIKE 'cpri24%'
      RETURNING id
    )
    SELECT
      (SELECT COUNT(*) FROM deleted_topics) AS topic_count,
      (SELECT COUNT(*) FROM deleted_perf_sections) AS perf_section_count,
      (SELECT COUNT(*) FROM deleted_hashtag_refs) AS hashtag_ref_count,
      (SELECT COUNT(*) FROM deleted_mentions) AS mention_count,
      (SELECT COUNT(*) FROM deleted_orphan_seed_hashtags) AS hashtag_count
  `)

  await db.execute(sql`
    DELETE FROM forum_section_group g
    WHERE (g.name LIKE 'codex_perf_%'
        OR g.name LIKE 'cp260524%'
        OR g.name LIKE 'cpri24%')
      AND NOT EXISTS (
        SELECT 1 FROM forum_section s WHERE s.group_id = g.id
      )
  `)

  await db.execute(sql`
    DELETE FROM forum_hashtag h
    WHERE NOT EXISTS (
        SELECT 1
        FROM forum_hashtag_reference r
        WHERE r.hashtag_id = h.id
      )
  `)

  console.log('  ✓ 已清理历史 seed/压测论坛数据')
}

async function loadSeedUsers(db: Db) {
  const users = await db
    .select()
    .from(appUser)
    .where(
      and(
        inArray(appUser.account, [...SEED_READER_ACCOUNT_SLUGS]),
        eq(appUser.status, 1),
      ),
    )

  return users
    .filter((user) => !user.deletedAt)
    .sort(
      (left, right) =>
        SEED_READER_ACCOUNT_SLUGS.indexOf(left.account) -
        SEED_READER_ACCOUNT_SLUGS.indexOf(right.account),
    )
    .map((user) => ({
      id: user.id,
      account: user.account,
      nickname: user.nickname,
      lastLoginIp: user.lastLoginIp,
      lastLoginGeoCountry: user.lastLoginGeoCountry,
      lastLoginGeoProvince: user.lastLoginGeoProvince,
      lastLoginGeoCity: user.lastLoginGeoCity,
      lastLoginGeoIsp: user.lastLoginGeoIsp,
    }))
}

async function ensureForumModerator(db: Db, seedUsers: SeedUserRow[]) {
  const moderatorUser = seedUsers[2] ?? seedUsers[0]
  let moderator = await db.query.forumModerator.findFirst({
    where: eq(forumModerator.userId, moderatorUser.id),
  })

  const payload = {
    userId: moderatorUser.id,
    groupId: null,
    roleType: 1,
    permissions: [1, 2, 3, 4, 5, 6],
    isEnabled: true,
    remark: 'seed: 论坛演示超级版主',
  }

  if (!moderator) {
    ;[moderator] = await db.insert(forumModerator).values(payload).returning()
  } else {
    ;[moderator] = await db
      .update(forumModerator)
      .set(payload)
      .where(eq(forumModerator.id, moderator.id))
      .returning()
  }

  const targetSection = await db.query.forumSection.findFirst({
    where: and(
      eq(forumSection.name, '新番追更'),
      isNull(forumSection.deletedAt),
    ),
  })
  const applicant = seedUsers[0]
  if (targetSection && applicant) {
    const existingApplication =
      await db.query.forumModeratorApplication.findFirst({
        where: and(
          eq(forumModeratorApplication.applicantId, applicant.id),
          eq(forumModeratorApplication.sectionId, targetSection.id),
        ),
      })
    const applicationPayload = {
      applicantId: applicant.id,
      sectionId: targetSection.id,
      auditById: moderatorUser.id,
      status: 1,
      permissions: [1, 2, 5],
      reason: '长期整理追更楼和新番索引，希望协助维护讨论秩序。',
      auditReason: 'seed: 发帖质量稳定，通过演示申请。',
      remark: 'seed: 版主申请演示记录',
      auditAt: SEED_TIMELINE.previousDay,
    }
    if (!existingApplication) {
      await db.insert(forumModeratorApplication).values(applicationPayload)
    } else {
      await db
        .update(forumModeratorApplication)
        .set(applicationPayload)
        .where(eq(forumModeratorApplication.id, existingApplication.id))
    }
  }

  return { ...moderator, userId: moderatorUser.id }
}

async function ensureModeratorSection(
  db: Db,
  moderatorId: number,
  sectionId: number,
) {
  const existingRelation = await db.query.forumModeratorSection.findFirst({
    where: and(
      eq(forumModeratorSection.moderatorId, moderatorId),
      eq(forumModeratorSection.sectionId, sectionId),
    ),
  })

  const payload = {
    moderatorId,
    sectionId,
    permissions: [1, 2, 3, 4, 5],
  }

  if (!existingRelation) {
    await db.insert(forumModeratorSection).values(payload)
  } else {
    await db
      .update(forumModeratorSection)
      .set(payload)
      .where(
        and(
          eq(forumModeratorSection.moderatorId, moderatorId),
          eq(forumModeratorSection.sectionId, sectionId),
        ),
      )
  }
}

async function seedSectionTopics(
  db: Db,
  input: {
    section: typeof forumSection.$inferSelect
    sectionIndex: number
    sectionFixture: (typeof SECTION_FIXTURES)[number]
    seedUsers: SeedUserRow[]
    moderatorId: number
    moderatorUserId: number
  },
) {
  const topics: SeedTopicRow[] = []
  const usedTitles = new Set<string>()

  for (
    let topicIndex = 0;
    topicIndex < input.sectionFixture.topicCount;
    topicIndex += 1
  ) {
    const random = createRandom(
      hashSeed(`${input.sectionFixture.name}:${topicIndex}`),
    )
    const author =
      input.seedUsers[
        (input.sectionIndex * 11 + topicIndex * 7) % input.seedUsers.length
      ]
    const topicAgeMinutes =
      input.sectionIndex * 15000 + topicIndex * 41 + randomInt(random, 5, 35)
    const createdAt = addMinutes(SEED_TIMELINE.seedAt, -topicAgeMinutes)
    const title = buildTopicTitle(
      input.sectionFixture.name,
      random,
      usedTitles,
      topicIndex,
    )
    const topicEnrichment = buildTopicEnrichment({
      sectionName: input.sectionFixture.name,
      topicIndex,
      random,
      seedUsers: input.seedUsers,
      authorUserId: author.id,
    })
    const content = appendTopicEnrichment(
      buildTopicContent(input.sectionFixture.name, random, title, topicIndex),
      topicEnrichment,
      random,
    )
    const body = await buildMaterializedBody(db, {
      text: content,
      actorUserId: author.id,
      createSourceType: ForumHashtagCreateSourceTypeEnum.TOPIC_BODY,
      mentionTargets: topicEnrichment.mentions,
    })
    const isPinned = topicIndex < 2
    const isFeatured = topicIndex % 11 === 0 || topicIndex === 3

    const existingTopic = await db.query.forumTopic.findFirst({
      where: and(
        eq(forumTopic.sectionId, input.section.id),
        eq(forumTopic.title, title),
        isNull(forumTopic.deletedAt),
      ),
    })

    const topicPayload = {
      sectionId: input.section.id,
      userId: author.id,
      lastCommentUserId: existingTopic?.lastCommentUserId ?? null,
      auditById: input.moderatorUserId,
      title,
      ...body,
      images: [],
      videos: [],
      isPinned,
      isFeatured,
      isLocked: topicIndex % 97 === 0,
      isHidden: false,
      auditStatus: 1,
      auditRole: 0,
      auditReason: 'seed: 演示内容自动通过',
      auditAt: addMinutes(createdAt, 3),
      version: existingTopic?.version ?? 0,
      sensitiveWordHits: [],
      geoCountry: author.lastLoginGeoCountry,
      geoProvince: author.lastLoginGeoProvince,
      geoCity: author.lastLoginGeoCity,
      geoIsp: author.lastLoginGeoIsp,
      geoSource: 'seed',
      viewCount: existingTopic?.viewCount ?? 0,
      likeCount: existingTopic?.likeCount ?? 0,
      commentCount: existingTopic?.commentCount ?? 0,
      favoriteCount: existingTopic?.favoriteCount ?? 0,
      lastCommentAt: existingTopic?.lastCommentAt ?? createdAt,
      createdAt,
    }

    let currentTopic = existingTopic
    if (!currentTopic) {
      ;[currentTopic] = await db
        .insert(forumTopic)
        .values(topicPayload)
        .returning()
    } else {
      ;[currentTopic] = await db
        .update(forumTopic)
        .set(topicPayload)
        .where(eq(forumTopic.id, currentTopic.id))
        .returning()
    }

    await ensureForumUserActionLog(db, {
      userId: author.id,
      targetId: currentTopic.id,
      actionType: ForumUserActionTypeEnum.CREATE_TOPIC,
      targetType: ForumUserActionTargetTypeEnum.TOPIC,
      afterData: { title: currentTopic.title },
      ipAddress: author.lastLoginIp,
      createdAt,
    })

    await replaceSeedMentions(db, {
      sourceType: MentionSourceTypeEnum.FORUM_TOPIC,
      sourceId: currentTopic.id,
      mentionFacts: body.mentionFacts,
      createdAt,
    })
    await replaceSeedHashtagReferences(db, {
      sourceType: ForumHashtagReferenceSourceTypeEnum.TOPIC,
      sourceId: currentTopic.id,
      topicId: currentTopic.id,
      sectionId: currentTopic.sectionId,
      userId: currentTopic.userId,
      hashtagFacts: body.hashtagFacts,
    })

    if (isPinned || isFeatured) {
      await ensureModeratorTopicLog(db, {
        moderatorId: input.moderatorId,
        topicId: currentTopic.id,
        actionType: isPinned
          ? ForumModeratorActionTypeEnum.PIN_TOPIC
          : ForumModeratorActionTypeEnum.FEATURE_TOPIC,
        actionDescription: isPinned
          ? 'seed: 演示置顶主题'
          : 'seed: 演示精选主题',
        createdAt: addMinutes(createdAt, 4),
      })
    }

    topics.push({
      id: currentTopic.id,
      sectionId: currentTopic.sectionId,
      userId: currentTopic.userId,
      sectionName: input.sectionFixture.name,
      title: currentTopic.title,
      createdAt,
    })
  }

  return topics
}

async function seedTopicInteractions(
  db: Db,
  topics: SeedTopicRow[],
  seedUsers: SeedUserRow[],
) {
  for (const [topicOffset, topic] of topics.entries()) {
    const random = createRandom(hashSeed(`${topic.title}:interaction`))
    const comments = await seedTopicComments(db, topic, seedUsers, random)
    await seedTopicLikes(db, topic, seedUsers, random)
    await seedTopicFavorites(db, topic, seedUsers, random)
    await seedTopicBrowseLogs(db, topic, seedUsers, random)
    await seedCommentLikes(db, topic, comments, seedUsers, random)
    await rebuildTopicCounter(db, topic.id)

    if (topicOffset % 25 === 24) {
      console.log(`    · 已生成 ${topicOffset + 1} 条主题互动`)
    }
  }
}

async function seedTopicComments(
  db: Db,
  topic: SeedTopicRow,
  seedUsers: SeedUserRow[],
  random: () => number,
) {
  const plannedCount =
    topic.id % 7 === 0 ? randomInt(random, 5, 9) : randomInt(random, 0, 5)
  const comments: SeedCommentRow[] = []

  for (let index = 0; index < plannedCount; index += 1) {
    const commenter = seedUsers[(topic.id + index * 5) % seedUsers.length]
    const rootComment = comments.find((comment) => comment.floor === 1)
    const shouldReply = index > 1 && rootComment && random() < 0.28
    const commentEnrichment = buildCommentEnrichment({
      topic,
      commentIndex: index,
      commenterUserId: commenter.id,
      seedUsers,
      random,
    })
    const content = appendCommentEnrichment(
      buildCommentContent(random),
      commentEnrichment,
    )
    const body = await buildMaterializedBody(db, {
      text: content,
      actorUserId: commenter.id,
      createSourceType: ForumHashtagCreateSourceTypeEnum.COMMENT_BODY,
      mentionTargets: commentEnrichment.mentions,
    })
    const createdAt = addMinutes(
      topic.createdAt,
      12 + index * randomInt(random, 7, 38),
    )

    const existingComment = await db.query.userComment.findFirst({
      where: and(
        eq(userComment.targetType, FORUM_TOPIC_COMMENT_TARGET_TYPE),
        eq(userComment.targetId, topic.id),
        eq(userComment.userId, commenter.id),
        eq(userComment.content, content),
      ),
    })

    const commentPayload = {
      targetType: FORUM_TOPIC_COMMENT_TARGET_TYPE,
      targetId: topic.id,
      userId: commenter.id,
      ...body,
      floor: index + 1,
      replyToId: shouldReply ? rootComment.id : null,
      actualReplyToId: shouldReply ? rootComment.id : null,
      isHidden: false,
      auditStatus: 1,
      auditById: null,
      auditRole: 0,
      auditReason: 'seed: 演示评论自动通过',
      auditAt: addMinutes(createdAt, 2),
      likeCount: existingComment?.likeCount ?? 0,
      sensitiveWordHits: [],
      geoCountry: commenter.lastLoginGeoCountry,
      geoProvince: commenter.lastLoginGeoProvince,
      geoCity: commenter.lastLoginGeoCity,
      geoIsp: commenter.lastLoginGeoIsp,
      geoSource: 'seed',
      createdAt,
    }

    let currentComment = existingComment
    if (!currentComment) {
      ;[currentComment] = await db
        .insert(userComment)
        .values(commentPayload)
        .returning()
    } else {
      ;[currentComment] = await db
        .update(userComment)
        .set(commentPayload)
        .where(eq(userComment.id, currentComment.id))
        .returning()
    }

    await ensureForumUserActionLog(db, {
      userId: commenter.id,
      targetId: currentComment.id,
      actionType: ForumUserActionTypeEnum.CREATE_COMMENT,
      targetType: ForumUserActionTargetTypeEnum.COMMENT,
      afterData: { content },
      ipAddress: commenter.lastLoginIp,
      createdAt,
    })

    await replaceSeedMentions(db, {
      sourceType: MentionSourceTypeEnum.COMMENT,
      sourceId: currentComment.id,
      mentionFacts: body.mentionFacts,
      createdAt,
    })
    await replaceSeedHashtagReferences(db, {
      sourceType: ForumHashtagReferenceSourceTypeEnum.COMMENT,
      sourceId: currentComment.id,
      topicId: topic.id,
      sectionId: topic.sectionId,
      userId: commenter.id,
      hashtagFacts: body.hashtagFacts,
    })

    comments.push({
      id: currentComment.id,
      userId: currentComment.userId,
      floor: currentComment.floor,
      createdAt,
    })
  }

  return comments
}

async function seedTopicLikes(
  db: Db,
  topic: SeedTopicRow,
  seedUsers: SeedUserRow[],
  random: () => number,
) {
  const users = pickUniqueUsers(seedUsers, random, randomInt(random, 3, 14), [
    topic.userId,
  ])
  for (const user of users) {
    const existing = await db.query.userLike.findFirst({
      where: and(
        eq(userLike.targetType, FORUM_TOPIC_LIKE_TARGET_TYPE),
        eq(userLike.targetId, topic.id),
        eq(userLike.userId, user.id),
      ),
    })
    if (!existing) {
      await db.insert(userLike).values({
        targetType: FORUM_TOPIC_LIKE_TARGET_TYPE,
        targetId: topic.id,
        sceneType: SceneTypeEnum.FORUM_TOPIC,
        sceneId: topic.id,
        commentLevel: null,
        userId: user.id,
        createdAt: addMinutes(topic.createdAt, randomInt(random, 20, 360)),
      })
    }

    await ensureForumUserActionLog(db, {
      userId: user.id,
      targetId: topic.id,
      actionType: ForumUserActionTypeEnum.LIKE_TOPIC,
      targetType: ForumUserActionTargetTypeEnum.TOPIC,
      afterData: { liked: true },
      ipAddress: user.lastLoginIp,
      createdAt: addMinutes(topic.createdAt, randomInt(random, 20, 360)),
    })
  }
}

async function seedTopicFavorites(
  db: Db,
  topic: SeedTopicRow,
  seedUsers: SeedUserRow[],
  random: () => number,
) {
  const users = pickUniqueUsers(seedUsers, random, randomInt(random, 1, 7), [
    topic.userId,
  ])
  for (const user of users) {
    const existing = await db.query.userFavorite.findFirst({
      where: and(
        eq(userFavorite.targetType, FORUM_TOPIC_FAVORITE_TARGET_TYPE),
        eq(userFavorite.targetId, topic.id),
        eq(userFavorite.userId, user.id),
      ),
    })
    if (!existing) {
      await db.insert(userFavorite).values({
        targetType: FORUM_TOPIC_FAVORITE_TARGET_TYPE,
        targetId: topic.id,
        userId: user.id,
        createdAt: addMinutes(topic.createdAt, randomInt(random, 25, 420)),
      })
    }

    await ensureForumUserActionLog(db, {
      userId: user.id,
      targetId: topic.id,
      actionType: ForumUserActionTypeEnum.FAVORITE_TOPIC,
      targetType: ForumUserActionTargetTypeEnum.TOPIC,
      afterData: { favorited: true },
      ipAddress: user.lastLoginIp,
      createdAt: addMinutes(topic.createdAt, randomInt(random, 25, 420)),
    })
  }
}

async function seedTopicBrowseLogs(
  db: Db,
  topic: SeedTopicRow,
  seedUsers: SeedUserRow[],
  random: () => number,
) {
  const users = pickUniqueUsers(seedUsers, random, randomInt(random, 5, 18), [])
  for (const user of users) {
    const existing = await db.query.userBrowseLog.findFirst({
      where: and(
        eq(userBrowseLog.targetType, FORUM_TOPIC_BROWSE_TARGET_TYPE),
        eq(userBrowseLog.targetId, topic.id),
        eq(userBrowseLog.userId, user.id),
      ),
    })
    const payload = {
      targetType: FORUM_TOPIC_BROWSE_TARGET_TYPE,
      targetId: topic.id,
      userId: user.id,
      ipAddress: user.lastLoginIp,
      device: pick(['ios', 'android', 'web', 'tablet'], random),
      userAgent: FORUM_SEED_USER_AGENT,
      viewedAt: addMinutes(topic.createdAt, randomInt(random, 5, 480)),
    }
    if (!existing) {
      await db.insert(userBrowseLog).values(payload)
    } else {
      await db
        .update(userBrowseLog)
        .set(payload)
        .where(eq(userBrowseLog.id, existing.id))
    }
  }
}

async function seedCommentLikes(
  db: Db,
  topic: SeedTopicRow,
  comments: SeedCommentRow[],
  seedUsers: SeedUserRow[],
  random: () => number,
) {
  for (const comment of comments) {
    const users = pickUniqueUsers(seedUsers, random, randomInt(random, 0, 5), [
      comment.userId,
    ])
    for (const user of users) {
      const existing = await db.query.userLike.findFirst({
        where: and(
          eq(userLike.targetType, LikeTargetTypeEnum.COMMENT),
          eq(userLike.targetId, comment.id),
          eq(userLike.userId, user.id),
        ),
      })
      if (!existing) {
        await db.insert(userLike).values({
          targetType: LikeTargetTypeEnum.COMMENT,
          targetId: comment.id,
          sceneType: SceneTypeEnum.FORUM_TOPIC,
          sceneId: topic.id,
          commentLevel:
            comment.floor === 1
              ? CommentLevelEnum.ROOT
              : CommentLevelEnum.REPLY,
          userId: user.id,
          createdAt: addMinutes(comment.createdAt, randomInt(random, 4, 120)),
        })
      }

      await ensureForumUserActionLog(db, {
        userId: user.id,
        targetId: comment.id,
        actionType: ForumUserActionTypeEnum.LIKE_COMMENT,
        targetType: ForumUserActionTargetTypeEnum.COMMENT,
        afterData: { liked: true },
        ipAddress: user.lastLoginIp,
        createdAt: addMinutes(comment.createdAt, randomInt(random, 4, 120)),
      })
    }

    const likes = await db.query.userLike.findMany({
      where: and(
        eq(userLike.targetType, LikeTargetTypeEnum.COMMENT),
        eq(userLike.targetId, comment.id),
      ),
    })
    await db
      .update(userComment)
      .set({ likeCount: likes.length })
      .where(eq(userComment.id, comment.id))
  }
}

async function rebuildTopicCounter(db: Db, topicId: number) {
  const comments = await db.query.userComment.findMany({
    where: and(
      eq(userComment.targetType, FORUM_TOPIC_COMMENT_TARGET_TYPE),
      eq(userComment.targetId, topicId),
      eq(userComment.auditStatus, 1),
      eq(userComment.isHidden, false),
      isNull(userComment.deletedAt),
    ),
  })
  const likes = await db.query.userLike.findMany({
    where: and(
      eq(userLike.targetType, FORUM_TOPIC_LIKE_TARGET_TYPE),
      eq(userLike.targetId, topicId),
    ),
  })
  const favorites = await db.query.userFavorite.findMany({
    where: and(
      eq(userFavorite.targetType, FORUM_TOPIC_FAVORITE_TARGET_TYPE),
      eq(userFavorite.targetId, topicId),
    ),
  })
  const browseLogs = await db.query.userBrowseLog.findMany({
    where: and(
      eq(userBrowseLog.targetType, FORUM_TOPIC_BROWSE_TARGET_TYPE),
      eq(userBrowseLog.targetId, topicId),
    ),
  })
  const latestComment = [...comments]
    .sort(
      (left, right) =>
        (left.createdAt?.getTime?.() ?? 0) -
        (right.createdAt?.getTime?.() ?? 0),
    )
    .at(-1)

  await db
    .update(forumTopic)
    .set({
      commentCount: comments.length,
      likeCount: likes.length,
      favoriteCount: favorites.length,
      viewCount: browseLogs.length,
      lastCommentUserId: latestComment?.userId ?? null,
      lastCommentAt: latestComment?.createdAt ?? null,
    })
    .where(eq(forumTopic.id, topicId))
}

async function rebuildForumCounters(db: Db, sectionIds: number[]) {
  if (sectionIds.length === 0) {
    return
  }

  const sections = await db.query.forumSection.findMany({
    where: inArray(forumSection.id, sectionIds),
  })

  for (const section of sections) {
    const topics = await db.query.forumTopic.findMany({
      where: and(
        eq(forumTopic.sectionId, section.id),
        eq(forumTopic.auditStatus, 1),
        eq(forumTopic.isHidden, false),
        isNull(forumTopic.deletedAt),
      ),
    })
    const lastTopic = [...topics]
      .sort((left, right) => {
        const leftAt = left.lastCommentAt ?? left.createdAt
        const rightAt = right.lastCommentAt ?? right.createdAt
        return (leftAt?.getTime?.() ?? 0) - (rightAt?.getTime?.() ?? 0)
      })
      .at(-1)

    await db
      .update(forumSection)
      .set({
        topicCount: topics.length,
        commentCount: topics.reduce(
          (sum, topic) => sum + topic.commentCount,
          0,
        ),
        lastTopicId: lastTopic?.id ?? null,
        lastPostAt: lastTopic?.lastCommentAt ?? lastTopic?.createdAt ?? null,
      })
      .where(eq(forumSection.id, section.id))
  }
}

async function rebuildForumHashtagCounters(db: Db) {
  await db.execute(sql`
    WITH stats AS (
      SELECT
        h.id AS hashtag_id,
        COALESCE(
          SUM(
            CASE
              WHEN r.is_source_visible = true
                AND r.source_type = ${ForumHashtagReferenceSourceTypeEnum.TOPIC}
              THEN 1
              ELSE 0
            END
          ),
          0
        )::int AS topic_ref_count,
        COALESCE(
          SUM(
            CASE
              WHEN r.is_source_visible = true
                AND r.source_type = ${ForumHashtagReferenceSourceTypeEnum.COMMENT}
              THEN 1
              ELSE 0
            END
          ),
          0
        )::int AS comment_ref_count,
        MAX(
          CASE
            WHEN r.is_source_visible = true THEN r.created_at
            ELSE NULL
          END
        ) AS last_referenced_at
      FROM forum_hashtag h
      LEFT JOIN forum_hashtag_reference r ON r.hashtag_id = h.id
      GROUP BY h.id
    )
    UPDATE forum_hashtag h
    SET
      topic_ref_count = stats.topic_ref_count,
      comment_ref_count = stats.comment_ref_count,
      last_referenced_at = stats.last_referenced_at
    FROM stats
    WHERE h.id = stats.hashtag_id
  `)
}

async function rebuildSeedUserCounters(db: Db, seedUsers: SeedUserRow[]) {
  for (const user of seedUsers) {
    const comments = await db.query.userComment.findMany({
      where: and(
        eq(userComment.userId, user.id),
        isNull(userComment.deletedAt),
      ),
    })
    const likes = await db.query.userLike.findMany({
      where: eq(userLike.userId, user.id),
    })
    const favorites = await db.query.userFavorite.findMany({
      where: eq(userFavorite.userId, user.id),
    })
    const topics = await db.query.forumTopic.findMany({
      where: and(eq(forumTopic.userId, user.id), isNull(forumTopic.deletedAt)),
    })
    const commentIds = comments.map((comment) => comment.id)
    const topicIds = topics.map((topic) => topic.id)
    const commentReceivedLikes =
      commentIds.length > 0
        ? await db.query.userLike.findMany({
            where: and(
              eq(userLike.targetType, LikeTargetTypeEnum.COMMENT),
              inArray(userLike.targetId, commentIds),
            ),
          })
        : []
    const topicReceivedLikes =
      topicIds.length > 0
        ? await db.query.userLike.findMany({
            where: and(
              eq(userLike.targetType, FORUM_TOPIC_LIKE_TARGET_TYPE),
              inArray(userLike.targetId, topicIds),
            ),
          })
        : []
    const topicReceivedFavorites =
      topicIds.length > 0
        ? await db.query.userFavorite.findMany({
            where: and(
              eq(userFavorite.targetType, FORUM_TOPIC_FAVORITE_TARGET_TYPE),
              inArray(userFavorite.targetId, topicIds),
            ),
          })
        : []

    const countPayload = {
      userId: user.id,
      commentCount: comments.length,
      likeCount: likes.length,
      favoriteCount: favorites.length,
      forumTopicCount: topics.length,
      commentReceivedLikeCount: commentReceivedLikes.length,
      forumTopicReceivedLikeCount: topicReceivedLikes.length,
      forumTopicReceivedFavoriteCount: topicReceivedFavorites.length,
    }
    const existingCount = await db.query.appUserCount.findFirst({
      where: eq(appUserCount.userId, user.id),
    })

    if (!existingCount) {
      await db.insert(appUserCount).values(countPayload)
    } else {
      await db
        .update(appUserCount)
        .set(countPayload)
        .where(eq(appUserCount.userId, user.id))
    }
  }
}

async function ensureForumUserActionLog(
  db: Db,
  input: {
    userId: number
    targetId: number
    actionType: ForumUserActionTypeEnum
    targetType: ForumUserActionTargetTypeEnum
    afterData: Record<string, string | number | boolean>
    ipAddress: string | null
    createdAt: Date
  },
) {
  const existing = await db.query.forumUserActionLog.findFirst({
    where: and(
      eq(forumUserActionLog.userId, input.userId),
      eq(forumUserActionLog.targetId, input.targetId),
      eq(forumUserActionLog.actionType, input.actionType),
      eq(forumUserActionLog.targetType, input.targetType),
    ),
  })

  if (!existing) {
    await db.insert(forumUserActionLog).values({
      userId: input.userId,
      targetId: input.targetId,
      actionType: input.actionType,
      targetType: input.targetType,
      beforeData: null,
      afterData: JSON.stringify(input.afterData),
      ipAddress: input.ipAddress,
      userAgent: FORUM_SEED_USER_AGENT,
      geoSource: 'seed',
      createdAt: input.createdAt,
    })
  }
}

async function ensureModeratorTopicLog(
  db: Db,
  input: {
    moderatorId: number
    topicId: number
    actionType: ForumModeratorActionTypeEnum
    actionDescription: string
    createdAt: Date
  },
) {
  const existing = await db.query.forumModeratorActionLog.findFirst({
    where: and(
      eq(forumModeratorActionLog.moderatorId, input.moderatorId),
      eq(forumModeratorActionLog.targetId, input.topicId),
      eq(forumModeratorActionLog.actionType, input.actionType),
      eq(
        forumModeratorActionLog.targetType,
        ForumModeratorActionTargetTypeEnum.TOPIC,
      ),
    ),
  })

  if (!existing) {
    await db.insert(forumModeratorActionLog).values({
      moderatorId: input.moderatorId,
      targetId: input.topicId,
      actionType: input.actionType,
      targetType: ForumModeratorActionTargetTypeEnum.TOPIC,
      actionDescription: input.actionDescription,
      beforeData: JSON.stringify({ seed: true }),
      afterData: JSON.stringify({ seed: true }),
      createdAt: input.createdAt,
    })
  }
}

async function replaceSeedMentions(
  db: Db,
  input: {
    sourceType: MentionSourceTypeEnum
    sourceId: number
    mentionFacts: SeedMentionFact[]
    createdAt: Date
  },
) {
  await db
    .delete(userMention)
    .where(
      and(
        eq(userMention.sourceType, input.sourceType),
        eq(userMention.sourceId, input.sourceId),
      ),
    )

  if (input.mentionFacts.length === 0) {
    return
  }

  await db.insert(userMention).values(
    input.mentionFacts.map((mention) => ({
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      mentionedUserId: mention.userId,
      startOffset: mention.start,
      endOffset: mention.end,
      notifiedAt: null,
      createdAt: input.createdAt,
    })),
  )
}

async function replaceSeedHashtagReferences(
  db: Db,
  input: {
    sourceType: ForumHashtagReferenceSourceTypeEnum
    sourceId: number
    topicId: number
    sectionId: number
    userId: number
    hashtagFacts: SeedHashtagFact[]
  },
) {
  await db
    .delete(forumHashtagReference)
    .where(
      and(
        eq(forumHashtagReference.sourceType, input.sourceType),
        eq(forumHashtagReference.sourceId, input.sourceId),
      ),
    )

  if (input.hashtagFacts.length === 0) {
    return
  }

  await db.insert(forumHashtagReference).values(
    input.hashtagFacts.map((fact) => ({
      hashtagId: fact.hashtagId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      topicId: input.topicId,
      sectionId: input.sectionId,
      userId: input.userId,
      occurrenceCount: fact.occurrenceCount,
      sourceAuditStatus: AuditStatusEnum.APPROVED,
      sourceIsHidden: false,
      isSourceVisible: true,
    })),
  )
}

function buildTopicEnrichment(input: {
  sectionName: string
  topicIndex: number
  random: () => number
  seedUsers: SeedUserRow[]
  authorUserId: number
}) {
  const sectionTags = SECTION_HASHTAGS[input.sectionName] ?? COMMON_HASHTAGS
  const hashtags = [
    pick(sectionTags, input.random),
    input.topicIndex % 3 === 0
      ? pick(COMMON_HASHTAGS, input.random)
      : pick(sectionTags, input.random),
  ].filter((item, index, array) => array.indexOf(item) === index)
  const mentionCount =
    input.topicIndex % 10 === 0 ? 2 : input.topicIndex % 2 === 0 ? 1 : 0
  const mentions = pickUniqueUsers(
    input.seedUsers,
    input.random,
    mentionCount,
    [input.authorUserId],
  ).map(toMentionTarget)

  return {
    hashtags,
    mentions,
  }
}

function appendTopicEnrichment(
  baseContent: string,
  enrichment: {
    hashtags: string[]
    mentions: SeedMentionTarget[]
  },
  random: () => number,
) {
  const hashtagText = formatHashtags(enrichment.hashtags)
  const mentionText = formatMentions(enrichment.mentions)

  if (mentionText && hashtagText) {
    return `${pick(
      [
        `想听听 ${mentionText} 的看法，也先挂 ${hashtagText}。`,
        `${mentionText} 有空也帮我看看，先归到 ${hashtagText}。`,
        `先放进 ${hashtagText}，也想听听 ${mentionText} 有没有不同经验。`,
      ],
      random,
    )}\n\n${baseContent}`
  }

  if (hashtagText) {
    return `${pick(
      [
        `先放进 ${hashtagText}，以后也方便同好翻到。`,
        `这个问题应该可以归到 ${hashtagText}，欢迎后来的人继续补充。`,
        `顺手打个 ${hashtagText}，希望能收集到更多真实经验。`,
      ],
      random,
    )}\n\n${baseContent}`
  }

  return baseContent
}

function buildCommentEnrichment(input: {
  topic: SeedTopicRow
  commentIndex: number
  commenterUserId: number
  seedUsers: SeedUserRow[]
  random: () => number
}) {
  const mentions =
    input.commentIndex % 3 === 0
      ? pickUniqueUsers(input.seedUsers, input.random, 1, [
          input.commenterUserId,
        ]).map(toMentionTarget)
      : []
  const sectionTags =
    SECTION_HASHTAGS[input.topic.sectionName] ?? COMMON_HASHTAGS
  const hashtags =
    input.commentIndex % 4 === 0 ? [pick(sectionTags, input.random)] : []

  return {
    hashtags,
    mentions,
  }
}

function appendCommentEnrichment(
  baseContent: string,
  enrichment: {
    hashtags: string[]
    mentions: SeedMentionTarget[]
  },
) {
  const mentionText = formatMentions(enrichment.mentions)
  const hashtagText = formatHashtags(enrichment.hashtags)
  if (!mentionText && !hashtagText) {
    return baseContent
  }

  const parts = [
    mentionText ? `也想听听 ${mentionText} 怎么看` : '',
    hashtagText ? `先归到 ${hashtagText}` : '',
  ].filter(Boolean)

  return `${baseContent}\n\n${parts.join('，')}。`
}

function toMentionTarget(user: SeedUserRow): SeedMentionTarget {
  return {
    userId: user.id,
    nickname: user.nickname,
  }
}

function formatHashtags(hashtags: readonly string[]) {
  return hashtags.map((item) => `#${item}`).join(' ')
}

function formatMentions(mentions: readonly SeedMentionTarget[]) {
  return mentions.map((item) => `@${item.nickname}`).join('、')
}

function buildTopicTitle(
  sectionName: string,
  random: () => number,
  usedTitles: Set<string>,
  topicIndex: number,
) {
  let title = ''

  for (let attempt = 0; attempt < 20; attempt += 1) {
    title = buildRealisticTopicTitle(sectionName, random, topicIndex + attempt)
    if (!usedTitles.has(title)) {
      usedTitles.add(title)
      return title
    }
  }

  const fallback = buildUniqueFallbackTitle(
    title,
    random,
    usedTitles,
    topicIndex,
  )
  usedTitles.add(fallback)
  return fallback
}

function buildUniqueFallbackTitle(
  title: string,
  random: () => number,
  usedTitles: Set<string>,
  topicIndex: number,
) {
  const suffixes = [
    '补充',
    '另开一楼',
    '后续',
    '换个角度',
    '集中聊',
    '二刷记录',
  ]

  for (const suffix of suffixes) {
    const fallback = `${title}（${suffix}）`
    if (!usedTitles.has(fallback)) {
      return fallback
    }
  }

  return `${title}（${pick(suffixes, random)} ${topicIndex + 1}）`
}

function buildRealisticTopicTitle(
  sectionName: string,
  random: () => number,
  topicIndex: number,
) {
  const pool = getRealisticTopicPool(sectionName)
  if (!pool) {
    const fallbackPool = SECTION_TOPIC_POOLS[sectionName]
    return `${pick(fallbackPool.subjects, random)}${pick(
      fallbackPool.angles,
      random,
    )}，${pick(COMMON_SUFFIXES, random)}`
  }

  const work = pick(pool.works, random)
  const situation = fillTopicPlaceholder(
    pick(pool.situations, random),
    topicIndex,
  )
  const question = fillTopicPlaceholder(
    pick(pool.questions, random),
    topicIndex,
  )
  const tag = pick(
    ['', '｜轻微剧透', '｜动画党视角', '｜原作党慎入', '｜求建议'],
    random,
  )

  switch (sectionName) {
    case '新人报到':
      return pick(
        [
          `新人报道｜${situation}，想问问${question}`,
          `从${work}入坑后才发现讨论区很深，先来打个招呼`,
          `第一次在站里发帖：${question}？`,
          `刚补完${work}，想找个能慢慢聊剧情的地方`,
          `社恐新人报到，最近在${situation}`,
          `补番清单越列越长，想听听补完${work}后该接哪部`,
        ],
        random,
      )
    case '新番追更':
      return pick(
        [
          `【本周集中】${work}${situation}，${question}？${tag}`,
          `${work}${situation}这段演出是不是有点太稳了？`,
          `动画党追平${work}，现在去补原作会不会太早`,
          `本季还在追${work}的人多吗，想开个每周楼`,
          `${work}这话看完有点睡不着，想听听不同解读`,
          `只聊动画进度：${work}${situation}观感记录`,
        ],
        random,
      )
    case '漫画安利':
      return pick(
        [
          `安利${work}：不是大开大合，但后劲真的很长`,
          `${work}${situation}，突然理解为什么有人反复推荐`,
          `有没有类似${work}这种慢热但稳定的漫画`,
          `漫画党求聊：${question}？`,
          `刚买了${work}实体书，纸质版体验比预想中好`,
          `冷门安利不剧透：${work}适合周末慢慢读`,
        ],
        random,
      )
    case '轻小说茶会':
      return pick(
        [
          `${work}${situation}，翻译和节奏想单独聊聊`,
          `书荒求推：像${work}这样读起来稳的轻小说还有吗`,
          `动画党补${work}原作，应该从哪一卷开始比较舒服`,
          `${work}后记信息量有点大，感觉下一卷要转调`,
          `轻小说茶会｜${question}？`,
          `台版/简中版对比看${work}，有些句子差异挺明显`,
        ],
        random,
      )
    case '角色厨集合':
      return pick(
        [
          `角色厨发言：${work}里${situation}，我到现在还没走出来`,
          `${work}这个角色不是完美的人，但我很吃这条线`,
          `二刷${work}才发现，前面几个镜头其实早就在铺了`,
          `求冷静讨论：${question}？${tag}`,
          `${work}名场面回看，感觉台词比第一次看更重`,
          `不吵架聊聊：${work}这段关系到底算糖还是刀`,
        ],
        random,
      )
    case '同人创作':
      return pick(
        [
          `【求建议】${work}同人${situation}，${question}？`,
          `第一次做${work}无料，印量和排版想听听经验`,
          `${work}短篇写到一半发现角色声音不对，怎么改才不 OOC`,
          `${work}手书分镜求助：${question}？`,
          `${work}互评楼可以开吗，想找人看一段短篇草稿`,
          `${work}本命生贺赶稿中，越修越不像自己怎么办`,
        ],
        random,
      )
    case '谷子与痛包':
      return pick(
        [
          `${work}${situation}，${question}？`,
          `${work}痛包配色求意见：想做日常一点但又怕太空`,
          `${work}谷圈新手求问，交换前怎么确认品相比较稳`,
          `${work}本命新图一出预算表就失效了，有人也在纠结吗`,
          `${work}小卡和吧唧收纳爆了，想看大家的收纳方案`,
          `${work}官谷和同人谷同时上新，你们一般怎么取舍`,
        ],
        random,
      )
    case 'Cosplay 与漫展':
      return pick(
        [
          `第一次出${work}，${question}？`,
          `${situation}，想问问有经验的老师怎么补救`,
          `BW/CP 准备清单：这次出${work}，寄存和补妆怎么安排`,
          `${work}摄影沟通求模板，想提前说清楚想要的氛围`,
          `夏天出${work}真的太消耗体力了，大家怎么防中暑`,
          `${work}场照返图不太满意，怎么沟通比较礼貌`,
        ],
        random,
      )
    default: {
      const fallbackPool = SECTION_TOPIC_POOLS[sectionName]
      return `${pick(fallbackPool.subjects, random)}${pick(
        fallbackPool.angles,
        random,
      )}，${pick(COMMON_SUFFIXES, random)}`
    }
  }
}

function buildTopicContent(
  sectionName: string,
  random: () => number,
  title: string,
  topicIndex: number,
) {
  const pool = getRealisticTopicPool(sectionName)
  if (!pool) {
    const fallbackPool = SECTION_TOPIC_POOLS[sectionName]
    return [
      pick(fallbackPool.details, random),
      `我比较在意的是${pick(fallbackPool.angles, random)}，但又怕自己带着滤镜看得太重。`,
      `所以想问问大家：${pick(fallbackPool.questions, random)} 如果有相反意见也欢迎说，别吵起来就好。`,
    ].join('\n\n')
  }

  const situation = fillTopicPlaceholder(
    pick(pool.situations, random),
    topicIndex,
  )
  const question = fillTopicPlaceholder(
    pick(pool.questions, random),
    topicIndex,
  )
  const detail = pick(pool.details, random)
  const ending = pick(pool.endings, random)

  return [
    buildContentOpening(sectionName, title, situation, random),
    detail,
    buildDiscussionPrompt(question, random),
    ending,
  ].join('\n\n')
}

function buildContentOpening(
  sectionName: string,
  title: string,
  situation: string,
  random: () => number,
) {
  const cleanTitle = title.replace(/[｜:：?？].*$/, '')

  switch (sectionName) {
    case '新人报到':
      return pick(
        [
          `第一次在这里开主题，有点紧张。最近${situation}，才发现只看推荐和真正参与讨论完全是两种体验。`,
          '先来认真报到一下，想找个能慢慢聊作品、角色和补番进度的地方。',
          '标题里这个问题困扰我好几天了，所以还是鼓起勇气开一楼问问。',
        ],
        random,
      )
    case '新番追更':
      return pick(
        [
          '昨晚看完以后一直惦记这段，所以单独开一楼。',
          '这一话看完有点想回放，尤其是标题里提到的那个点。',
          `先按动画党视角聊，${cleanTitle}这块我还挺想听不同解读。`,
        ],
        random,
      )
    case '漫画安利':
      return pick(
        [
          `最近补漫画的速度不快，但这一部让我连续翻了好几晚。${situation}的时候，感觉前面很多细节突然接上了。`,
          '这楼尽量不剧透关键转折，主要聊阅读体验和适不适合安利给别人。',
          '本来只是随手翻两话，结果越读越觉得它不是简介能概括的类型。',
        ],
        random,
      )
    case '轻小说茶会':
      return pick(
        [
          `这两天睡前都在读，刚好遇到${situation}这个阶段。轻小说有时候很吃翻译和语气，所以想听听大家的读法。`,
          '最近有点书荒，翻了几本以后反而更想听听同好怎么筛书。',
          '这楼不拉踩版本，主要想聊阅读顺不顺、角色声音立不立得住。',
        ],
        random,
      )
    case '角色厨集合':
      return pick(
        [
          `先承认这楼有角色厨滤镜，但我想尽量冷静一点聊。${situation}这个点，比第一次看时更戳我。`,
          '这不是想把角色说成完美，只是想把几个容易被忽略的小动作拆开聊聊。',
          '二刷以后很多情绪都变重了，所以开楼收一下不同理解。',
        ],
        random,
      )
    case '同人创作':
      return pick(
        [
          `这次不是发成品，是来求一点能落地的建议。${situation}，越改越发现自己卡在很具体的小地方。`,
          '先说明是草稿阶段，想听具体能改的点，不太需要只夸好听。',
          '最近赶稿赶到有点迷糊，想找同好帮我校一下方向是不是歪了。',
        ],
        random,
      )
    case '谷子与痛包':
      return pick(
        [
          `本来以为这次能理性一点，结果还是被图和配色拿捏了。${situation}之后，预算和收纳都开始报警。`,
          '先不挂具体店铺，只想聊聊选择和收纳，不想把楼带成吵架现场。',
          '谷子买的时候很快乐，真正到手以后才发现品相、展示和收纳都是功课。',
        ],
        random,
      )
    case 'Cosplay 与漫展':
      return pick(
        [
          `准备清单越列越长，才发现出一次真的不只是衣服和假毛。${situation}这件事我有点没把握。`,
          '新手先求稳，不想第一次就把体力和预算都拉爆，所以来问问过来人。',
          '这楼主要想收集实操经验，妆造、交通、摄影沟通都可以聊。',
        ],
        random,
      )
    default:
      return cleanTitle
  }
}

function buildDiscussionPrompt(question: string, random: () => number) {
  const cleanQuestion = question.replace(/[?？]$/, '')

  return pick(
    [
      `想问问大家：${cleanQuestion}？如果有相反意见也欢迎，别吵起来就好。`,
      `主要想听听过来人的经验，尤其是「${cleanQuestion}」这块。`,
      `我现在拿不准这个问题，所以想收集一下真实反馈：${cleanQuestion}？`,
      '如果你们也遇到过类似情况，可以说说最后是怎么处理的。',
    ],
    random,
  )
}

function fillTopicPlaceholder(text: string, topicIndex: number) {
  return text
    .replace('{episode}', String((topicIndex % 12) + 1))
    .replace('{volume}', String((topicIndex % 8) + 1))
}

function getRealisticTopicPool(sectionName: string) {
  if (sectionName in SECTION_REALISTIC_POOLS) {
    return SECTION_REALISTIC_POOLS[
      sectionName as keyof typeof SECTION_REALISTIC_POOLS
    ]
  }

  return null
}

function buildCommentContent(random: () => number) {
  return pick(COMMENT_TEXTS, random)
}

async function buildMaterializedBody(
  db: Db,
  input: {
    text: string
    actorUserId: number
    createSourceType: ForumHashtagCreateSourceTypeEnum
    mentionTargets: SeedMentionTarget[]
  },
): Promise<SeedMaterializedBody> {
  const bodyWithMentions = createBodyDocFromPlainText(input.text, {
    mentions: buildMentionSnapshots(input.text, input.mentionTargets),
  })
  const { body, hashtagFacts } = await materializeSeedHashtags(db, {
    body: bodyWithMentions,
    actorUserId: input.actorUserId,
    createSourceType: input.createSourceType,
  })
  const compiled = compileSeedBody(body)

  return {
    html: renderBodyHtml(body),
    content: compiled.plainText,
    body,
    bodyVersion: BODY_VERSION_V1,
    contentPreview: buildForumTopicContentPreview(compiled.bodyTokens),
    mentionFacts: compiled.mentionFacts,
    hashtagFacts,
  }
}

function buildMentionSnapshots(
  text: string,
  mentionTargets: SeedMentionTarget[],
) {
  const snapshots: Array<{
    userId: number
    nickname: string
    start: number
    end: number
  }> = []
  let cursor = 0

  for (const target of mentionTargets) {
    const label = `@${target.nickname}`
    const start = text.indexOf(label, cursor)
    if (start < 0) {
      continue
    }
    const end = start + label.length
    snapshots.push({
      userId: target.userId,
      nickname: target.nickname,
      start,
      end,
    })
    cursor = end
  }

  return snapshots
}

async function materializeSeedHashtags(
  db: Db,
  input: {
    body: BodyDoc
    actorUserId: number
    createSourceType: ForumHashtagCreateSourceTypeEnum
  },
) {
  const candidates = collectSeedHashtagCandidates(input.body)
  if (candidates.length === 0) {
    return {
      body: input.body,
      hashtagFacts: [] as SeedHashtagFact[],
    }
  }

  const hashtagMap = await ensureSeedHashtagRecords(db, {
    candidates,
    actorUserId: input.actorUserId,
    createSourceType: input.createSourceType,
  })

  return rewriteSeedBodyHashtags(input.body, hashtagMap)
}

function collectSeedHashtagCandidates(body: BodyDoc) {
  const candidates: SeedHashtagCandidate[] = []

  const collectInlineNodes = (nodes: BodyInlineNode[]) => {
    for (const node of nodes) {
      if (node.type === 'text') {
        candidates.push(...extractSeedHashtagCandidates(node.text))
      }
    }
  }

  for (const block of body.content) {
    if (block.type === 'bulletList' || block.type === 'orderedList') {
      for (const item of block.content) {
        collectInlineNodes(item.content)
      }
      continue
    }

    collectInlineNodes(block.content)
  }

  return [
    ...new Map(candidates.map((item) => [item.slug, item] as const)).values(),
  ]
}

function extractSeedHashtagCandidates(text: string) {
  const candidates: SeedHashtagCandidate[] = []
  for (const match of text.matchAll(
    new RegExp(FORUM_HASHTAG_TEXT_REGEX.source, FORUM_HASHTAG_TEXT_REGEX.flags),
  )) {
    const displayName = normalizeSeedHashtagDisplayName(match[1] ?? '')
    const slug = normalizeSeedHashtagSlug(displayName)
    if (displayName && slug) {
      candidates.push({ slug, displayName })
    }
  }

  return candidates
}

async function ensureSeedHashtagRecords(
  db: Db,
  input: {
    candidates: SeedHashtagCandidate[]
    actorUserId: number
    createSourceType: ForumHashtagCreateSourceTypeEnum
  },
) {
  const slugs = input.candidates.map((item) => item.slug)
  const existingRows = slugs.length
    ? await db
        .select()
        .from(forumHashtag)
        .where(inArray(forumHashtag.slug, slugs))
    : []
  const rowBySlug = new Map(existingRows.map((row) => [row.slug, row]))

  for (const candidate of input.candidates) {
    const existing = rowBySlug.get(candidate.slug)
    const visiblePayload = {
      displayName: candidate.displayName.slice(0, 64),
      auditStatus: AuditStatusEnum.APPROVED,
      isHidden: false,
      auditReason: 'seed: 演示话题自动通过',
      auditAt: SEED_TIMELINE.previousDay,
      deletedAt: null,
    }

    if (!existing) {
      const [created] = await db
        .insert(forumHashtag)
        .values({
          slug: candidate.slug,
          ...visiblePayload,
          createSourceType: input.createSourceType,
          createdByUserId: input.actorUserId,
          sensitiveWordHits: null,
        })
        .returning()
      rowBySlug.set(candidate.slug, created)
      continue
    }

    const [updated] = await db
      .update(forumHashtag)
      .set(visiblePayload)
      .where(eq(forumHashtag.id, existing.id))
      .returning()
    rowBySlug.set(candidate.slug, updated)
  }

  return new Map(
    [...rowBySlug.values()].map((row) => [
      row.slug,
      {
        id: row.id,
        slug: row.slug,
        displayName: row.displayName,
      },
    ]),
  )
}

function rewriteSeedBodyHashtags(
  body: BodyDoc,
  hashtagMap: Map<string, SeedHashtagRecord>,
) {
  const occurrenceMap = new Map<number, number>()

  const rewriteInlineNodes = (nodes: BodyInlineNode[]) => {
    const rewritten: BodyInlineNode[] = []

    for (const node of nodes) {
      if (node.type !== 'text') {
        rewritten.push(node)
        continue
      }

      let cursor = 0
      for (const match of node.text.matchAll(
        new RegExp(
          FORUM_HASHTAG_TEXT_REGEX.source,
          FORUM_HASHTAG_TEXT_REGEX.flags,
        ),
      )) {
        const displayName = normalizeSeedHashtagDisplayName(match[1] ?? '')
        const slug = normalizeSeedHashtagSlug(displayName)
        const hashtag = hashtagMap.get(slug)
        const start = match.index ?? 0
        const end = start + match[0].length

        if (start > cursor) {
          rewritten.push({
            type: 'text',
            text: node.text.slice(cursor, start),
            marks: node.marks,
          })
        }

        if (!hashtag) {
          rewritten.push({
            type: 'text',
            text: node.text.slice(start, end),
            marks: node.marks,
          })
        } else {
          occurrenceMap.set(
            hashtag.id,
            (occurrenceMap.get(hashtag.id) ?? 0) + 1,
          )
          rewritten.push({
            type: 'forumHashtag',
            hashtagId: hashtag.id,
            slug: hashtag.slug,
            displayName: hashtag.displayName,
          })
        }

        cursor = end
      }

      if (cursor < node.text.length) {
        rewritten.push({
          type: 'text',
          text: node.text.slice(cursor),
          marks: node.marks,
        })
      }
    }

    return rewritten
  }

  const rewrittenBody: BodyDoc = {
    type: 'doc',
    content: body.content.map((block) => {
      if (block.type === 'bulletList' || block.type === 'orderedList') {
        return {
          ...block,
          content: block.content.map((item) => ({
            ...item,
            content: rewriteInlineNodes(item.content),
          })),
        }
      }

      return {
        ...block,
        content: rewriteInlineNodes(block.content),
      }
    }),
  }

  const hashtagFacts = [...occurrenceMap.entries()].map(
    ([hashtagId, occurrenceCount]) => {
      const hashtag = [...hashtagMap.values()].find(
        (item) => item.id === hashtagId,
      )!
      return {
        hashtagId,
        slug: hashtag.slug,
        displayName: hashtag.displayName,
        occurrenceCount,
      }
    },
  )

  return {
    body: rewrittenBody,
    hashtagFacts,
  }
}

function compileSeedBody(body: BodyDoc) {
  const bodyTokens: BodyToken[] = []
  const mentionFacts: SeedMentionFact[] = []
  let plainText = ''

  const appendText = (text: string) => {
    if (!text) {
      return
    }
    plainText += text
    bodyTokens.push({ type: 'text', text })
  }

  const appendInlineNodes = (nodes: BodyInlineNode[]) => {
    for (const node of nodes) {
      switch (node.type) {
        case 'text':
          appendText(node.text)
          break
        case 'hardBreak':
          appendText('\n')
          break
        case 'mentionUser': {
          const text = `@${node.nickname}`
          const start = plainText.length
          plainText += text
          mentionFacts.push({
            userId: node.userId,
            nickname: node.nickname,
            start,
            end: plainText.length,
            text,
          })
          bodyTokens.push({
            type: 'mentionUser',
            userId: node.userId,
            nickname: node.nickname,
            text,
          })
          break
        }
        case 'emojiUnicode':
          plainText += node.unicodeSequence
          bodyTokens.push({
            type: 'emojiUnicode',
            unicodeSequence: node.unicodeSequence,
          })
          break
        case 'emojiCustom': {
          const text = `:${node.shortcode}:`
          plainText += text
          bodyTokens.push({
            type: 'emojiCustom',
            shortcode: node.shortcode,
          })
          break
        }
        case 'forumHashtag': {
          const text = `#${node.displayName}`
          plainText += text
          bodyTokens.push({
            type: 'forumHashtag',
            hashtagId: node.hashtagId,
            slug: node.slug,
            displayName: node.displayName,
            text,
          })
          break
        }
      }
    }
  }

  for (let index = 0; index < body.content.length; index += 1) {
    if (index > 0) {
      appendText('\n\n')
    }

    const block = body.content[index]
    if (block.type === 'bulletList' || block.type === 'orderedList') {
      for (
        let itemIndex = 0;
        itemIndex < block.content.length;
        itemIndex += 1
      ) {
        if (itemIndex > 0) {
          appendText('\n')
        }
        appendInlineNodes(block.content[itemIndex].content)
      }
      continue
    }

    appendInlineNodes(block.content)
  }

  return {
    plainText,
    bodyTokens,
    mentionFacts,
  }
}

function renderBodyHtml(body: BodyDoc) {
  return body.content
    .map((block) => {
      switch (block.type) {
        case 'paragraph':
          return `<p>${renderInlineNodesHtml(block.content)}</p>`
        case 'heading':
          return `<h${block.level}>${renderInlineNodesHtml(block.content)}</h${block.level}>`
        case 'blockquote':
          return `<blockquote>${renderInlineNodesHtml(block.content)}</blockquote>`
        case 'listItem':
          return `<li>${renderInlineNodesHtml(block.content)}</li>`
        case 'bulletList':
          return `<ul>${block.content
            .map((item) => `<li>${renderInlineNodesHtml(item.content)}</li>`)
            .join('')}</ul>`
        case 'orderedList':
          return `<ol>${block.content
            .map((item) => `<li>${renderInlineNodesHtml(item.content)}</li>`)
            .join('')}</ol>`
        default:
          return ''
      }
    })
    .join('')
}

function renderInlineNodesHtml(nodes: BodyInlineNode[]) {
  return nodes
    .map((node) => {
      switch (node.type) {
        case 'text':
          return escapeHtml(node.text)
        case 'hardBreak':
          return '<br />'
        case 'mentionUser':
          return `<span data-node="mention" data-user-id="${node.userId}" data-nickname="${escapeHtml(node.nickname)}">@${escapeHtml(node.nickname)}</span>`
        case 'emojiUnicode':
          return `<span data-node="emoji" data-unicode-sequence="${escapeHtml(node.unicodeSequence)}">${escapeHtml(node.unicodeSequence)}</span>`
        case 'emojiCustom':
          return `<img data-node="emoji" data-shortcode="${escapeHtml(node.shortcode)}" alt=":${escapeHtml(node.shortcode)}:" />`
        case 'forumHashtag':
          return `<span data-node="hashtag" data-hashtag-id="${node.hashtagId}" data-slug="${escapeHtml(node.slug)}">#${escapeHtml(node.displayName)}</span>`
      }

      return ''
    })
    .join('')
}

function normalizeSeedHashtagDisplayName(displayName: string) {
  return displayName.normalize('NFKC').trim()
}

function normalizeSeedHashtagSlug(value: string) {
  return value.normalize('NFKC').trim().replace(/^#/, '').toLowerCase()
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function pick<T>(items: readonly T[], random: () => number) {
  return items[Math.floor(random() * items.length)]
}

function pickUniqueUsers(
  users: SeedUserRow[],
  random: () => number,
  count: number,
  excludeUserIds: number[],
) {
  const excluded = new Set(excludeUserIds)
  const candidates = users.filter((user) => !excluded.has(user.id))
  const picked: SeedUserRow[] = []
  const used = new Set<number>()

  while (picked.length < count && picked.length < candidates.length) {
    const candidate = candidates[Math.floor(random() * candidates.length)]
    if (used.has(candidate.id)) {
      continue
    }
    used.add(candidate.id)
    picked.push(candidate)
  }

  return picked
}

function randomInt(random: () => number, min: number, max: number) {
  return Math.floor(random() * (max - min + 1)) + min
}

function createRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}

function hashSeed(value: string) {
  let hash = 2166136261
  for (const char of value) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}
