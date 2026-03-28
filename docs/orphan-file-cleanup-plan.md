# 孤儿文件延迟清扫方案

## 1. 目标

本方案的目标不是做一个“全能文件中心”，而是用当前项目最小可维护的方式解决两个问题：

1. 上传成功但后续业务写库失败后残留的文件
2. 业务替换/清空资源后，已经不再被数据库引用的历史文件

方案重点是：

- 先覆盖 **local provider**
- 默认采用 **延迟清扫**
- **不在请求主链路做重型判断**
- **不默认做全表扫描**

---

## 2. 当前项目里孤儿文件是怎么产生的

结合现有链路，典型来源主要有这些：

### 2.1 先上传、再写库，中间失败

相关代码：

- [novel-content.service.ts](D:/code/es/es-server/libs/content/src/work/content/novel-content.service.ts)
- [comic-content.service.ts](D:/code/es/es-server/libs/content/src/work/content/comic-content.service.ts)
- [comic-archive-import.service.ts](D:/code/es/es-server/libs/content/src/work/content/comic-archive-import.service.ts)

这几条链路的共同特点是：

1. 先调用上传服务拿到 `filePath`
2. 再把 `filePath` 写入数据库

如果上传成功后数据库更新失败，文件就会留在存储里，但数据库里没有引用。

### 2.2 替换型更新留下旧文件

例如：

- 小说章节重新上传内容文件
- 漫画章节替换某一批图片
- 漫画压缩包重新导入整章内容

这类场景下，新文件已经成功入库，但旧文件不一定还被引用。

### 2.3 人工清空或业务删除后未同步删存储

例如：

- [novel-content.service.ts](D:/code/es/es-server/libs/content/src/work/content/novel-content.service.ts) 的清空章节内容
- [comic-content.service.ts](D:/code/es/es-server/libs/content/src/work/content/comic-content.service.ts) 的删除 / 清空章节内容

数据库字段变成 `null` 或新数组后，旧文件如果没删，就会变成孤儿。

---

## 3. 现有代码里适合做延迟清扫的原因

### 3.1 已有定时任务基础设施

项目已经启用了 `ScheduleModule`，并且有现成 worker / cron 模式：

- [admin app.module.ts](D:/code/es/es-server/apps/admin-api/src/app.module.ts)
- [app app.module.ts](D:/code/es/es-server/apps/app-api/src/app.module.ts)
- [auth-cron.service.ts](D:/code/es/es-server/libs/platform/src/modules/auth/auth-cron.service.ts)
- [comic-archive-import.worker.ts](D:/code/es/es-server/libs/content/src/work/content/comic-archive-import.worker.ts)

这意味着孤儿文件清扫完全可以沿用当前项目习惯，不需要新引入调度框架。

### 3.2 主要上传路径有明显业务归属

当前最稳定的上传路径主要来自：

- 小说章节：`novel/{workId}/chapter/{chapterId}/...`
- 漫画章节：`comic/{workId}/chapter/{chapterId}/...`

这些路径来自：

- [novel-content.service.ts](D:/code/es/es-server/libs/content/src/work/content/novel-content.service.ts)
- [comic-content.service.ts](D:/code/es/es-server/libs/content/src/work/content/comic-content.service.ts)
- [comic-archive-import.service.ts](D:/code/es/es-server/libs/content/src/work/content/comic-archive-import.service.ts)

所以第一阶段完全没必要靠“全库扫描所有可能的 URL 字段”来判断。

---

## 4. 推荐总方案

我建议采用“两层处理”：

### 4.1 第一层：写路径上的补偿删除

目标：

- 尽量减少新孤儿文件产生

策略：

- 上传成功后，如果数据库更新失败，立即删除刚上传的新文件
- 这是同步补偿，不是主链路全量清扫

### 4.2 第二层：后台延迟清扫

目标：

- 兜住补偿没覆盖到的场景
- 清理历史残留文件

策略：

- 定时任务扫描本地上传目录
- 只处理超过缓冲期的老文件
- 依据路径规则或有限引用清单判断是否仍被数据库引用
- 未引用才删除

---

## 5. 延迟清扫不是“全表扫描”

这是本方案最核心的原则。

### 5.1 默认判断顺序

1. 先扫描文件系统，得到候选文件
2. 按路径模式分类
3. 对可从路径反推出业务 owner 的文件做 **批量点查**
4. 只有归属不明确的文件，才进入“有限引用扫描”
5. 仍无法确定的文件，先不删或先移入隔离区

