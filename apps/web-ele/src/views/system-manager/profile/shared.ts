import type { VxeGridPropTypes } from '#/adapter/vxe-table';
import type { RequestLogDetailResponse } from '#/apis/types/requestLog';
import type { EsFormSchema } from '#/types';

import { formatUTC } from '#/utils';

// 获取响应状态颜色
const getResponseStatusColor = (code: number) => {
  if (code >= 200 && code < 300) return 'success';
  if (code >= 400 && code < 500) return 'warning';
  if (code >= 500) return 'danger';
  return 'info';
};

export const loginHistortColumn: VxeGridPropTypes.Columns<RequestLogDetailResponse> =
  [
    {
      field: 'ipAddress',
      title: '登录IP',
      width: 140,
    },
    {
      field: 'ipLocation',
      title: '登录地点',
      width: 120,
    },
    {
      field: 'responseCode',
      title: '状态',
      width: 80,
    },
    {
      field: 'userAgent',
      title: '浏览器',
      minWidth: 200,
      showOverflow: 'tooltip',
    },
    {
      field: 'createdAt',
      title: '登录时间',
      width: 160,
      formatter: ({ cellValue }) => formatUTC(cellValue),
    },
  ];

// 编辑用户信息表单配置
export const editFormSchema: EsFormSchema = [
  {
    component: 'Upload',
    fieldName: 'avatar',
    label: '头像',
    componentProps: {
      placeholder: '请上传头像',
      maxCount: 1,
    },
  },
  {
    component: 'Input',
    fieldName: 'username',
    label: '用户名',
    rules: 'required',
    componentProps: {
      placeholder: '请输入用户名',
    },
  },
  {
    component: 'Input',
    fieldName: 'mobile',
    label: '手机号',
    rules: 'required',
    componentProps: {
      placeholder: '请输入手机号',
    },
  },
];

// 修改密码表单配置
export const passwordFormSchema: EsFormSchema = [
  {
    component: 'Input',
    fieldName: 'oldPassword',
    label: '原密码',
    rules: 'required',
    componentProps: {
      placeholder: '请输入原密码',
    },
  },
  {
    component: 'Input',
    fieldName: 'newPassword',
    label: '新密码',
    rules: 'required',
    componentProps: {
      placeholder: '请输入新密码',
    },
  },
  {
    component: 'Input',
    fieldName: 'confirmPassword',
    label: '确认密码',
    rules: 'required',
    componentProps: {
      placeholder: '请再次输入新密码',
    },
  },
];
