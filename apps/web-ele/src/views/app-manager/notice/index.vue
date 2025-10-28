<script lang="ts" setup>
import type { VxeGridProps } from '#/adapter/vxe-table';
import type {
  CreateNoticeDto,
  NoticePageResponseDto,
  UpdateNoticeDto,
} from '#/apis/types/notice';

import { Page, useVbenModal } from '@vben/common-ui';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  clientPagePageApi,
  noticeBatchDeleteApi,
  noticeBatchUpdateStatusApi,
  noticeCreateApi,
  noticeDetailApi,
  noticePageApi,
  noticeUpdateApi,
} from '#/apis';
import EsModalForm from '#/components/es-modal-form/index.vue';
import { useBitMask } from '#/hooks/useBitmask';
import { useMessage } from '#/hooks/useFeedback';
import { createSearchFormOptions } from '#/utils/grid-form-config';
import NoticeDetail from '#/views/app-manager/notice/detail.vue';

import {
  enablePlatform,
  formSchema,
  getPublishStatus,
  noticeColumns,
  noticeFilter,
  noticePriorityObj,
  noticeTypeObj,
  publishStatusObj,
} from './shared';

const clientPageObj = ref<Record<string, string>>({});

clientPagePageApi({
  pageSize: 500,
}).then((res) => {
  const pageOptions =
    res.list?.map((pageItem) => {
      clientPageObj.value[pageItem.id!] = pageItem.pageName;
      return {
        label: pageItem.pageName,
        value: pageItem.id,
        ...pageItem,
      };
    }) || [];

  noticeFilter.forEach((item) => {
    if (item.fieldName === 'pageId' && item.componentProps) {
      (item.componentProps as any).options = pageOptions;
    }
  });
  formSchema.forEach((item) => {
    if (item.fieldName === 'pageId' && item.componentProps) {
      (item.componentProps as any).options = pageOptions;
    }
  });

  gridApi.formApi.updateSchema(noticeFilter);
});

const gridOptions: VxeGridProps<NoticePageResponseDto> = {
  columns: noticeColumns,
  height: 'auto',
  proxyConfig: {
    ajax: {
      query: async ({ page }, formValues) => {
        if (Array.isArray(formValues.enablePlatform)) {
          formValues.enablePlatform = formValues.enablePlatform.join(',');
        }
        return await noticePageApi({
          pageIndex: --page.currentPage,
          pageSize: page.pageSize,
          ...formValues,
        });
      },
    },
    sort: true,
  },
};

const [Form, formApi] = useVbenModal({
  connectedComponent: EsModalForm,
});

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: createSearchFormOptions(noticeFilter),
  gridOptions,
});

async function openFormModal(row?: NoticePageResponseDto) {
  let record;
  if (row) {
    record = await noticeDetailApi({ id: row.id });
    record.dateTimeRange = [record.publishStartTime, record.publishEndTime];
  }
  formApi
    .setData({ title: '通知公告', record, bitMaskField: ['enablePlatform'] })
    .open();
}

async function handleSubmit(values: CreateNoticeDto | UpdateNoticeDto) {
  await (values?.id
    ? noticeUpdateApi(values as UpdateNoticeDto)
    : noticeCreateApi(values as CreateNoticeDto));
  formApi.close();
  useMessage.success('操作成功');
  gridApi.reload();
}

async function deleteNotice(record: NoticePageResponseDto) {
  await noticeBatchDeleteApi({ ids: [record.id] });
  useMessage.success('操作成功');
  gridApi.reload();
}

async function togglePublishStatus(record: NoticePageResponseDto) {
  const newStatus = !record.isPublished;
  await noticeBatchUpdateStatusApi({
    ids: [record.id],
    isPublished: newStatus,
  });
  useMessage.success(newStatus ? '发布成功' : '取消发布成功');
  gridApi.reload();
}

