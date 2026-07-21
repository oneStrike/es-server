# 种子数据真实化改造 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将 `db/seed/` 下的种子数据从模拟数据改造为真实风格数据，使用真实作品名/作者名/用户昵称，保证数据关联正确，规模扩大到像一个运营了三个月的平台。

**架构：** 方案 C 混合模式——核心实体（作品/作者/分类/标签/板块）硬编码真实数据，用户和互动数据程序化生成。每个字段先查业务代码确认是否字典驱动。

**技术栈：** TypeScript, Drizzle ORM, PostgreSQL, NestJS monorepo

---

## 文件结构

| 文件                                | 职责                               | 改动类型                |
| ----------------------------------- | ---------------------------------- | ----------------------- |
| `db/seed/shared.ts`                 | 字典常量、时间线、昵称池、工具函数 | 扩充                    |
| `db/seed/index.ts`                  | 主 seed 流程编排                   | 修改（接入孤儿函数）    |
| `db/seed/modules/system/domain.ts`  | 字典项、敏感词、系统配置、请求日志 | 扩充                    |
| `db/seed/modules/admin/domain.ts`   | 管理员账号                         | 微调                    |
| `db/seed/modules/work/domain.ts`    | 作品/作者/分类/标签/章节           | 重写 fixture            |
| `db/seed/modules/app/domain.ts`     | 用户/等级/会员/互动数据            | 重写 fixture + 扩充生成 |
| `db/seed/modules/forum/domain.ts`   | 板块/话题/评论/互动                | 重写 fixture + 扩充生成 |
| `db/seed/modules/message/domain.ts` | 通知/聊天/消息                     | 扩充                    |

---

## 关键发现

`seedWorkDomain`、`seedMessageDomain`、`seedAppActivityDomain` 三个函数已定义但从未被 `index.ts` 调用。需要在任务 1 中将它们接入主流程。

当前流程：

```
seedSystemReferenceData → seedAdminDomain → seedAppCoreDomain → seedForumReferenceDomain
→ seedForumActivityDomain → seedSystemOperationalData
```

改造后流程：

```
seedSystemReferenceData → seedAdminDomain → seedAppCoreDomain → seedWorkDomain
→ seedForumReferenceDomain → seedForumActivityDomain → seedAppActivityDomain
→ seedMessageDomain → seedSystemOperationalData
```

---

## 任务 1：接入孤儿函数到主 seed 流程

**文件：**

- 修改：`db/seed/index.ts`

- [ ] **步骤 1：添加 import 语句**

在 `db/seed/index.ts` 中添加三个函数的 import：

```typescript
import { seedWorkDomain } from './modules/work/domain'
import { seedMessageDomain } from './modules/message/domain'
import { seedAppActivityDomain, seedAppCoreDomain } from './modules/app/domain'
```

注意：`seedAppCoreDomain` 已经有 import，需要将 `seedAppActivityDomain` 加入同一个 import 语句。

- [ ] **步骤 2：修改主流程，在正确位置调用三个孤儿函数**

将 `runDemoSeed` 中的三阶段流程改为：

```typescript
console.log('📦 第一阶段：全局参考数据\n')
await seedSystemReferenceData(tx)
await seedAdminDomain(tx)
await seedAppCoreDomain(tx)
await seedWorkDomain(tx)
await seedForumReferenceDomain(tx)
console.log('\n✅ 全局参考数据初始化完成\n')

console.log('📦 第二阶段：论坛主体与互动数据\n')
await seedForumActivityDomain(tx)
await seedAppActivityDomain(tx)
console.log('\n✅ 论坛主体与互动数据初始化完成\n')

console.log('📦 第三阶段：消息与系统运行数据\n')
await seedMessageDomain(tx)
await seedSystemOperationalData(tx)
console.log('\n✅ 消息与系统运行数据初始化完成\n')
```

- [ ] **步骤 3：运行 type-check 验证**

运行：`pnpm type-check`
预期：PASS（无类型错误）

- [ ] **步骤 4：Commit**

```bash
git add db/seed/index.ts
git commit -m "feat(seed): wire orphan seed functions into main flow"
```

---

## 任务 2：扩充 shared.ts 基础常量

**文件：**

- 修改：`db/seed/shared.ts`

- [ ] **步骤 1：扩充字典常量**

在 `DICTIONARY_ITEMS.workPublisher` 中新增 `squareEnix` 和 `shogakukan`：

