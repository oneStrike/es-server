import type { VxeGridPropTypes } from '#/adapter/vxe-table';
import type { RequestLogDto } from '#/apis/types/requestLog';
import type { EsFormSchema } from '#/types';

import { formatUTC } from '#/utils';

// 登录日志表格列配置
export const loginLogColumns: VxeGridPropTypes.Columns<RequestLogDto> = [
  {
    title: '序号',
    type: 'seq',
    width: 60,
    fixed: 'left',
  },
  {
    field: 'username',
    title: '用户名',
    width: 120,
    showOverflow: 'tooltip',
  },
  {
    field: 'ip',
    title: '登录IP',
    width: 140,
  },
  {
    field: 'userAgent',
    title: '用户代理',
    minWidth: 250,
    showOverflow: 'tooltip',
    formatter: ({ cellValue }) => cellValue || '-',
  },
  {
    field: 'createdAt',
    title: '登录时间',
    width: 160,
    formatter: ({ cellValue }) => formatUTC(cellValue),
    sortable: true,
  },
  {
    field: 'isSuccess',
    title: '登录结果',
    width: 120,
    slots: { default: 'isSuccess' },
  },
  {
    field: 'content',
    title: '日志内容',
    minWidth: 200,
    showOverflow: 'tooltip',
    formatter: ({ cellValue }) => cellValue || '-',
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
    fieldName: 'isSuccess',
    componentProps: {
      placeholder: '登录结果',
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