function getPublishButtonText(record: NoticePageResponseDto): string {
  const status = getPublishStatus(record.isPublished, record.publishEndTime);

  if (status === 'unpublished') {
    return '发布';
  } else if (status === 'published') {
    return '取消发布';
  } else {
    return '重新发布';
  }
}

function canPublish(record: NoticePageResponseDto): boolean {
  const status = getPublishStatus(record.isPublished, record.publishEndTime);
  return status !== 'expired';
}

const [DetailModal, detailApi] = useVbenModal({
  connectedComponent: NoticeDetail,
});
</script>

<template>
  <Page auto-content-height>
    <Grid>
      <template #toolbar-actions>
        <el-button class="ml-2" type="primary" @click="openFormModal()">
          添加
        </el-button>
      </template>
      <template #title="{ row }">
        <div class="inline-flex">
          <el-tag
            class="mr-2"
            v-if="row.showAsPopup"
            type="danger"
            size="small"
          >
            首
          </el-tag>
          <el-tag class="mr-2" type="danger" v-if="row.isPinned" size="small">
            顶
          </el-tag>
        </div>
        <el-text
          class="cursor-pointer hover:opacity-50"
          type="primary"
          @click="detailApi.setData({ recordId: row.id }).open()"
        >
          {{ row.title }}
        </el-text>
      </template>
      <template #noticeType="{ row }">
        <el-text :style="{ color: noticeTypeObj[row.noticeType]?.color }">
          {{ noticeTypeObj[row.noticeType]?.label }}
        </el-text>
      </template>
      <template #priorityLevel="{ row }">
        <el-text
          :style="{ color: noticePriorityObj[row.priorityLevel]?.color }"
        >
          {{ noticePriorityObj[row.priorityLevel]?.label }}
        </el-text>
      </template>

      <template #pageId="{ row }">
        <el-text>
          {{
            row.pageId && clientPageObj[row.pageId]
              ? clientPageObj[row.pageId]
              : '-'
          }}
        </el-text>
      </template>

      <template #enablePlatform="{ row }">
        <el-text>
          {{
            useBitMask.getLabels(row.enablePlatform, enablePlatform).join('、')
          }}
        </el-text>
      </template>

      <template #publishStatus="{ row }">
        <el-text
          :style="{
            color:
              publishStatusObj[
                getPublishStatus(row.isPublished, row.publishEndTime)
              ]?.color,
          }"
        >
          {{
            publishStatusObj[
              getPublishStatus(row.isPublished, row.publishEndTime)
            ]?.label
          }}
        </el-text>
      </template>

      <template #actions="{ row }">
        <div class="my-1">
          <el-button link type="primary" @click="openFormModal(row)">
            编辑
          </el-button>

          <el-divider direction="vertical" />
          <el-popconfirm
            v-if="canPublish(row)"
            :title="
              row.isPublished ? '确认取消发布当前通知?' : '确认发布当前通知?'
            "
            width="180"
            confirm-button-text="确认"
            cancel-button-text="取消"
            @confirm="togglePublishStatus(row)"
          >
            <template #reference>
              <el-button link :type="canPublish(row) ? 'primary' : 'danger'">
                {{ getPublishButtonText(row) }}
              </el-button>
            </template>
          </el-popconfirm>
          <el-button
            link
            v-else
            disabled
            :style="{
              color: '#d9d9d9',
            }"
          >
            {{ getPublishButtonText(row) }}
          </el-button>
          <el-divider direction="vertical" />
          <el-popconfirm
            title="确认删除当前项?"
            confirm-button-text="确认"
            cancel-button-text="取消"
            @confirm="deleteNotice(row)"
          >
            <template #reference>
              <el-button link type="danger">删除</el-button>
            </template>
          </el-popconfirm>
        </div>
      </template>
    </Grid>

    <Form
      :schema="formSchema"
      :field-mapping-time="[
        ['dateTimeRange', ['publishStartTime', 'publishEndTime']],
      ]"
      :on-submit="handleSubmit"
    />

    <DetailModal />
  </Page>
</template>