### 5.2 为什么不是默认全表扫描

因为当前仓库的主要上传路径是“强归属路径”，尤其章节资源：

- 小说章节最终落在 `work_chapter.content`
- 漫画章节最终也落在 `work_chapter.content`

对应 schema：

- [work-chapter.ts](D:/code/es/es-server/db/schema/work/work-chapter.ts)

对于这类文件，完全可以：

1. 从文件路径提取 `chapterId`
2. 批量查询这些章节
3. 在内存里判断该路径是否仍被引用

这比“每个文件单查一次数据库”或者“扫所有表”都轻得多。

---

## 6. 第一阶段建议范围

为了避免过度设计，我建议 Phase 1 只覆盖下面这一类：

### 6.1 只处理章节内容文件

覆盖范围：

- `novel/{workId}/chapter/{chapterId}/...`
- `comic/{workId}/chapter/{chapterId}/...`

原因：

- 路径规则稳定
- 归属对象清晰
- 数据引用集中在同一张表 `work_chapter`
- 性能最好控制

### 6.2 暂不自动处理的资源

这些先不进入第一阶段自动删除：

- `shared/...`
- 用户头像
- 作品封面
- 论坛板块图标/封面
- 论坛主题图片
- 表情包图标 / 表情资源图
- 系统配置里的 `siteLogo` / `siteFavicon`

这些字段确实是文件引用点，例如：

- [app-user.ts](D:/code/es/es-server/db/schema/app/app-user.ts) `avatarUrl`
- [admin-user.ts](D:/code/es/es-server/db/schema/admin/admin-user.ts) `avatar`
- [work.ts](D:/code/es/es-server/db/schema/work/work.ts) `cover`
- [work-chapter.ts](D:/code/es/es-server/db/schema/work/work-chapter.ts) `cover`
- [forum-section.ts](D:/code/es/es-server/db/schema/forum/forum-section.ts) `icon` / `cover`
- [forum-topic.ts](D:/code/es/es-server/db/schema/forum/forum-topic.ts) `images`
- [emoji-pack.ts](D:/code/es/es-server/db/schema/app/emoji-pack.ts) `iconUrl`
- [emoji-asset.ts](D:/code/es/es-server/db/schema/app/emoji-asset.ts) `imageUrl` / `staticUrl`
- [system-config.ts](D:/code/es/es-server/db/schema/system/system-config.ts) `siteConfig`

但它们的问题是：

- 路径规则没有章节资源那么稳定
- 引用位点分散
- 有些字段是数组，有些在 JSON 里
- 一上来自动删，误判风险更高

结论：

- 这些资源应放到 Phase 2 的“有限引用清单方案”
- 不建议和章节清扫一起首版落地

---

## 7. Phase 1 的判定设计

## 7.1 候选文件来源

扫描目录：

- `upload.localDir`

不扫描：

- `upload.tmpDir`
- 非本地 provider 的远端对象存储

文件筛选条件：

1. 是普通文件
2. 文件年龄超过缓冲期
3. 路径命中受支持的章节模式

建议缓冲期：

- 默认 `72 小时`

原因：

- 避免刚上传成功但异步流程还未完全落稳时误删
- 给人工排障、重试、缓存回写留足余量

## 7.2 路径分类规则

建议只识别这两种：

1. `novel/{workId}/chapter/{chapterId}/{filename}`
2. `comic/{workId}/chapter/{chapterId}/{filename}`

分类结果：

- `novelChapterFile`
- `comicChapterFile`
- `unknown`

只有前两类进入自动判定。

## 7.3 数据库判定方式

### 小说章节

规则：

- 同一批候选文件先按 `chapterId` 分组
- 一次批量查询对应章节的 `content`
- 若 `content === filePath`，则视为仍被引用
- 若章节不存在、已软删、或 `content` 不等于该路径，则视为未引用

### 漫画章节

规则：

- 同样先按 `chapterId` 分组批量查询
- 读取 `content` 并解析为图片数组
- 若数组中包含该 `filePath`，则仍被引用
- 否则视为未引用

关键点：

- **按章节批量查，不按文件逐条查**
- 一批 1000 个候选文件，如果只涉及 120 个章节，就只查 120 行

## 7.4 删除动作

推荐采用两段式：

1. 第一阶段先支持 `dry-run`
   只记录“会删除哪些文件”，不真正删除
2. 验证稳定后，再启用真删

如果你想更稳，还可以再做成：

1. 先移动到 `trash/`
2. 保留 7 天
3. 二次确认后永久删除

