# CopyManga API Host 白名单修复计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 修复 CopyManga 上游域名迁移导致 discovery 返回的 6 个新 API host 全部被 fail-closed 白名单拒绝的问题。

**架构：** CopyManga 的 host discovery 机制动态返回当前可用的 API host 列表。项目通过 `apiHostPolicy` 白名单对 discovery 返回的 host 执行安全校验（SSRF 防护）。上游已将 API 服务从 `2024manga.com` 体系迁移到 `hotmanga*.com` 和 `*fgjfghkk*.club` 域名，白名单需同步更新。

**技术栈：** NestJS, TypeScript, CopyManga third-party provider

---

## 背景与证据

### discovery 返回（2026-07-04 实测）

```json
{
  "code": 200,
  "results": {
    "api": [
      ["mapi.hotmangasg.com", "mapi.hotmangasd.com", "mapi.hotmangasf.com"],
      ["mapi.elfgjfghkk.club", "mapi.fgjfghkkcenter.club", "mapi.fgjfghkk.club"]
    ]
  }
}
```

### 当前白名单（`copy-manga.provider.ts:32-34`）

```typescript
allowedExactHosts: ['api.2024manga.com'],  // discovery 入口，仍可达
allowedHostSuffixes: ['2024manga.com'],     // 6 个新 host 全部不匹配
```

### 连通性验证结果

| Host | 搜索 | 详情 | 章节列表 | 章节内容 |
|------|------|------|----------|----------|
| `mapi.hotmangasg.com` | ✅ 200 | ✅ 200 | ✅ 200 | ✅ 200 |
| `mapi.hotmangasd.com` | ✅ 200 | — | — | — |
| `mapi.hotmangasf.com` | ✅ 200 | — | — | — |
| `mapi.elfgjfghkk.club` | ✅ 200 | — | — | — |
| `mapi.fgjfghkkcenter.club` | ✅ 200 | — | — | — |
| `mapi.fgjfghkk.club` | ✅ 200 | — | — | — |

---

## 设计决策

### 白名单策略：精确 host + 域名后缀

| 新增 host | 域名后缀 | 说明 |
|-----------|----------|------|
| `mapi.hotmangasg.com` | `hotmangasg.com` | 第一组 failover 域名 |
| `mapi.hotmangasd.com` | `hotmangasd.com` | 第一组 failover 域名 |
| `mapi.hotmangasf.com` | `hotmangasf.com` | 第一组 failover 域名 |
| `mapi.elfgjfghkk.club` | `elfgjfghkk.club` | 第二组 failover 域名 |
| `mapi.fgjfghkkcenter.club` | `fgjfghkkcenter.club` | 第二组 failover 域名 |
| `mapi.fgjfghkk.club` | `fgjfghkk.club` | 第二组 failover 域名 |

**为什么用后缀而非精确 host：**

1. CopyManga 已知会频繁轮换域名，使用后缀允许同一域名下的子域变化（如 `mapi` → `api`）
2. 与现有模式一致（现有 `allowedHostSuffixes: ['2024manga.com']` 就是后缀策略）
3. 6 个后缀覆盖 6 个独立的二级域名，粒度足够精确，不会过度放宽
4. DNS 地址防护（`isUnsafeAddress`）仍作为第二层防线阻止内网地址

**保留 `api.2024manga.com` 精确 host：** 该域名仍作为 discovery 入口（`COPY_MANGA_DEFAULT_API_HOST`），必须保留。

**不修改 `COPY_MANGA_DEFAULT_API_HOST`：** `api.2024manga.com` 作为 discovery 入口仍可达且返回正确数据，无需改动。后续如该域名失效，再考虑从 discovery 返回结果中选取入口。

---

## 文件清单

| 文件 | 职责 | 操作 |
|------|------|------|
| `libs/content/src/work/third-party/providers/copy-manga.provider.ts` | provider 策略定义 | 修改 `apiHostPolicy` 白名单 |

