import type { NoticePageResponseDto } from '#/apis/types/notice';
import type { EsFormSchema } from '#/types';

import { formatUTC, formSchemaTransform } from '#/utils';

export const noticeType = [
  {
    label: '系统通知',
    value: 0,
    color: '#1890ff', // 蓝色
  },
  {
    label: '活动公告',
    value: 1,
    color: '#52c41a', // 绿色
  },
  {
    label: '维护通知',
    value: 2,
    color: '#faad14', // 橙色
  },
  {
    label: '更新公告',
    value: 3,
    color: '#722ed1', // 紫色
  },
];

export const noticeTypeObj: Record<number, { color: string; label: string }> =
  {};
for (const item of noticeType) {
  noticeTypeObj[item.value] = {
    label: item.label,
    color: item.color,
  };
}

export const enablePlatform = [
  {
    label: 'H5',
    value: 1,
  },
  {
    label: 'APP',
    value: 2,
  },
  {
    label: '小程序',
    value: 4,
  },
];

export const noticePriority = [
  {
    label: '低优先级',
    value: 0,
    color: '#52c41a',
  },
  {
    label: '中等优先级',
    value: 1,
    color: '#1890ff',
  },
  {
    label: '高优先级',
    value: 2,
    color: '#fa8c16',
  },
  {
    label: '紧急',
    value: 3,
    color: '#ff4d4f',
  },
];

export const noticePriorityObj: Record<
  number,
  { color: string; label: string }
> = {};
for (const item of noticePriority) {
  noticePriorityObj[item.value] = {
    label: item.label,
    color: item.color,
  };
}

// 发布状态配置
export const publishStatus = [
  {
    label: '未发布',
    value: 'unpublished',
    color: '#8c8c8c', // 灰色
  },
  {
    label: '已发布',
    value: 'published',
    color: '#52c41a', // 绿色
  },
  {
    label: '已过期',
    value: 'expired',
    color: '#ff4d4f', // 红色
  },
];

export const publishStatusObj: Record<
  string,
  { color: string; label: string }
> = {};
for (const item of publishStatus) {
  publishStatusObj[item.value] = {
    label: item.label,
    color: item.color,
  };
}

// 获取发布状态的函数
export function getPublishStatus(
  isPublished: boolean,
  publishEndTime?: string,
): string {
  if (!isPublished) {
    return 'unpublished';
  }

  if (publishEndTime && new Date(publishEndTime) < new Date()) {
    return 'expired';
  }

  return 'published';
}

export const formSchema: EsFormSchema = [
  {
    component: 'Input',
    componentProps: {
      placeholder: '请输入通知标题',
    },
    fieldName: 'title',
    label: '通知标题',
    rules: 'required',
  },
  {
    label: '通知类型',
    fieldName: 'noticeType',
    component: 'Select',
    rules: 'required',
    componentProps: {
      placeholder: '请选择通知类型',
      options: noticeType,
      class: 'w-full',
    },
  },
  {
    label: '发布平台',
    fieldName: 'enablePlatform',
    component: 'CheckboxGroup',
    rules: 'required',
    componentProps: {
      placeholder: '请选择发布平台',
      options: enablePlatform,
      valueType: 'bitMask',
    },
  },
  {
    label: '紧急程度',
    fieldName: 'priorityLevel',
    component: 'Select',
    rules: 'required',
    componentProps: {
      placeholder: '请选择紧急程度',
      options: noticePriority,
      class: 'w-full',
    },
  },
  {
    label: '跳转页面',
    fieldName: 'pageCode',
    component: 'Select',
    componentProps: {
      placeholder: '请选择跳转页面',
      options: [],
      class: 'w-full',
    },
  },
  {
    label: '通知时间',
    fieldName: 'dateTimeRange',
    component: 'DatePicker',
    componentProps: {
      type: 'daterange',
      valueFormat: 'YYYY-MM-DD',
    },
  },

  {
    label: '是否置顶',
    fieldName: 'isPinned',
    component: 'RadioGroup',
    componentProps: {
      placeholder: '请选择是否置顶',
      options: [
        {
          label: '是',
          value: true,
        },
        {
          label: '否',
          value: false,
        },
      ],
    },
  },
  {
    label: '首页弹窗展示',
    fieldName: 'showAsPopup',
    component: 'RadioGroup',
    componentProps: {
      placeholder: '请选择是否首页弹窗展示',
      options: [
        {
          label: '是',
          value: true,
        },
        {
          label: '否',
          value: false,
        },
      ],
    },
  },
  {
    fieldName: 'popupBackgroundImage',
    component: 'Upload',
    label: '弹窗背景',
    componentProps: {
      maxCount: 1,
      returnDataType: 'url',
    },
  },
  {
    label: '内容',
    fieldName: 'content',
    component: 'RichText',
    formItemClass: 'col-span-2',
    rules: 'required',
    componentProps: {
      placeholder: '请输入内容...',
    },
  },
];

export const noticeColumns =
  formSchemaTransform.toTableColumns<NoticePageResponseDto>(formSchema, {
    content: {
      hide: true,
    },
    showAsPopup: {
      hide: true,
    },
    isPinned: {
      hide: true,
    },
    popupBackgroundImage: {
      hide: true,
    },
    actions: {
      show: true,
      width: 210,
    },
    title: {
      slots: { default: 'title' },
      showOverflow: 'tooltip',
    },
    dateTimeRange: {
      sort: 98,
      formatter: ({ row }: any) => {
        return `${formatUTC(row.publishStartTime, 'YYYY-MM-DD')} - ${formatUTC(row.publishEndTime, 'YYYY-MM-DD')}`;
      },
    },
    publishStatus: {
      title: '发布状态',
      sort: 99,
      width: 120,
      slots: { default: 'publishStatus' },
    },
    noticeType: {
      slots: { default: 'noticeType' },
    },
    priorityLevel: {
      slots: { default: 'priorityLevel' },
    },
    enablePlatform: {
      slots: { default: 'enablePlatform' },
    },
    pageCode: {
      slots: { default: 'pageCode' },
    },
  });

export const noticeFilter = formSchemaTransform.toSearchSchema(formSchema, {
  title: {
    sort: 99,
  },
  dateTimeRange: {
    sort: 98,
  },
  noticeType: {
    sort: 97,
  },
  priorityLevel: {
    sort: 96,
  },
  enablePlatform: {
    sort: 95,
  },
  pageCode: {
    sort: 94,
  },
});
