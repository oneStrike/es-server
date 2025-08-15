import type { UploadFile } from 'element-plus';

import type { UploadFileResponse } from '#/apis/types/upload';

import { ElMessage } from 'element-plus';

import { requestClient } from '#/utils/request';

type UploadFileRes = UploadFileResponse;
const api = {
  common: '/api/admin/upload/upload-file',
  comic: '/admin/comic/chapter/createComicChapterContent',
};

export async function useUpload(
  files: UploadFile | UploadFile[],
  params: Record<string, any> = {},
  contentType: keyof typeof api = 'common',
  onProgress?: (progressEvent: {
    loaded: number;
    percent: number;
    total: number;
  }) => void,
): Promise<{
  error: any[];
  success: UploadFileRes[];
}> {
  return new Promise((resolve) => {
    const target = Array.isArray(files) ? files : [files];
    const formData = new FormData();
    const errorFile: (typeof target)[number][] = [];

    // 将所有文件添加到 FormData
    target.forEach((item, index) => {
      formData.append(`files[${index}]`, item as unknown as File);
    });

    // 添加额外参数
    for (const paramsKey in params) {
      formData.append(paramsKey, params[paramsKey]);
    }

    requestClient
      .post(api[contentType], formData, {
        headers: {
          'Content-Type': 'multipart/form-data;charset=UTF-8',
        },
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const percent = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total,
            );
            onProgress({
              percent,
              loaded: progressEvent.loaded,
              total: progressEvent.total,
            });
          }
        },
      })
      .then((res) => {
        const result = res as any;
        ElMessage.success('上传成功');

        // 确保返回数组格式
        const successData = Array.isArray(result) ? result : [result];
        resolve({
          success: successData,
          error: errorFile,
        });
      })
      .catch(() => {
        ElMessage.error('上传失败');
        resolve({
          success: [],
          error: target,
        });
      });
  });
}
