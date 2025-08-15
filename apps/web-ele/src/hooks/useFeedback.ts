import type { AsyncFn } from '#/types';

import { ElMessage, ElMessageBox } from 'element-plus';

export const useMessage: typeof ElMessage = ElMessage;

export type UseConfirm = (
  type: 'clear' | 'delete' | 'disable' | 'enable',
  handler: AsyncFn,
  callback?: () => void,
) => void;

export const useConfirm: UseConfirm = (type, handler, callback?) => {
  let message = '';
  let prompt = '';
  switch (type) {
    case 'clear': {
      message = '是否清空当前数据？注意清空后无法恢复！！！';
      prompt = '清空成功';
      break;
    }
    case 'delete': {
      message = '是否删除当前数据？';
      prompt = '删除成功';
      break;
    }
    case 'disable': {
      message = '是否禁用当前数据？';
      prompt = '禁用成功';
      break;
    }
    case 'enable': {
      message = '是否启用当前数据？';
      prompt = '启用成功';
      break;
    }
  }

  ElMessageBox.confirm(message, '警告', {
    type: 'warning',
    draggable: true,
  }).then(async () => {
    await handler();
    useMessage.success(prompt);
    if (callback) {
      callback();
    }
  });
};