```typescript
  workPublisher: {
    kodansha: 'kodansha',
    shueisha: 'shueisha',
    kadokawa: 'kadokawa',
    shinchosha: 'shinchosha',
    squareEnix: 'square_enix',
    shogakukan: 'shogakukan',
  },
```

在 `DICTIONARY_ITEMS.workLanguage` 中新增 `ko`：

```typescript
  workLanguage: {
    zh: 'zh',
    ja: 'ja',
    en: 'en',
    ko: 'ko',
  },
```

- [ ] **步骤 2：调整时间线基准**

将 `SEED_TIMELINE` 改为跨越三个月：

```typescript
export const SEED_TIMELINE = {
  seedAt: new Date('2026-07-21T08:00:00.000Z'),
  previousDay: new Date('2026-07-20T08:00:00.000Z'),
  releaseDay: new Date('2026-04-21T08:00:00.000Z'),
  chatBucket: new Date('2026-07-21T08:30:00.000Z'),
} as const
```

- [ ] **步骤 3：扩充 reader 账号池到 150 个**

将 `SEED_READER_ACCOUNT_SLUGS` 的 `.slice(0, 96)` 改为 `.slice(0, 150)`，并确保 `SEED_READER_ACCOUNT_BASE_PREFIXES` 和 `SEED_READER_ACCOUNT_BASE_SUFFIXES` 的组合数 >= 150。当前 16 prefixes × 6 suffixes = 96，需要扩充 prefix 或 suffix 列表。

在 `SEED_READER_ACCOUNT_BASE_PREFIXES` 中新增：

```typescript
  'hatsu',
  'rin',
  'tsubaki',
  'kanade',
  'miyu',
  'sayaka',
  'tooru',
  'yuki',
  'nana',
  'saki',
```

这样 26 prefixes × 6 suffixes = 156 > 150。

- [ ] **步骤 4：运行 type-check 验证**

运行：`pnpm type-check`
预期：PASS

- [ ] **步骤 5：Commit**

```bash
git add db/seed/shared.ts
git commit -m "feat(seed): expand dictionary constants and timeline"
```

---

## 任务 3：扩充系统域字典项与敏感词

**文件：**

- 修改：`db/seed/modules/system/domain.ts`

- [ ] **步骤 1：在 DICTIONARY_FIXTURES 中扩充字典项**

在 `workLanguage` 字典的 items 中新增韩文：

```typescript
      { name: '韩文', code: DICTIONARY_ITEMS.workLanguage.ko, sortOrder: 4 },
```

在 `workPublisher` 字典的 items 中新增：

```typescript
      {
        name: 'Square Enix',
        code: DICTIONARY_ITEMS.workPublisher.squareEnix,
        sortOrder: 5,
      },
      {
        name: '小学馆',
        code: DICTIONARY_ITEMS.workPublisher.shogakukan,
        sortOrder: 6,
      },
```

- [ ] **步骤 2：扩充敏感词到 8-10 个**

在 `SENSITIVE_WORD_FIXTURES` 数组中新增条目，覆盖色情、暴力、政治等分类：

```typescript
  {
    word: '色情',
    replaceWord: '**',
    level: 1,
    type: 1,
    matchMode: 1,
    isEnabled: true,
    remark: 'seed: 色情违规内容',
  },
  {
    word: '暴力',
    replaceWord: '**',
    level: 2,
    type: 2,
    matchMode: 1,
    isEnabled: true,
    remark: 'seed: 暴力违规内容',
  },
  {
    word: '反动',
    replaceWord: '**',
    level: 1,
    type: 5,
    matchMode: 1,
    isEnabled: true,
    remark: 'seed: 政治敏感内容',
  },
  {
    word: '毒品',
    replaceWord: '**',
    level: 1,
    type: 5,
    matchMode: 2,
    isEnabled: true,
    remark: 'seed: 毒品相关内容',
  },
  {
    word: '传销',
    replaceWord: '**',
    level: 2,
    type: 5,
    matchMode: 2,
    isEnabled: true,
    remark: 'seed: 传销违规内容',
  },
  {
    word: '违禁品',
    replaceWord: '**',
    level: 1,
    type: 5,
    matchMode: 1,
    isEnabled: true,
    remark: 'seed: 违禁品交易',
  },
```

- [ ] **步骤 3：修改系统配置文案**

