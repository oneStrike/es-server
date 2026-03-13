# fs-extra 替换指南

## 问题背景

项目中的 `fs-extra` 包被标记为需要替换。根据 [es-tooling/module-replacements](https://github.com/es-tooling/module-replacements/blob/main/docs/modules/fs-extra.md) 的建议，现代 Node.js 已经提供了原生支持，可以替代 `fs-extra` 的大部分功能。

### 为什么要替换 fs-extra？

1. **减少依赖**：`fs-extra` 是一个额外的依赖包，现代 Node.js 已经内置了相同功能
2. **性能优化**：原生 API 通常比第三方包更高效
3. **维护性**：减少对外部包的依赖，降低安全风险和维护成本
4. **现代化**：Node.js 14+ 已经支持 `fs/promises` API，提供了 Promise 化的文件系统操作

## 项目当前使用情况

### 使用位置

- `libs/platform/src/modules/upload/upload.service.ts`

### 使用的 fs-extra 方法

通过代码分析，项目中使用了以下 `fs-extra` 方法：

| 方法 | 使用位置 | 功能 |
|------|---------|------|
| `fs.ensureDirSync(savePath, 0o755)` | 第 61、72 行 | 确保目录存在，不存在则创建（递归创建） |
| `fs.createWriteStream(tempPath)` | 第 180 行 | 创建可写流 |
| `fs.renameSync(tempPath, finalPath)` | 第 190 行 | 重命名文件 |
| `fs.statSync(finalPath).size` | 第 199 行 | 获取文件状态信息 |
| `fs.removeSync(tempPath)` | 第 206 行 | 删除文件或目录 |

## 替换方案

### 方法映射表

根据官方文档，以下是替换方案：

| fs-extra 方法 | Node.js 原生替代 | 说明 |
|---------------|-----------------|------|
| `ensureDirSync(path, mode)` | `fs.mkdirSync(path, { recursive: true, mode })` | Node.js 10.12+ 支持 `recursive` 选项 |
| `createWriteStream(path)` | `fs.createWriteStream(path)` | 原生支持，无需替换 |
| `renameSync(oldPath, newPath)` | `fs.renameSync(oldPath, newPath)` | 原生支持，无需替换 |
| `statSync(path)` | `fs.statSync(path)` | 原生支持，无需替换 |
| `removeSync(path)` | `fs.rmSync(path, { recursive: true, force: true })` | Node.js 14.14+ 支持 `rmSync` |

### 依赖变更

需要移除的依赖：

```json
{
  "dependencies": {
    "fs-extra": "^11.3.4"  // 移除
  },
  "devDependencies": {
    "@types/fs-extra": "^11.0.4"  // 移除
  }
}
```

## 详细修复步骤

### 步骤 1：修改导入语句

**修改前：**

```typescript
import fs from 'fs-extra'
```

**修改后：**

```typescript
import fs from 'node:fs'
```

### 步骤 2：替换 ensureDirSync 方法

**修改前（第 61、72 行）：**

```typescript
fs.ensureDirSync(savePath, 0o755)
```

**修改后：**

```typescript
fs.mkdirSync(savePath, { recursive: true, mode: 0o755 })
```

**说明：**
- Node.js 10.12+ 支持 `recursive: true` 选项，可以递归创建目录
- `mode` 参数用于设置目录权限，等同于原来的第二个参数

### 步骤 3：替换 removeSync 方法

**修改前（第 206 行）：**

```typescript
fs.removeSync(tempPath)
```

**修改后：**

```typescript
fs.rmSync(tempPath, { recursive: true, force: true })
```

**说明：**
- `recursive: true`：递归删除目录及其内容
- `force: true`：如果文件不存在不抛出错误

### 步骤 4：其他方法无需修改

以下方法在 Node.js 原生 `fs` 模块中已经存在，只需更改导入即可：

- `fs.createWriteStream(path)` - 原生支持
- `fs.renameSync(oldPath, newPath)` - 原生支持
- `fs.statSync(path)` - 原生支持

### 步骤 5：移除依赖

运行以下命令移除 `fs-extra` 相关依赖：

```bash
pnpm remove fs-extra @types/fs-extra
```

## 完整代码示例

### 修改后的 upload.service.ts

```typescript
import type { UploadConfigInterface } from '@libs/platform/config'
import type { FastifyRequest } from 'fastify'
import { join } from 'node:path'
import { PassThrough, pipeline } from 'node:stream'
import { promisify } from 'node:util'
import { UploadResponseDto } from '@libs/platform/dto'
import {
  BadRequestException,
  Inject,
  Injectable,
  PayloadTooLargeException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { fileTypeFromBuffer } from 'file-type'
import fs from 'node:fs'  // 修改：使用 node:fs 替代 fs-extra
import { v4 as uuidv4 } from 'uuid'

const pump = promisify(pipeline)

// ... 其余代码保持不变 ...

  generateFilePath(
    uploadPath: string,
    fileType: string,
    scene: string,
    pathSegments?: string[],
  ) {
    // 参数验证
    if (!uploadPath || !fileType) {
      throw new Error('上传失败')
    }

    if (pathSegments && pathSegments?.length > 0) {
      const savePath = join(uploadPath, scene, ...pathSegments)
      // 修改：使用原生 fs.mkdirSync 替代 ensureDirSync
      fs.mkdirSync(savePath, { recursive: true, mode: 0o755 })
      return savePath
    }

    // 使用现代日期处理方式生成日期字符串
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    const dateStr = `${year}-${month}-${day}`
    const savePath = join(uploadPath, scene, dateStr, fileType)
    // 修改：使用原生 fs.mkdirSync 替代 ensureDirSync
    fs.mkdirSync(savePath, { recursive: true, mode: 0o755 })
    // 安全地拼接路径
    return savePath
  }

// ... uploadFile 方法中的修改 ...

    try {
      // 使用管道流式处理文件，使用detectionStream而不是targetFile.file
      await pump(detectionStream, writeStream)
      if (targetFile.file.truncated) {
        throw new PayloadTooLargeException('文件大小超过限制')
      }
      // 生成最终文件名并重命名临时文件
      const finalName = `${uuidv4()}.${ext}`
      const finalPath = join(savePath, finalName)
      // 无需修改：renameSync 是原生方法
      fs.renameSync(tempPath, finalPath)
      const relativePath = finalPath
        .replace(this.uploadConfig.uploadDir, '')
        .replace(BACKSLASH_REGEX, '/')

      return {
        filename: finalName,
        originalName: targetFile.filename,
        filePath: `${this.fileUrlPrefix}${relativePath}`,
        // 无需修改：statSync 是原生方法
        fileSize: fs.statSync(finalPath).size,
        mimeType: mime,
        fileType: ext,
        scene,
        uploadTime: new Date(),
      }
    } catch (error) {
      // 修改：使用原生 fs.rmSync 替代 removeSync
      fs.rmSync(tempPath, { recursive: true, force: true })
      if (error.response.message) {
        throw error
      }
      throw new BadRequestException('上传文件失败')
    }
```

## 版本兼容性

| 功能 | 最低 Node.js 版本 |
|------|------------------|
| `fs.mkdirSync(path, { recursive: true })` | Node.js 10.12.0+ |
| `fs.rmSync(path, { recursive: true, force: true })` | Node.js 14.14.0+ |
| `fs/promises` API | Node.js 14.0.0+ |

**推荐：** 项目应使用 Node.js 16+ 或 18+ LTS 版本以确保完全兼容。

## 测试验证

完成修改后，请执行以下测试：

1. **类型检查**

```bash
pnpm type-check
```

2. **运行测试**

```bash
pnpm test
```

3. **手动测试上传功能**
   - 测试文件上传
   - 测试目录自动创建
   - 测试上传失败时的临时文件清理

## 其他可能需要的替换

如果项目中其他地方使用了以下 `fs-extra` 方法，可参考下表进行替换：

| fs-extra 方法 | Node.js 原生替代 |
|---------------|-----------------|
| `copy(src, dest)` | `fs.cp(src, dest, { recursive: true })` (Node 16.7+) |
| `copySync(src, dest)` | `fs.cpSync(src, dest, { recursive: true })` (Node 16.7+) |
| `move(src, dest)` | `fs.rename()` + `fs.cp()` + `fs.rm()` 组合 |
| `moveSync(src, dest)` | `fs.renameSync()` + `fs.cpSync()` + `fs.rmSync()` 组合 |
| `emptyDir(dir)` | `fs.rm(dir, { recursive: true })` + `fs.mkdir(dir)` |
| `emptyDirSync(dir)` | `fs.rmSync(dir, { recursive: true })` + `fs.mkdirSync(dir)` |
| `ensureFile(file)` | `fs.mkdir()` (创建父目录) + `fs.writeFile()` |
| `readJson(file)` | `fs.readFile()` + `JSON.parse()` |
| `writeJson(file, data)` | `JSON.stringify()` + `fs.writeFile()` |
| `outputFile(file, data)` | `fs.mkdir()` (创建父目录) + `fs.writeFile()` |
| `pathExists(path)` | `fs.access(path)` 或 `fs.stat(path)` |

## 风险评估

| 风险项 | 风险等级 | 缓解措施 |
|--------|---------|---------|
| API 行为差异 | 低 | `mkdirSync` 的 `recursive` 选项与 `ensureDirSync` 行为一致 |
| 错误处理差异 | 低 | `rmSync` 的 `force: true` 选项确保文件不存在时不抛错 |
| 性能影响 | 无 | 原生 API 性能更好 |

## 参考资料

- [es-tooling/module-replacements - fs-extra](https://github.com/es-tooling/module-replacements/blob/main/docs/modules/fs-extra.md)
- [Node.js fs 文档](https://nodejs.org/api/fs.html)
- [Node.js fs/promises 文档](https://nodejs.org/api/fs.html#fspromises-api)

## 总结

此替换方案：

1. ✅ 完全使用 Node.js 原生 API
2. ✅ 保持与原有功能完全一致
3. ✅ 减少外部依赖
4. ✅ 提高代码可维护性
5. ✅ 兼容 Node.js 14.14.0+

建议在完成修改后进行完整的功能测试，确保文件上传功能正常工作。
