import { requestClient } from '#/utils/request';
import type {
  UploadFileRequest,
  UploadFileResponse,
  UploadResponseDto,
} from './types/upload.d';

/**
 * 上传文件
 */
export async function uploadFileApi(
  params?: UploadFileRequest,
): Promise<UploadFileResponse> {
  return requestClient.post<UploadFileResponse>(
    '/api/admin/upload/upload-file',
    params,
  );
}
