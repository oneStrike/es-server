# 作品与章节权限及交易逻辑重构方案

## 1. 核心问题回顾
经过代码与数据模型的深度对比，确认当前 **下载逻辑 (Download Logic)** 存在严重缺陷，且 **交易逻辑 (Transaction Logic)** 存在并发隐患。

### 1.1 阻断性 BUG (Critical)
*   **代码与模型不匹配**: `work-chapter.service.ts` 中的 `reportDownload` 方法引用了 `Work` 模型中**不存在**的字段：`downloadRule`, `requiredDownloadLevelId`, `downloadPoints`。这导致下载功能完全不可用。
*   **继承逻辑缺失**: 目前 `resolveChapterPermission` 未处理 `canDownload` 的继承，导致章节下载权限与整体权限体系脱节。

### 1.2 并发隐患 (High)
*   **非原子操作**: `UserBalanceService` 和 `UserPointService` 在扣除余额/积分时，使用“读-改-写”模式，在高并发下会导致数据不一致（如余额扣成负数或少扣）。

---

## 2. 重构目标：逻辑完全统一
根据业务需求，**下载权限逻辑与其他权限（阅读、购买、兑换）保持完全一致**。

### 2.1 统一权限继承规则 (Unified Permission Inheritance)
所有的章节权限（阅读、购买、兑换、下载）**统一**由 `viewRule` 字段控制是否继承。

*   **判定条件**: `Chapter.viewRule === INHERIT (-1)`
*   **继承行为**:
    *   **满足条件 (INHERIT)**：章节的**所有配置**（包括 `canDownload`）直接取自作品（Work）。
    *   **不满足条件 (自定义)**：章节的**所有配置**（包括 `canDownload`）仅取决于章节自身设置，**完全忽略作品的配置**（包括作品是否允许下载）。

### 2.2 统一权限校验逻辑 (Unified Permission Validation)
无论是阅读还是下载，都需要经过相同的权限校验流程。

1.  **解析有效权限 (`resolveChapterPermission`)**: 获取最终生效的 `viewRule`, `price`, `canDownload` 等配置。
2.  **通用权限校验 (`validateViewPermission`)**: 检查用户是否满足 `viewRule` (如会员等级、登录状态)。
3.  **付费/兑换校验**: 如果是付费/积分章节，检查是否已购买/已兑换。
4.  **操作特定校验**:
    *   对于下载操作：额外检查 `effectivePermission.canDownload` 是否为 `true`。

---

## 3. 详细逻辑梳理

### 3.1 权限解析逻辑 (`resolveChapterPermission`)
**位置**: `libs/content/src/work/chapter/work-chapter.service.ts`

该方法需重构以包含 `canDownload` 的解析，且去除之前的“总闸”逻辑。

**输入**: `Chapter`, `Work` (可选)
**输出**: `EffectivePermission` 对象 (新增 `canDownload`)

**逻辑伪代码**:
```typescript
function resolveChapterPermission(chapter, work) {
    // 1. 如果没有传入 work，则查询数据库获取 (仅在需要继承时才必须)
    // 优化：如果不需要继承，且外部没传 work，可以不查 work

    // 2. 初始化有效权限对象
    let effective = {};

    // 3. 判断是否继承
    if (chapter.viewRule === INHERIT) {
        // 确保 work 存在
        const currentWork = work || fetchWork(chapter.workId);

        // 继承模式：全部取 Work 的值
        effective.viewRule = currentWork.viewRule;
        effective.requiredViewLevelId = currentWork.requiredViewLevelId;
        effective.price = currentWork.chapterPrice;
        effective.exchangePoints = currentWork.chapterExchangePoints;
        effective.canExchange = currentWork.canExchange;
        effective.canDownload = currentWork.canDownload; // 继承下载配置
    } else {
        // 自定义模式：全部取 Chapter 的值
        // 此时完全不参考 Work 的配置，即使 Work 禁止下载，只要 Chapter 允许即可下载
        effective.viewRule = chapter.viewRule;
        effective.requiredViewLevelId = chapter.requiredViewLevelId;
        effective.price = chapter.price;
        effective.exchangePoints = chapter.exchangePoints;
        effective.canExchange = chapter.canExchange;
        effective.canDownload = chapter.canDownload;     // 自定义下载配置
    }

    return effective;
}
```

