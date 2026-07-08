# CopyManga 章节图片解析容忍度修复计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 修复 CopyManga 老章节因单张图片 `uuid` 或 `url` 字段缺失导致整个章节导入/同步被拒绝的回归问题。

**架构：** CopyManga provider 的 `getChapterContent` 方法在解析上游返回的 `chapter.contents` 数组时，当前对每张图片执行 fail-closed 校验（`uuid` 和 `url` 任一缺失即抛异常）。提交 `a1153ef82` 将原先"跳过无效图片项"的策略改为"整体拒绝"，导致上游数据质量波动时放大为整章节失败。本次修复恢复图片级别的容忍策略：跳过 `url` 缺失的图片项，对 `uuid` 缺失项合成稳定 ID，同时保留"全部图片无效时仍 fail-closed"的底线。

**技术栈：** NestJS, TypeScript, CopyManga third-party provider

---

## 背景与证据

### 错误堆栈

```
BusinessException: 第三方章节图片字段缺失: de295ee4-bbb9-11e8-a742-00163e0ca5bd:1
    at CopyMangaProvider.toChapterImageItem (copy-manga.provider.ts:284-288)
    at CopyMangaProvider.getChapterContent (copy-manga.provider.ts:148-193)
```

- `de295ee4-bbb9-11e8-...` 的 UUID v1 时间戳对应 2018 年，说明是老章节。
- `:1` 表示 `index + 1 = 1`，即 `index = 0`，第一张图片就触发了校验失败。

### 当前代码（copy-manga.provider.ts:190-195）

```typescript
const chapterUuid = chapter.uuid
const images = (chapter?.contents ?? []).map((item, index) =>
  this.toChapterImageItem(chapterUuid, item, index),
)
```

### 当前 toChapterImageItem（copy-manga.provider.ts:278-295）

```typescript
// 将章节图片结果收敛为共享 DTO；图片身份和 URL 缺失时失败关闭。
private toChapterImageItem(
  chapterUuid: string,
  item: CopyMangaChapterContentImage,
  index: number,
) {
  if (!item.uuid || !item.url) {
    throw this.providerError(
      `第三方章节图片字段缺失: ${chapterUuid}:${index + 1}`,
    )
  }

  return {
    providerImageId: item.uuid,
    url: item.url,
    sortOrder: index + 1,
  }
}
```

### 旧代码（a1153ef82 之前，已删除）

```typescript
const images = (chapter?.contents ?? [])
  .filter((item) => Boolean(item.url))
  .map((item, index) => ({
    providerImageId: this.resolveImageProviderId(chapterUuid, item, index),
    url: item.url!,
    sortOrder: index + 1,
  }))

// resolveImageProviderId: uuid 缺失时合成 `${chapterUuid}:${index+1}`
private resolveImageProviderId(
  chapterUuid: string,
  item: { uuid?: string },
  index: number,
) {
  return item.uuid ?? `${chapterUuid}:${index + 1}`
}
```

### 行为对比

| 维度 | 旧代码（a1153ef82 之前） | 当前代码 | 本计划目标 |
|------|------------------------|---------|-----------|
| `url` 缺失 | 跳过该项 | 整章节拒绝 | 跳过该项 |
| `uuid` 缺失 | 合成 `${chapterUuid}:${index+1}` | 整章节拒绝 | 合成 `${chapterUuid}:${index+1}` |
| 全部图片无效 | `images.length === 0` 抛错 | 同左 | 同左（保留） |
| 安全影响 | 无（`url` 缺失无法下载） | 无额外安全增益 | 无（安全校验在 `remote-image-import.service.ts` 的 `assertSafeUrl` 中执行） |

### 影响范围

该错误影响两个业务流程：

1. **导入流程** — `third-party-comic-import.service.ts:840` `readChapterImportContent` → `getChapterContent`
2. **同步流程** — `third-party-comic-sync.service.ts:404` `readSyncChapterContent` → `getChapterContent`

两个流程中单章节失败都会触发 workflow 回滚，删除已创建章节和已上传文件。

---

## 设计决策

### 恢复容忍策略，不放宽安全防线

- `url` 缺失的图片无法下载，跳过合理，不引入安全风险。
- `uuid` 缺失时合成 `providerImageId`，保留可追溯性，不影响下载安全。
- 全部图片无效时仍 fail-closed（`images.length === 0` 检查保留）。
- 后续 `remote-image-import.service.ts` 的 `assertSafeUrl` 仍对每张图片 URL 做 host 白名单 + DNS 安全校验，安全防线不削弱。

### 不删除 toChapterImageItem，而是改造它

`a1153ef82` 引入的 `toChapterImageItem` 方法相比旧的内联逻辑更可读。本计划保留该方法，但将其语义从"校验 + 转换"改为"纯转换 + 跳过无效项"，通过返回 `null` + `filter` 实现容忍。

### 不修改类型定义

