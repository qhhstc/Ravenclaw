"use client";

import { BookOutlined, QuestionCircleOutlined } from "@ant-design/icons";
import { Alert, Divider, Drawer, List, Space, Tag, Typography } from "antd";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { getHelpContent } from "@/lib/help-content";

function BulletList({ items }: { items: string[] }) {
  return (
    <List
      className="page-help-list"
      size="small"
      dataSource={items}
      split={false}
      renderItem={(item, index) => (
        <List.Item className="!flex !items-start !justify-start !px-0 !py-1 !text-left">
          <span className="mr-2 mt-[2px] inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--soft-bg)] text-xs text-[var(--muted)]">{index + 1}</span>
          <span className="min-w-0 flex-1 text-left text-sm leading-6 text-[var(--foreground)]">{item}</span>
        </List.Item>
      )}
    />
  );
}

export default function PageHelpButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const help = useMemo(() => getHelpContent(pathname), [pathname]);

  return (
    <>
      <button
        type="button"
        className="page-help-trigger"
        onClick={() => setOpen(true)}
        title="查看本页使用说明"
      >
        <QuestionCircleOutlined className="page-help-trigger-icon" />
        <span>帮助</span>
      </button>
      <Drawer
        className="page-help-drawer"
        title={
          <Space size={8}>
            <BookOutlined />
            <span>{help.title}</span>
          </Space>
        }
        open={open}
        width={560}
        onClose={() => setOpen(false)}
      >
        <div className="page-help-content space-y-5 text-left">
          <Alert className="!mb-5" type="info" showIcon message={help.summary} />

          <section>
            <Typography.Title level={5} className="!mb-2 !text-[var(--foreground)]">快速上手</Typography.Title>
            <BulletList items={help.quickStart} />
          </section>

          {help.sections.map((section) => (
            <section key={section.title}>
              <Typography.Title level={5} className="!mb-2 !text-[var(--foreground)]">{section.title}</Typography.Title>
              <BulletList items={section.items} />
            </section>
          ))}

          {help.fieldTips?.length ? (
            <section>
              <Typography.Title level={5} className="!mb-2 !text-[var(--foreground)]">字段口径</Typography.Title>
              <div className="space-y-3">
                {help.fieldTips.map((section) => (
                  <div key={section.title} className="rounded-lg border border-[var(--border)] bg-[var(--soft-bg)] p-3">
                    <Typography.Text strong>{section.title}</Typography.Text>
                    <BulletList items={section.items} />
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <Divider className="!my-4" />

          <section>
            <Space className="mb-2" size={8}>
              <Typography.Title level={5} className="!m-0 !text-[var(--foreground)]">相关业务流程</Typography.Title>
              <Tag color="blue">交叉功能</Tag>
            </Space>
            <BulletList items={help.relatedFlows} />
          </section>
        </div>
      </Drawer>
    </>
  );
}