仅涉及 1 个文件，无新增文件，无 DTO/类型/数据库变更。

---

## 任务 1：更新 apiHostPolicy 白名单

**文件：**
- 修改：`libs/content/src/work/third-party/providers/copy-manga.provider.ts:32-34`

- [ ] **步骤 1：修改 `apiHostPolicy`，新增 6 个域名后缀**

将 `copy-manga.provider.ts` 第 32-34 行：

```typescript
    apiHostPolicy: {
      allowedExactHosts: ['api.2024manga.com'],
      allowedHostSuffixes: ['2024manga.com'],
```

修改为：

```typescript
    apiHostPolicy: {
      allowedExactHosts: ['api.2024manga.com'],
      allowedHostSuffixes: [
        '2024manga.com',
        'hotmangasg.com',
        'hotmangasd.com',
        'hotmangasf.com',
        'elfgjfghkk.club',
        'fgjfghkkcenter.club',
        'fgjfghkk.club',
      ],
```

保留 `2024manga.com` 后缀以兼容 discovery 入口域名的子域校验（`toSafeRequestTarget` 中对 `api.2024manga.com` 的校验同时命中精确 host 和后缀，不影响逻辑）。

- [ ] **步骤 2：运行 type-check 确认无类型错误**

运行：
```powershell
pnpm type-check
```
预期：PASS，无新增类型错误

- [ ] **步骤 3：验证 discovery 流程（手动 curl 确认白名单逻辑）**

确认 `isAllowedHost` 对 6 个新 host 的校验结果：

```
mapi.hotmangasg.com     → endsWith('.hotmangasg.com')     → true ✅
mapi.hotmangasd.com     → endsWith('.hotmangasd.com')     → true ✅
mapi.hotmangasf.com     → endsWith('.hotmangasf.com')     → true ✅
mapi.elfgjfghkk.club    → endsWith('.elfgjfghkk.club')    → true ✅
mapi.fgjfghkkcenter.club → endsWith('.fgjfghkkcenter.club') → true ✅
mapi.fgjfghkk.club      → endsWith('.fgjfghkk.club')      → true ✅
```

- [ ] **步骤 4：Commit**

```bash
git add libs/content/src/work/third-party/providers/copy-manga.provider.ts
git commit -m "fix(content): update CopyManga API host whitelist for upstream domain migration"
```

---

## 影响范围分析

| 维度 | 影响 |
|------|------|
| API 路由 | 无 |
| DTO | 无 |
| 数据库字段 | 无 |
| 错误语义 | 无（fail-closed 策略不变，仅扩大白名单） |
| 迁移策略 | 无 |
| 安全策略 | 白名单从 1 后缀扩大到 7 后缀，仍保持域名级精度，DNS 地址防护不变 |
| 图片域名 | 无影响（`imageHostPolicy` 白名单 `mangafunb.fun` 已匹配上游图片域名） |

## 风险

| 风险 | 概率 | 缓解 |
|------|------|------|
| CopyManga 再次轮换域名 | 高 | 后缀策略已覆盖子域变化；如二级域名变更需再次更新白名单 |
| 新增后缀过宽 | 低 | 6 个后缀均为独立二级域名，不接受任意 `.com`/`.club`，精度足够 |
| `api.2024manga.com` 未来失效 | 中 | 届时需更换 `COPY_MANGA_DEFAULT_API_HOST`，本次不改 |

## 不在范围内

- 不修改 `COPY_MANGA_DEFAULT_API_HOST`（discovery 入口仍可用）
- 不修改 `imageHostPolicy`（图片域名白名单已匹配）
- 不修改 `normalizeDiscoveredApiHost` / `isAllowedHost` 校验逻辑
- 不修改 `copy-manga-http.client.ts`（HTTP client 逻辑无需改动）
- 不新增配置项或环境变量（白名单保持硬编码在 provider policy 中，与现有架构一致）