`CopyMangaChapterContentImage` 中 `uuid` 和 `url` 均为 `string | undefined`，当前类型已正确反映上游数据可能缺失的事实，无需修改 `copy-manga.type.ts`。

### 不修改 DTO

`ThirdPartyComicImageDto` 的 `providerImageId` 和 `url` 均为必填字符串。本计划只改变 provider 层的解析策略，不改变 DTO 契约。

---

## 文件清单

| 文件 | 职责 | 操作 |
|------|------|------|
| `libs/content/src/work/third-party/providers/copy-manga.provider.ts` | provider 解析逻辑 | 修改 `getChapterContent` 和 `toChapterImageItem` |

仅涉及 1 个文件，无新增文件，无 DTO/类型/数据库变更。

---

## 任务 1：恢复图片项容忍策略

**文件：**
- 修改：`libs/content/src/work/third-party/providers/copy-manga.provider.ts:190-195`（`getChapterContent` 中的图片映射）
- 修改：`libs/content/src/work/third-party/providers/copy-manga.provider.ts:278-295`（`toChapterImageItem` 方法）

- [ ] **步骤 1：修改 `getChapterContent` 中的图片映射逻辑**

将 `copy-manga.provider.ts` 第 190-193 行：

```typescript
    const chapterUuid = chapter.uuid
    const images = (chapter?.contents ?? []).map((item, index) =>
      this.toChapterImageItem(chapterUuid, item, index),
    )
```

修改为：

```typescript
    const chapterUuid = chapter.uuid
    const images = (chapter?.contents ?? [])
      .map((item, index) => this.toChapterImageItem(chapterUuid, item, index))
      .filter((item): item is NonNullable<typeof item> => item !== null)
```

- [ ] **步骤 2：修改 `toChapterImageItem` 为容忍模式**

将 `copy-manga.provider.ts` 第 278-295 行：

```typescript
  // 将章节图片结果收敛为共享 DTO；图片身份和 URL 缺失时失败关闭。
  private toChapterImageItem(
    chapterUuid: string,
    item: CopyMangaChapterContentImage,
    index: number,
  ) {
    if (!item.uuid || !item.url) {
      throw this.providerError(
        `第三方章节图片字段缺失: ${chapterUuid}:${index + 1}`,
      )
    }

    return {
      providerImageId: item.uuid,
      url: item.url,
      sortOrder: index + 1,
    }
  }
```

修改为：

```typescript
  // 将章节图片结果收敛为共享 DTO；url 缺失的图片项跳过，uuid 缺失时合成稳定 ID。
  private toChapterImageItem(
    chapterUuid: string,
    item: CopyMangaChapterContentImage,
    index: number,
  ) {
    if (!item.url) {
      return null
    }

    return {
      providerImageId: item.uuid ?? `${chapterUuid}:${index + 1}`,
      url: item.url,
      sortOrder: index + 1,
    }
  }
```

- [ ] **步骤 3：运行 type-check 确认无类型错误**

运行：

```powershell
pnpm type-check
```

预期：PASS，无新增类型错误

- [ ] **步骤 4：Commit**

```bash
git add libs/content/src/work/third-party/providers/copy-manga.provider.ts
git commit -m "fix(content): tolerate missing image fields in CopyManga chapter content"
```

---

## 影响范围分析

| 维度 | 影响 |
|------|------|
| API 路由 | 无 |
| DTO | 无 |
| 数据库字段 | 无 |
| 错误语义 | `url` 缺失的图片项不再导致整章节失败；`images.length === 0` 的 fail-closed 语义不变 |
| 迁移策略 | 无 |
| 安全策略 | 无（host 白名单和 DNS 地址防护在 `remote-image-import.service.ts` 中独立执行，不受 provider 层解析策略影响） |
| 图片域名 | 无影响 |

---

## 风险

| 风险 | 概率 | 缓解 |
|------|------|------|
| 跳过无效图片导致章节页数不完整 | 低 | 上游 `url` 缺失的图片本就无法下载；跳过比整章节拒绝更优，且后续仍可通过同步补充 |
| 合成的 `providerImageId` 与上游 `uuid` 冲突 | 极低 | 合成 ID 格式为 `{chapterUuid}:{index+1}`，与上游 UUID 格式不同，不会冲突 |
| `filter(Boolean)` 类型推断不精确 | 已消除 | 使用 `filter((item): item is NonNullable<typeof item> => item !== null)` 显式收窄类型 |

---

## 不在范围内

- 不修改 `copy-manga.type.ts`（类型定义已正确反映上游数据可缺失）
- 不修改 `remote-image-import.service.ts`（安全校验逻辑无需改动）
- 不修改 `imageHostPolicy` 白名单（本次只修复图片字段缺失问题，图片域名白名单是独立问题）
- 不修改导入/同步 workflow 的错误处理逻辑（provider 层修复后 workflow 行为自动恢复）
- 不修改 DTO 契约
