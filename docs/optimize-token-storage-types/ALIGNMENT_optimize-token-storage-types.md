# 优化 Token 存储服务类型定义

## 1. 项目上下文分析

`libs/base/src/modules/auth/base-token-storage.service.ts` 文件定义了 Token 存储的基础服务 `BaseTokenStorageService`，以及相关的数据传输对象 `CreateTokenDto` 和接口 `ITokenDelegate`。

当前存在的问题：
1.  **类型定义分散且硬编码**：`tokenType` 在 `CreateTokenDto` 中硬编码为 `'ACCESS' | 'REFRESH'`，在泛型约束中定义为 `string`。
2.  **`any` 类型滥用**：`ITokenDelegate` 接口中大量使用了 `any`，导致类型安全性降低。
3.  **接口定义内联**：`BaseTokenStorageService` 的泛型 `T` 使用了复杂的内联对象类型，难以复用和维护。
4.  **潜在的大小写不一致**：`CreateTokenDto` 中使用大写 `'ACCESS'`，而 `auth.strategy.ts` 中使用小写 `'access'`，可能导致混淆。

## 2. 需求理解与确认

用户希望优化该文件的类型定义。我建议采取以下方案：

### 优化方案

1.  **提取公共类型定义**：
    *   定义 `TokenType` 类型（或枚举），统一 Token 类型的字面量值。
    *   定义 `ITokenEntity` 接口，替代 `BaseTokenStorageService` 中的内联泛型约束。

2.  **强化 `CreateTokenDto`**：
    *   使用 `TokenType` 替代硬编码字符串。
    *   将 `deviceInfo` 类型从 `any` 优化为 `Record<string, unknown>` 或更具体的结构（如果已知）。

3.  **重构 `ITokenDelegate`**：
    *   引入泛型参数来定义 `CreateInput`、`UpdateInput`、`WhereInput` 等，减少 `any` 的使用。
    *   虽然不能完全去除 `any`（因为这是对 Prisma Delegate 的抽象），但可以通过泛型约束来提供更好的开发体验。

4.  **增加 JSDoc 注释**：
    *   为所有接口和属性添加详细的文档注释。

### 待确认问题

1.  **Token 类型大小写**：目前 `CreateTokenDto` 使用 `'ACCESS' | 'REFRESH'`，建议确认数据库中实际存储的值。通常建议保持一致。如果无法确认，我将暂时保持 `'ACCESS' | 'REFRESH'` 不变，但将其提取为类型别名。
2.  **`deviceInfo` 结构**：是否有明确的结构？如果没有，使用 `Record<string, any>` 比 `any` 稍微好一点，或者保持 `any` 但添加注释说明。

## 3. 拟定修改计划

1.  **定义 `TokenType`**：
    ```typescript
    export type TokenType = 'ACCESS' | 'REFRESH';
    ```

2.  **定义 `ITokenEntity`**：
    ```typescript
    export interface ITokenEntity {
      id: number;
      jti: string;
      userId: number;
      tokenType: string; // 或 TokenType
      expiresAt: Date;
      revokedAt?: Date | null;
      createdAt: Date;
      deviceInfo?: any;
      ipAddress?: string | null;
      userAgent?: string | null;
    }
    ```

3.  **更新 `BaseTokenStorageService`**：
    ```typescript
    export abstract class BaseTokenStorageService<T extends ITokenEntity> ...
    ```

4.  **优化 `ITokenDelegate`**（使用泛型增强）：
    ```typescript
    export interface ITokenDelegate<T, CreateInput = any, UpdateInput = any, WhereInput = any> {
      create: (args: { data: CreateInput }) => Promise<T>;
      createMany: (args: { data: CreateInput[] }) => Promise<any>;
      findUnique: (args: { where: WhereInput }) => Promise<T | null>;
      // ...
    }
    ```

## 4. 最终共识 (待用户确认)

请确认是否同意上述优化方向。
