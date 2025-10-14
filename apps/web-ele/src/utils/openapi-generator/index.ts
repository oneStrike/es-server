import type { OpenAPIGeneratorConfig } from './config';
import type { GeneratedFile } from './types';

import path from 'node:path';
import process from 'node:process';

import { ESLint } from 'eslint';
import prettier from 'prettier';

import { defaultConfig } from './config';
import { ensureDirectory, writeFile } from './file-utils';
import { OpenAPIGenerator } from './generator';

/**
 * 生成 API 代码的主函数
 */
export async function generateAPIFromOpenAPI(
  openApiUrl: string,
  outputDir: string,
): Promise<GeneratedFile[]> {
  const generator = new OpenAPIGenerator({
    openApiUrl,
    outputDir,
  });

  try {
    // 获取OpenAPI文档
    console.log('正在获取OpenAPI文档...');
    await generator.fetchOpenAPISpec();

    // 生成代码
    console.log('正在生成API代码...');
    const files = generator.generateAPICode();

    return files;
  } catch (error) {
    console.error('生成API代码失败:', error);
    throw error;
  }
}

/**
 * 使用本地 Prettier 配置格式化内容
 */
async function formatWithPrettier(
  content: string,
  filePath: string,
): Promise<string> {
  try {
    const options = await prettier.resolveConfig(process.cwd());
    // 传入 filepath 以便 Prettier 自动选择合适的 parser
    return prettier.format(content, { ...options, filepath: filePath });
  } catch (error) {
    console.warn('Prettier 格式化失败，写入原始内容:', error);
    return content;
  }
}

/**
 * 使用本地 ESLint 规则执行一次修复
 */
async function eslintFix(targets: string[]): Promise<void> {
  try {
    // 将 ESLint 的工作目录指向仓库根目录，确保加载根级配置
    const repoRoot = path.resolve(process.cwd(), '../..');
    const eslint = new ESLint({
      fix: true,
      cwd: repoRoot,
      // 启用所有可用类型的自动修复，确保建议型规则也会应用（如移除未使用代码）
      fixTypes: ['problem', 'suggestion', 'layout'],
      // 如生成目录可能被 .eslintignore 忽略，强制处理
      ignore: false,
    });
    // 将传入的目标路径转换为相对仓库根目录的路径，匹配 ESLint 的 cwd 解析方式
    const relativeTargets = targets.map((p) => {
      const abs = path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
      return path.relative(repoRoot, abs) || '.';
    });
    // 将目录转换为明确的 glob，确保命中生成的源文件与类型文件
    const patterns = relativeTargets.flatMap((p) => [
      `${p.replaceAll('\\\\', '/')}/**/*.{ts,tsx,js,jsx}`,
      `${p.replaceAll('\\\\', '/')}/**/*.d.ts`,
    ]);
    console.log('ESLint cwd:', repoRoot);
    console.log('ESLint patterns count:', patterns.length);
    const results = await eslint.lintFiles(patterns);
    // 统计修复信息（在写回前统计）
    const fixedCount = results.filter(
      (r) => typeof r.output === 'string' && r.output.length > 0,
    ).length;
    await ESLint.outputFixes(results);
    console.log(`ESLint 修复统计：${fixedCount} 个文件已应用修复`);
  } catch (error) {
    console.warn('ESLint 修复失败（忽略，不阻断生成流程）:', error);
  }
}

/**
 * 生成 API 代码的完整流程
 */
export async function generateAPI(
  config: Partial<OpenAPIGeneratorConfig> = {},
): Promise<void> {
  const finalConfig = { ...defaultConfig, ...config };
  const outputDir = path.resolve(process.cwd(), finalConfig.outputDir);
  const typesDir = finalConfig.typesOutputDir;

  try {
    console.log('开始生成API代码...');

    // 确保目录存在
    await ensureDirectory(outputDir);
    await ensureDirectory(typesDir);

    // 生成代码
    const generator = new OpenAPIGenerator(finalConfig);

    // 获取OpenAPI文档
    console.log('正在获取OpenAPI文档...');
    await generator.fetchOpenAPISpec();

    // 生成代码
    console.log('正在生成API代码...');
    const originalFiles = generator.generateAPICode();

    // 检查是否有文件名为 index.ts 的冲突
    const hasIndexConflict = originalFiles.some(
      (file) => file.fileName === 'index.ts',
    );

    // 处理文件名冲突并重新生成内容
    const files: GeneratedFile[] = [];
    const groupedPaths = generator.groupPathsByModule();

    for (const [moduleName, paths] of Object.entries(groupedPaths)) {
      let finalFileName = `${moduleName}.ts`;

      // 如果存在 index.ts 冲突，将其重命名为 indexApi.ts
      if (hasIndexConflict && finalFileName === 'index.ts') {
        finalFileName = 'indexApi.ts';
        console.log(
          `⚠️  检测到文件名冲突，将 ${finalFileName.replace('Api', '')} 重命名为 ${finalFileName}`,
        );
      }

      // 使用正确的最终文件名重新生成内容
      const { apiContent, typesContent } = generator.generateModuleCode(
        moduleName,
        paths,
        finalFileName,
      );

      files.push({
        fileName: finalFileName,
        content: apiContent,
        types: typesContent,
      });
    }

    // 写入文件（写入前先用 Prettier 格式化）
    for (const file of files) {
      // 写入API文件
      const apiFilePath = path.join(outputDir, file.fileName);
      const formattedApi = await formatWithPrettier(file.content, apiFilePath);
      await writeFile(apiFilePath, formattedApi);

      // 写入类型文件
      if (file.types) {
        const typeFileName = file.fileName.replace('.ts', '.d.ts');
        const typeFilePath = path.join(typesDir, typeFileName);
        const formattedDts = await formatWithPrettier(file.types, typeFilePath);
        await writeFile(typeFilePath, formattedDts);
      }
    }

    // 生成索引文件，排除与索引文件同名的API文件
    const exportFiles = files
      .map((file) => file.fileName)
      .filter((fileName) => fileName !== 'index.ts'); // 排除与索引文件同名的文件

    const indexContent = `${exportFiles
      .map((fileName) => `export * from './${fileName.replace('.ts', '')}'`)
      .join('\n')}\n`;

    {
      const indexPath = path.join(outputDir, 'index.ts');
      const formattedIndex = await formatWithPrettier(indexContent, indexPath);
      await writeFile(indexPath, formattedIndex);
    }

    // 统一执行一次 ESLint 修复（不阻断流程）
    await eslintFix([outputDir, typesDir]);

    console.log(`✅ API代码生成完成！共生成 ${files.length} 个模块`);
  } catch (error) {
    console.error('❌ API代码生成失败:', error);
    throw error;
  }
}

// 如果直接运行此脚本
if (process.argv[1] && process.argv[1].endsWith('index.ts')) {
  generateAPI().catch(console.error);
}