在 `seedSystemOperationalData` 中将 `configPayload.siteConfig` 改为：

```typescript
    siteConfig: {
      name: '漫读社区',
      slogan: '发现你的下一部心动作品',
      keywords: ['漫画', '轻小说', '社区', '追番', '评论'],
    },
```

- [ ] **步骤 4：扩充请求日志到 15-20 条**

在 `requestFixtures` 数组中新增条目，覆盖 admin 和 app 端常见操作（登录、发帖、购买、上传、评论等）。每条引用正确的 `ApiTypeEnum` 和合理的 `method`/`path`/`createdAt`。

- [ ] **步骤 5：运行 type-check 验证**

运行：`pnpm type-check`
预期：PASS

- [ ] **步骤 6：Commit**

```bash
git add db/seed/modules/system/domain.ts
git commit -m "feat(seed): expand dictionary items, sensitive words, and system config"
```

---

## 任务 4：重写作品域 fixture 为真实数据

**文件：**

- 修改：`db/seed/modules/work/domain.ts`

这是本计划最大的任务。需要将 `CATEGORY_FIXTURES`、`TAG_FIXTURES`、`AUTHOR_FIXTURES`、`WORK_FIXTURES` 全部替换为真实数据。

- [ ] **步骤 1：扩充分类到 10 个**

将 `CATEGORY_FIXTURES` 替换为：

```typescript
const CATEGORY_FIXTURES = [
  {
    name: '热血',
    description: '强调成长、对抗与热血冒险',
    icon: 'https://static.example.com/categories/hot-blood.svg',
    contentType: [1, 2],
    sortOrder: 1,
    popularity: 120,
  },
  {
    name: '奇幻',
    description: '包含奇幻设定、超自然规则与异世界元素',
    icon: 'https://static.example.com/categories/fantasy.svg',
    contentType: [1, 2],
    sortOrder: 2,
    popularity: 100,
  },
  {
    name: '悬疑',
    description: '强调谜题、推理与心理张力',
    icon: 'https://static.example.com/categories/mystery.svg',
    contentType: [1, 2],
    sortOrder: 3,
    popularity: 110,
  },
  {
    name: '情感',
    description: '关注人物关系与情绪表达',
    icon: 'https://static.example.com/categories/emotion.svg',
    contentType: [1, 2],
    sortOrder: 4,
    popularity: 90,
  },
  {
    name: '现实',
    description: '基于现实生活经验的内容主题',
    icon: 'https://static.example.com/categories/realism.svg',
    contentType: [2],
    sortOrder: 5,
    popularity: 80,
  },
  {
    name: '日常',
    description: '日常生活中的轻松故事',
    icon: 'https://static.example.com/categories/daily.svg',
    contentType: [1, 2],
    sortOrder: 6,
    popularity: 70,
  },
  {
    name: '搞笑',
    description: '以幽默和搞笑情节为主',
    icon: 'https://static.example.com/categories/comedy.svg',
    contentType: [1, 2],
    sortOrder: 7,
    popularity: 85,
  },
  {
    name: '冒险',
    description: '以探索和冒险旅程为核心',
    icon: 'https://static.example.com/categories/adventure.svg',
    contentType: [1, 2],
    sortOrder: 8,
    popularity: 95,
  },
  {
    name: '科幻',
    description: '包含科幻设定和未来世界观',
    icon: 'https://static.example.com/categories/scifi.svg',
    contentType: [1, 2],
    sortOrder: 9,
    popularity: 75,
  },
  {
    name: '治愈',
    description: '温暖治愈、让人放松的内容',
    icon: 'https://static.example.com/categories/healing.svg',
    contentType: [1, 2],
    sortOrder: 10,
    popularity: 65,
  },
] as const
```

- [ ] **步骤 2：扩充标签到 8 个**

将 `TAG_FIXTURES` 替换为：

