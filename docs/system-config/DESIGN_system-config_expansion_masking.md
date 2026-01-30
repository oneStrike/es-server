# DESIGN_system-config_expansion_masking

## 1. 需求分析

### 1.1 扩展性需求
用户指出“系统配置后期可能会有很多其他的配置”。
-   **现状**: `SystemConfig` 表目前只有 `aliyunConfig` 字段，且 Service/DTO 是强耦合的。
-   **挑战**: 每次增加新配置（如微信支付、OSS、邮件服务等）都需要修改数据库 Schema、DTO、Service 和 Controller。
-   **目标**: 设计一种更灵活的配置管理方式，或至少规范化扩展流程。考虑到使用 Prisma，完全动态字段（Schema-less）虽然灵活但失去了类型安全，因此**JSON 字段 + 强类型 DTO** 是平衡方案。

### 1.2 脱敏需求
用户要求“对敏感字段添加掩码的功能，只展示一部分，其余的都展示*”。
-   **场景**: 管理员在后台查看配置时，不应直接看到明文的 `Secret` 或 `Password`，但需要看到前几位以确认配置是否存在或正确。
-   **规则**: 保留前 3 位和后 3 位（视长度而定），中间用 `***` 替换。例如 `LTAI4F...s2b` -> `LTA***s2b`。

## 2. 解决方案设计

### 2.1 扩展性方案
为了应对未来的配置扩展，我们采用 **Schema 显式定义字段 + JSON 存储 + DTO 接口约束** 的模式。
虽然 `SystemConfig` 可以加一个 `extraConfig Json?` 来存杂项，但为了类型安全和代码清晰，建议**按领域分组**添加 JSON 字段。

**规范流程**:
1.  **DB**: 在 `SystemConfig` 表中添加新的 JSON 字段（如 `wechatConfig`, `ossConfig`）。
2.  **DTO**: 定义对应的 DTO 类（如 `WechatConfigDto`），并在主 `SystemConfigDto` 中引用。
3.  **Service**: 统一处理加解密逻辑。为了避免 `if (dto.aliyun) ... if (dto.wechat) ...` 的无限膨胀，我们将提取一个通用的 **SensitiveFieldHandler** 或在 Service 中使用配置映射表来处理加密/掩码。

### 2.2 脱敏方案
在 `SystemConfigService` 中增加专门的 `getMaskedConfig` 方法供 Controller 调用。

**掩码规则**:
-   长度 <= 6: 全掩码 `******`
-   长度 > 6: 前 2 位 + `****` + 后 2 位 (或前3后3，视具体 UI 需求，这里采用灵活策略)

**API 交互逻辑**:
-   **GET**: 返回脱敏后的数据。
-   **UPDATE**:
    -   前端提交的数据中，敏感字段如果是 `***` 格式（未修改），后端应当**忽略**该字段的更新（保持原值）。
    -   前端提交的数据中，敏感字段如果是明文（已修改），后端应当**加密并更新**。

## 3. 详细设计

### 3.1 工具函数 `maskString`
位置: `libs/base/src/utils/mask.ts`
```typescript
export function maskString(str: string, visibleStart = 3, visibleEnd = 3): string {
  if (!str)
{ return '' }
  if (str.length <= visibleStart + visibleEnd) {
    return '*'.repeat(8) // 长度不够时全掩码，固定长度避免暴露真实长度
  }
  return `${str.slice(0, visibleStart)}****${str.slice(-visibleEnd)}`
}

export function isMasked(str: string): boolean {
  return str.includes('****')
}
```

### 3.2 Service 改造
`SystemConfigService` 需要增强：

1.  `findActiveConfig()`: 返回 **解密后的明文** (供内部模块调用，如 SmsService)。
2.  `findMaskedConfig()`: 返回 **脱敏后的数据** (供 Controller 调用)。
3.  `updateConfig(dto)`: 处理更新逻辑。
    -   检查敏感字段：如果值包含 `****` (即 `isMasked` 为 true)，则从数据库取出旧值覆盖回去（即不更新）。
    -   如果不包含 `****`，则视为新明文，执行加密。

### 3.3 扩展性设计 - 配置注册表
为了避免硬编码所有字段的加解密逻辑，可以在 Service 中定义一个配置描述对象：

```typescript
const CONFIG_METADATA = {
  aliyunConfig: {
    sensitiveFields: ['accessKeyId', 'accessKeySecret']
  },
  // 未来添加:
  // wechatConfig: { sensitiveFields: ['appSecret', 'mchKey'] }
}
```
利用此元数据，可以编写通用的 `maskConfig` 和 `encryptConfig` 方法。

## 4. 实施计划 (Atomize)

1.  **创建工具**: 添加 `libs/base/src/utils/mask.ts`。
2.  **更新 Service**:
    -   引入 `CONFIG_METADATA`。
    -   实现 `findMaskedConfig`。
    -   重构 `updateConfig` 以支持“掩码值忽略更新”逻辑。
3.  **更新 Controller**: 将 `getConfig` 改为调用 `findMaskedConfig`。
4.  **验证**: 测试 GET 接口返回掩码，测试 PUT 接口传回掩码时不覆盖原密码，传回明文时更新密码。