我更推荐：

- Phase 1 先 `dry-run`
- Phase 1.5 再决定是否直接删还是先进 `trash`

---

## 8. 性能设计

## 8.1 不在请求主链路运行

清扫任务必须走后台定时任务，不进用户请求。

建议形式：

- 新增一个 `worker` 或 `cron service`
- 参考 [comic-archive-import.worker.ts](D:/code/es/es-server/libs/content/src/work/content/comic-archive-import.worker.ts)
- 或参考 [auth-cron.service.ts](D:/code/es/es-server/libs/platform/src/modules/auth/auth-cron.service.ts)

## 8.2 批量查询，不做单文件查库

错误做法：

- 每个文件执行一次 `select`

推荐做法：

1. 一次扫描出一批候选文件
2. 解析出涉及的 `chapterId`
3. 按 `chapterId` 批量查询章节记录
4. 在内存做路径集合比对

性能特征：

- 文件系统成本：`O(候选文件数)`
- 数据库成本：`O(涉及章节数)`

通常“涉及章节数”会远小于“文件数”。

## 8.3 限流与批次

建议参数：

- 单次最大候选文件数：`1000`
- 单批章节查询数：`200 ~ 500`
- 单次任务最大删除数：`500`

原因：

- 避免一次任务跑太久
- 避免数据库与磁盘 I/O 峰值过高
- 更利于观察日志和回滚

## 8.4 调度频率

推荐频率：

- 初版：每天凌晨 1 次
- 稳定后：可改为每小时小批量扫一次

不推荐：

- 每分钟跑
- 跟上传请求绑定执行

---

## 9. Phase 2 方案

在章节内容清扫稳定后，再考虑扩展到“有限引用清单”。

## 9.1 有限引用清单

这里不是全表扫描，而是只维护一份明确的文件引用位点列表。

例如：

- `app_user.avatar_url`
- `admin_user.avatar`
- `work.cover`
- `work_chapter.cover`
- `forum_section.icon`
- `forum_section.cover`
- `forum_topic.images`
- `emoji_pack.icon_url`
- `emoji_asset.image_url`
- `emoji_asset.static_url`
- `sys_config.site_config.siteLogo`
- `sys_config.site_config.siteFavicon`

这种模式适合：

- 低频审计
- 历史存量盘点
- 后续补齐更多资源域

但不适合作为第一阶段默认自动删除策略。

## 9.2 为什么不建议一上来做 Phase 2

因为它的维护成本会明显上升：

- 需要长期维护引用字段清单
- 新模块一旦新增资源字段，必须同步登记
- 某些字段在 JSON 或数组里，判断更复杂

所以 Phase 2 只适合在 Phase 1 稳定后，再逐步纳入。

---

## 10. 建议的落地步骤

### Step 1

先补上传补偿删除能力：

- 上传成功但写库失败时，立即删除新文件

### Step 2

新增章节资源延迟清扫 worker：

- 只处理 `novel/*/chapter/*` 和 `comic/*/chapter/*`

### Step 3

先启用 `dry-run`：

- 只记录候选文件、判定结果、预计删除数

### Step 4

观察 3 到 7 天：

- 确认没有明显误判
- 确认性能和日志量可接受

### Step 5

再开启真实删除或 `trash` 隔离删除

---

## 11. 日志与观测建议

建议最少记录这些字段：

- `runId`
- `mode` (`dry-run` / `delete`)
- `candidateFileCount`
- `classifiedNovelCount`
- `classifiedComicCount`
- `unknownCount`
- `referencedCount`
- `orphanCount`
- `deletedCount`
- `skippedYoungFileCount`
- `costMs`

对单个删除失败日志，建议记录：

- `filePath`
- `reason`
- `chapterId`
- `workId`

---

## 12. 明确不建议的做法

1. 不建议每个文件单独查一次数据库
2. 不建议首版就扫所有表所有可能的 URL 字段
3. 不建议在请求主链路同步清理历史孤儿文件
4. 不建议首版就引入文件元数据表、引用计数系统、复杂资产中心
5. 不建议对 `shared/...` 这类归属不明文件直接自动删

---

## 13. 我的建议结论

如果按当前项目的复杂度和维护成本来衡量，我建议这样推进：

1. **先做补偿删除**
2. **再做章节资源的延迟清扫**
3. **默认 dry-run + 批量按章节判定**
4. **不默认做全表扫描**
5. **Phase 2 再考虑有限引用清单**

这是当前最稳、性能最好控、也最不容易误删的一套方案。