```typescript
const TAG_FIXTURES = [
  {
    name: '高热度',
    description: '站内高讨论度内容',
    icon: 'https://static.example.com/tags/hot.svg',
    sortOrder: 1,
    popularity: 150,
  },
  {
    name: '动画改编',
    description: '有动画化或影视化内容',
    icon: 'https://static.example.com/tags/adaptation.svg',
    sortOrder: 2,
    popularity: 120,
  },
  {
    name: '长篇连载',
    description: '篇幅较长、世界观展开丰富',
    icon: 'https://static.example.com/tags/long-run.svg',
    sortOrder: 3,
    popularity: 90,
  },
  {
    name: '口碑佳作',
    description: '评分稳定、口碑较高的内容',
    icon: 'https://static.example.com/tags/recommended.svg',
    sortOrder: 4,
    popularity: 130,
  },
  {
    name: '已完结',
    description: '作品已完结，可以放心追完',
    icon: 'https://static.example.com/tags/completed.svg',
    sortOrder: 5,
    popularity: 80,
  },
  {
    name: '新番推荐',
    description: '近期开始连载的新作品',
    icon: 'https://static.example.com/tags/new-season.svg',
    sortOrder: 6,
    popularity: 100,
  },
  {
    name: '经典必读',
    description: '公认的经典作品，入坑必读',
    icon: 'https://static.example.com/tags/classic.svg',
    sortOrder: 7,
    popularity: 140,
  },
  {
    name: '冷门佳作',
    description: '讨论度不高但质量出色的作品',
    icon: 'https://static.example.com/tags/hidden-gem.svg',
    sortOrder: 8,
    popularity: 60,
  },
] as const
```

- [ ] **步骤 3：替换作者为 15+ 个真实作者**

将 `AUTHOR_FIXTURES` 替换为包含谏山创、吾峠呼世晴、芥见下下、藤本树、山田鐘人、远藤达哉、堀越耕平、尾田荣一郎、岸本齐史、久保带人、荒川弘、空知英秋、古馆春一、natsu、赤坂茜、村上春树、东野圭吾等真实作者。每个作者包含真实国籍（引用 `DICTIONARY_ITEMS.nationality`）、`gender`、`type`（`[1]` 为漫画作者，`[2]` 为小说作者）、`isRecommended`。

- [ ] **步骤 4：替换作品为 15 部漫画 + 4 部小说**

将 `WORK_FIXTURES` 替换为真实知名作品。每部作品包含：

- `key`：URL 友好的 slug
- `name`：中文译名
- `alias`：日文原名、英文译名
- `type`：1（漫画）或 2（小说）
- `language`/`region`/`publisher`/`ageRating`：引用 `DICTIONARY_ITEMS` 字典 code
- `serialStatus`：使用 `WorkSerialStatusEnum` 枚举值（需 import）
- 2-4 个章节，章节标题符合原作风格
- 合理的 `rating`/`popularity`/`recommendWeight`
- `categories`/`tags`/`authors`：引用真实存在的分类名/标签名/作者名

**需要 import `WorkSerialStatusEnum`：**

```typescript
import { WorkSerialStatusEnum } from '@libs/content/work/core/work.constant'
```

- [ ] **步骤 5：运行 type-check 验证**

运行：`pnpm type-check`
预期：PASS

- [ ] **步骤 6：Commit**

```bash
git add db/seed/modules/work/domain.ts
git commit -m "feat(seed): rewrite work domain with real manga/novel data"
```

---

## 任务 5：重写应用用户域 fixture

**文件：**

- 修改：`db/seed/modules/app/domain.ts`

- [ ] **步骤 1：将 SEED_USER_COUNT 改为 150**

```typescript
const SEED_USER_COUNT = 150
```

- [ ] **步骤 2：扩充 USER_PROFILE_FIXTURES 昵称池**

在现有 11 个手工编写的用户画像基础上，继续扩充到至少 30 个手工编写的真实风格昵称画像。新增的画像应覆盖不同风格：文艺风、二次元风、日常风、搞笑风等。每个画像包含 `nickname`、`signature`、`bio`、`genderType`、`birthDate`、`geoProvince`、`geoCity`。

示例新增画像：

```typescript
  {
    nickname: '月下独酌',
    signature: '夜深人静时补番最香。',
    bio: '偏爱悬疑和推理，偶尔看看日常系放松。',
    genderType: 1,
    birthDate: '1995-04-15',
    geoProvince: '上海',
    geoCity: '上海',
  },
  {
    nickname: '墨染樱前',
    signature: '樱花又开了。',
    bio: '喜欢和风题材和时代剧，会写长评。',
    genderType: 2,
    birthDate: '1997-09-22',
    geoProvince: '北京',
    geoCity: '北京',
  },
  // ... 继续扩充到 30 个
```

- [ ] **步骤 3：调整用户行为画像分层逻辑**

修改 `USER_FIXTURES` 生成逻辑中的分层阈值：