### 3.2 下载处理逻辑 (`reportDownload`)
**位置**: `libs/content/src/work/chapter/work-chapter.service.ts`

**修正点**:
1.  **移除** 所有对 `downloadRule`, `requiredDownloadLevelId`, `downloadPoints` 的引用。
2.  调用 `resolveChapterPermission` 获取 `effectivePermission`。
3.  **执行完整的权限校验**（不仅是检查 `canDownload`，还要检查 `viewRule`）。

**逻辑流程**:
1.  查询 `Chapter` 和 `Work`。
2.  检查是否已下载 (`downloadService.checkDownloadStatus`) -> 是则抛出异常。
3.  调用 `resolveChapterPermission(chapter, work)` 获取 `effective`。
4.  **特定开关检查**: `if (!effective.canDownload) throw Error("禁止下载")`。
5.  **通用权限检查 (新增)**:
    *   调用 `userPermissionService.validateViewPermission(effective.viewRule, ...)`
    *   确保用户满足阅读权限（如会员等级）。
6.  **付费/兑换检查**:
    *   如果 `effective.viewRule === POINTS` (付费/积分章节):
        *   检查是否已购买 (`workChapterPurchase.exists`) -> 否则抛出异常 "请先购买或兑换"。
7.  调用 `downloadService.recordDownload` 记录下载。
8.  触发下载成长事件。

### 3.3 积分兑换逻辑 (`exchangeChapter`)
**位置**: `libs/content/src/work/chapter/work-chapter.service.ts`

**逻辑保持不变，但需注意**:
*   依赖 `resolveChapterPermission` 正确返回 `exchangePoints` 和 `canExchange`。
*   **并发修正**: 调用 `userPointService.consumePoints` 时需确保原子性。

### 3.4 余额购买逻辑 (`incrementPurchaseCount`)
**位置**: `libs/content/src/work/chapter/work-chapter.service.ts`

**逻辑保持不变，但需注意**:
*   依赖 `resolveChapterPermission` 正确返回 `price`。
*   **并发修正**: 调用 `userBalanceService.changeBalance` 时需确保原子性。

---

## 4. 并发安全修复方案

### 4.1 余额扣除 (`UserBalanceService.changeBalance`)
**当前**:
```typescript
const user = await prisma.appUser.findUnique(...)
if (user.balance < amount) throw ...
await prisma.appUser.update({ data: { balance: user.balance + amount } }) // 危险！
```

**修正**:
```typescript
// 1. 使用 update 的原子操作 decrement/increment
// 2. 利用数据库约束防止余额为负 (Check Constraint) 或在应用层捕获更新失败
// 由于 Prisma 暂不支持直接 catch Check Constraint 错误转为友好提示，
// 推荐做法：updateMany 带 where 条件 (乐观锁变种)

const result = await prisma.appUser.updateMany({
  where: { 
    id: userId, 
    balance: { gte: Math.abs(amount) } // 确保余额足够
  },
  data: { 
    balance: { decrement: Math.abs(amount) } 
  }
});

if (result.count === 0) {
  throw new BadRequestException('余额不足或用户不存在');
}

// 记录日志 (异步或同事务中)
// 注意：如果需要严格的事务记录，需要使用 interactive transactions
```

### 4.2 积分扣除 (`UserPointService.consumePoints`)
同上，使用 `points: { decrement: amount }` 替代内存计算。

---

## 5. 总结与行动清单

1.  **WorkChapterService**:
    *   [ ] 重构 `resolveChapterPermission`：添加 `canDownload` 处理，严格遵循继承/自定义逻辑。
    *   [ ] 重构 `reportDownload`：
        *   移除无效字段引用。
        *   增加 `validateViewPermission` 调用，确保下载前已满足阅读权限。
        *   对接新的权限解析结果。
2.  **UserBalanceService**:
    *   [ ] 重构 `changeBalance`：使用 Prisma 原子操作。
3.  **UserPointService**:
    *   [ ] 重构 `consumePoints`：使用 Prisma 原子操作。

此方案在不修改数据模型（Schema）的前提下，统一了所有权限的处理逻辑，消除了下载逻辑的特殊性，并修复了并发隐患。
