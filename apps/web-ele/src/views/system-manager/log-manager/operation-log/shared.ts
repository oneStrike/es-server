import type { VxeGridPropTypes } from '#/adapter/vxe-table';
import type { RequestLogDto } from '#/apis/types/requestLog';
import type { EsFormSchema } from '#/types';

import { formatUTC } from '#/utils';

// 操作日志表格列配置
export const operationLogColumns: VxeGridPropTypes.Columns<RequestLogDto> = [
  {
    title: '序号',
    type: 'seq',
    width: 60,
    fixed: 'left',
  },
  {
    field: 'id',
    title: 'ID',
    width: 80,
  },
  {
    field: 'username',
    title: '用户名',
    width: 120,
    showOverflow: 'tooltip',
    formatter: ({ cellValue }) => cellValue || '-',
  },
  {
    field: 'userId',
    title: '用户ID',
    width: 80,
    formatter: ({ cellValue }) => cellValue || '-',
  },
  {
    field: 'apiType',
    title: '接口类型',
    width: 100,
    formatter: ({ cellValue }) => {
      const typeMap = {
        admin: '管理端',
        client: '客户端',
        system: '系统',
        public: '公开',
      };
      return typeMap[cellValue as keyof typeof typeMap] || cellValue || '-';
    },
  },
  {
    field: 'method',
    title: '请求方法',
    width: 100,
    slots: { default: 'method' },
  },
  {
    field: 'path',
    title: '请求路径',
    minWidth: 200,
    showOverflow: 'tooltip',
  },
  {
    field: 'actionType',
    title: '操作类型',
    width: 120,
    formatter: ({ cellValue }) => cellValue || '-',
  },
  {
    field: 'ip',
    title: 'IP地址',
    width: 140,
    formatter: ({ cellValue }) => cellValue || '-',
  },
  {
    field: 'isSuccess',
    title: '操作结果',
    width: 100,
    slots: { default: 'isSuccess' },
  },
  {
    field: 'userAgent',
    title: '用户代理',
    minWidth: 250,
    showOverflow: 'tooltip',
    formatter: ({ cellValue }) => cellValue || '-',
  },
  {
    field: 'device',
    title: '设备信息',
    minWidth: 200,
    showOverflow: 'tooltip',
    formatter: ({ cellValue }) => {
      if (!cellValue) return '-';
      try {
        const device = JSON.parse(cellValue);
        return `${device.browser || ''} ${device.os || ''}`.trim() || cellValue;
      } catch {
        return cellValue;
      }
    },
  },
  {
    field: 'params',
    title: '请求参数',
    minWidth: 200,
    showOverflow: 'tooltip',
    formatter: ({ cellValue }) => cellValue || '-',
  },
  {
    field: 'content',
    title: '日志内容',
    minWidth: 200,
    showOverflow: 'tooltip',
    formatter: ({ cellValue }) => cellValue || '-',
  },
  {
    field: 'createdAt',
    title: '操作时间',
    width: 160,
    formatter: ({ cellValue }) => formatUTC(cellValue),
    sortable: true,
    fixed: 'right',
  },
];

// 搜索表单配置
export const searchFormSchema: EsFormSchema = [
  {
    component: 'Input',
    fieldName: 'username',
    componentProps: {
      placeholder: '用户名',
      clearable: true,
    },
  },
  {
    component: 'Input',
    fieldName: 'ip',
    componentProps: {
      placeholder: 'IP地址',
      clearable: true,
    },
  },
  {
    component: 'Select',
    fieldName: 'apiType',
    componentProps: {
      placeholder: '接口类型',
      clearable: true,
      options: [
        { label: '管理端', value: 'admin' },
        { label: '客户端', value: 'client' },
        { label: '系统', value: 'system' },
        { label: '公开', value: 'public' },
      ],
    },
  },
  {
    component: 'Select',
    fieldName: 'method',
    componentProps: {
      placeholder: '请求方法',
      clearable: true,
      options: [
        { label: 'GET', value: 'GET' },
        { label: 'POST', value: 'POST' },
        { label: 'PUT', value: 'PUT' },
        { label: 'DELETE', value: 'DELETE' },
        { label: 'PATCH', value: 'PATCH' },
      ],
    },
  },
  {
    component: 'Input',
    fieldName: 'path',
    componentProps: {
      placeholder: '请求路径',
      clearable: true,
    },
  },
  {
    component: 'Select',
    fieldName: 'actionType',
    componentProps: {
      placeholder: '操作类型',
      clearable: true,
      options: [
        { label: '用户登录', value: '用户登录' },
        { label: '用户登出', value: '用户登出' },
        { label: '创建数据', value: '创建数据' },
        { label: '更新数据', value: '更新数据' },
        { label: '删除数据', value: '删除数据' },
        { label: '文件上传', value: '文件上传' },
        { label: '文件下载', value: '文件下载' },
        { label: '数据导出', value: '数据导出' },
        { label: '数据导入', value: '数据导入' },
      ],
    },
  },
  {
    component: 'Select',
    fieldName: 'isSuccess',
    componentProps: {
      placeholder: '操作结果',
      clearable: true,
      options: [
        { label: '成功', value: true },
        { label: '失败', value: false },
      ],
    },
  },
  {
    component: 'DatePicker',
    fieldName: 'dateRange',
    componentProps: {
      type: 'datetimerange',
      startPlaceholder: '开始时间',
      endPlaceholder: '结束时间',
      format: 'YYYY-MM-DD HH:mm:ss',
      valueFormat: 'YYYY-MM-DD HH:mm:ss',
      clearable: true,
    },
  },
];