```typescript
const levelName =
  index < 20 ? '资深读者' : index < 100 ? '活跃读者' : '新手读者'
```

- [ ] **步骤 4：调整注册时间分布**

修改 `createdAt` 使其在 3 个月内分布：

```typescript
    createdAt: addHours(SEED_TIMELINE.releaseDay, index * 12),
```

这样 150 个用户分布在约 75 天内。

- [ ] **步骤 5：运行 type-check 验证**

运行：`pnpm type-check`
预期：PASS

- [ ] **步骤 6：Commit**

```bash
git add db/seed/modules/app/domain.ts
git commit -m "feat(seed): expand user fixtures with realistic nicknames and profiles"
```

---

## 任务 6：重写论坛域 fixture 为真实风格

**文件：**

- 修改：`db/seed/modules/forum/domain.ts`

- [ ] **步骤 1：扩充板块分组到 5 个**

在 `SECTION_GROUP_FIXTURES` 中新增"作品评论区"：

```typescript
  {
    name: '作品评论区',
    description: '各作品的专属讨论区域，绑定作品板块。',
    sortOrder: 5,
    maxModerators: 8,
  },
```

- [ ] **步骤 2：扩充板块到 12-14 个**

在 `SECTION_FIXTURES` 中新增板块：

```typescript
  {
    name: '追番日程表',
    groupName: '番剧漫画讨论',
    description: '每周追番日程安排和进度跟踪。',
    icon: 'https://api.dicebear.com/9.x/icons/svg?seed=forum-schedule',
    cover: 'https://api.dicebear.com/9.x/shapes/svg?seed=forum-schedule-cover',
    sortOrder: 4,
    topicReviewPolicy: 1,
    topicCount: 72,
  },
  {
    name: '原作 vs 动画',
    groupName: '番剧漫画讨论',
    description: '原作和动画版对比讨论。',
    icon: 'https://api.dicebear.com/9.x/icons/svg?seed=forum-vs',
    cover: 'https://api.dicebear.com/9.x/shapes/svg?seed=forum-vs-cover',
    sortOrder: 5,
    topicReviewPolicy: 1,
    topicCount: 68,
  },
  {
    name: '设定考察党',
    groupName: '番剧漫画讨论',
    description: '世界观、设定和伏笔的深入考察。',
    icon: 'https://api.dicebear.com/9.x/icons/svg?seed=forum-lore',
    cover: 'https://api.dicebear.com/9.x/shapes/svg?seed=forum-lore-cover',
    sortOrder: 6,
    topicReviewPolicy: 1,
    topicCount: 54,
  },
  {
    name: '补番互助',
    groupName: '番剧漫画讨论',
    description: '补番路线、推荐顺序和避雷指南。',
    icon: 'https://api.dicebear.com/9.x/icons/svg?seed=forum-catchup',
    cover: 'https://api.dicebear.com/9.x/shapes/svg?seed=forum-catchup-cover',
    sortOrder: 7,
    topicReviewPolicy: 1,
    topicCount: 62,
  },
```

- [ ] **步骤 3：扩充话题标题模板为真实风格**

找到话题标题模板数组（在 `seedSectionTopics` 或相关函数中），替换为真实风格的话题标题。硬编码 20-30 个真实风格话题标题，例如：

```typescript
  '进击的巨人最终季观感汇总',
  '咒术回战涉谷事变完全解读',
  '葬送的芙莉莲为什么是神作',
  '追番推荐：2026 春季新番一览',
  '链锯人第二部到底讲了什么',
  '间谍过家家日常系的魅力所在',
  '海贼王和之国篇完结评价',
  '我的英雄学院最终章追更记录',
  '钢之炼金术师为什么是神作',
  '银魂全篇笑点密度排名',
  '排球少年漫画完结后的回顾',
  '药师少女的独语追更心得',
  '我推是动画化和原作对比',
  '挪威的森林读后感分享',
  '白夜行人物关系深度解析',
  '嫌疑人X的献身诡计复盘',
  '解忧杂货店治愈系推荐',
  '火影忍者疾风传回顾',
  '死神千年血战篇动画观感',
  '新番追更每周集中楼',
```

- [ ] **步骤 4：扩充评论内容模板为真实风格**

找到评论内容生成逻辑，替换为真实风格的讨论语句。评论应像真实论坛讨论，例如：

