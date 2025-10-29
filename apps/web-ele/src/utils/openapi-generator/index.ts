import type { OpenAPIGeneratorConfig } from './config';
import type { GeneratedFile } from './types';

import path from 'node:path';
import process from 'node:process';

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

    // 写入文件
    for (const file of files) {
      // 写入API文件
      const apiFilePath = path.join(outputDir, file.fileName);
      await writeFile(apiFilePath, file.content);

      // 写入类型文件
      if (file.types) {
        const typeFileName = file.fileName.replace('.ts', '.d.ts');
        const typeFilePath = path.join(typesDir, typeFileName);
        await writeFile(typeFilePath, file.types);
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
      await writeFile(indexPath, indexContent);
    }

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