```typescript
  '这部作品的分镜真的太强了，每一页都在讲故事。',
  '角色成长线写得很扎实，不是那种突然变强的套路。',
  '我也在追这部，每周等更新真的很折磨人。',
  '动画化之后作画崩了有点可惜，原作分镜明明那么好。',
  '推荐先看漫画再补动画，体验完全不一样。',
  '这个伏笔其实很早就埋了，回头二刷才发现。',
  '说到底还是原作的节奏感好，动画改编很难还原。',
  '最近补完了全篇，结局比想象中合理很多。',
```

- [ ] **步骤 5：运行 type-check 验证**

运行：`pnpm type-check`
预期：PASS

- [ ] **步骤 6：Commit**

```bash
git add db/seed/modules/forum/domain.ts
git commit -m "feat(seed): rewrite forum domain with realistic topics and comments"
```

---

## 任务 7：扩充消息域数据

**文件：**

- 修改：`db/seed/modules/message/domain.ts`

- [ ] **步骤 1：扩充聊天会话到 3-5 个**

当前只有 1 个聊天会话（userA 和 userB 的直接对话）。新增 2-4 个会话：

- userA 和 userC 的对话
- userB 和 userC 的对话
- 一个包含 userA、userB、userC 的群聊

每个会话 5-15 条消息，消息内容是真实风格的对话（讨论作品、追番、社区话题等）。

- [ ] **步骤 2：扩充站内通知**

根据互动数据（评论回复、点赞、关注等）生成更多站内通知。当前只有 3 条通知，扩充到 10-15 条，覆盖不同的 `categoryKey`：

- `comment_reply`：用户回复了你的评论
- `comment_like`：有人赞了你的评论
- `topic_like`：有人赞了你的话题
- `topic_favorited`：有人收藏了你的话题
- `user_followed`：有人关注了你
- `system_announcement`：系统公告通知

每条通知的 `payload` 结构需与 `getCanonicalNotificationTemplateContract` 定义的契约匹配。

- [ ] **步骤 3：运行 type-check 验证**

运行：`pnpm type-check`
预期：PASS

- [ ] **步骤 4：Commit**

```bash
git add db/seed/modules/message/domain.ts
git commit -m "feat(seed): expand message domain with more conversations and notifications"
```

---

## 任务 8：微调管理员域

**文件：**

- 修改：`db/seed/modules/admin/domain.ts`

- [ ] **步骤 1：调整管理员信息**

将 `ADMIN_FIXTURE` 中的信息微调为更真实的值：

```typescript
const ADMIN_FIXTURE = {
  username: SEED_ADMIN_USERNAME,
  mobile: '13800138000',
  avatar: createAvatar('admin-mandu'),
  isEnabled: true,
  lastLoginAt: SEED_TIMELINE.previousDay,
  lastLoginIp: '127.0.0.1',
}
```

- [ ] **步骤 2：运行 type-check 验证**

运行：`pnpm type-check`
预期：PASS

- [ ] **步骤 3：Commit**

```bash
git add db/seed/modules/admin/domain.ts
git commit -m "feat(seed): tweak admin domain info"
```

---

## 任务 9：最终验证与一致性检查

- [ ] **步骤 1：运行完整 type-check**

运行：`pnpm type-check`
预期：PASS，无任何类型错误

- [ ] **步骤 2：运行 lint 检查**

运行：`pnpm lint`
预期：PASS，无 lint 错误

- [ ] **步骤 3：检查 seed 脚本能否正常执行**

运行：`pnpm db:seed:demo`
预期：脚本正常执行，输出各阶段完成日志，无运行时错误

- [ ] **步骤 4：Commit 最终状态**

```bash
git add -A
git commit -m "feat(seed): complete realistic seed data overhaul"
```

---

## 验证清单

- [ ] 所有字典项 code 被作品/作者正确引用
- [ ] `serialStatus` 使用 `WorkSerialStatusEnum` 枚举值
- [ ] 所有 `targetType`/`sceneType` 使用业务枚举常量
- [ ] 用户 `levelId` 引用真实存在的等级规则
- [ ] 资产余额与 `GrowthAssetTypeEnum` 枚举一致
- [ ] 会员订阅引用真实存在的 `membershipPlan`
- [ ] 通知 `categoryKey` 与通知模板匹配
- [ ] 计数器字段等于实际关联记录数
- [ ] 时间线因果顺序正确（作品发布 → 用户注册 → 互动）
- [ ] 确定性生成：多次运行结果一致
