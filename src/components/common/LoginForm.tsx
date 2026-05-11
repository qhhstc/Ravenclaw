"use client";

import { LockOutlined, MailOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Form, Input, Typography } from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";

type LoginValues = {
  email: string;
  password: string;
};

export default function LoginForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onFinish(values: LoginValues) {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "登录失败，请稍后重试");
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#eef3fb] px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-80px)] w-full max-w-[1120px] items-center justify-center">
        <div className="grid w-full grid-cols-1 overflow-hidden rounded-lg border border-[#e5eaf2] bg-white shadow-[0_18px_60px_rgba(15,35,80,0.08)] lg:grid-cols-[1fr_420px]">
          <section className="hidden border-r border-[#edf0f5] bg-[#f8fbff] p-10 lg:block">
            <div className="mb-14 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-md bg-[#1677ff] text-lg font-bold text-white">
                跨
              </div>
              <Typography.Title level={3} className="!m-0 !text-[#172033]">
                跨境经营数据中心
              </Typography.Title>
            </div>
            <div className="max-w-[520px]">
              <Typography.Title level={2} className="!mb-4 !text-[32px] !leading-tight !text-[#172033]">
                多渠道经营数据的统一入口
              </Typography.Title>
              <Typography.Paragraph className="!text-base !leading-8 !text-[#667085]">
                覆盖 Amazon、Shopify、WordPress 批发站、TikTok、广告投放、SEO、EDM 与红人合作，先从清晰可靠的后台底座开始。
              </Typography.Paragraph>
            </div>
            <div className="mt-14 grid grid-cols-3 gap-4">
              {["渠道数据", "客户 CRM", "经营看板"].map((item) => (
                <div key={item} className="rounded-md border border-[#e8eef7] bg-white p-4">
                  <div className="text-sm font-semibold text-[#172033]">{item}</div>
                  <div className="mt-2 h-1.5 w-14 rounded-full bg-[#1677ff]" />
                </div>
              ))}
            </div>
          </section>

          <section className="flex items-center justify-center p-6 sm:p-10">
            <Card className="w-full border-0 shadow-none" styles={{ body: { padding: 0 } }}>
              <div className="mb-8">
                <Typography.Title level={2} className="!mb-2 !text-[#172033]">
                  登录后台
                </Typography.Title>
                <Typography.Text className="text-[#667085]">
                  使用管理员邮箱和密码进入经营看板。
                </Typography.Text>
              </div>

              {error ? <Alert className="mb-5" message={error} type="error" showIcon /> : null}

              <Form<LoginValues>
                layout="vertical"
                initialValues={{ email: "admin@example.com" }}
                onFinish={onFinish}
                requiredMark={false}
              >
                <Form.Item
                  label="邮箱"
                  name="email"
                  rules={[
                    { required: true, message: "请输入邮箱" },
                    { type: "email", message: "邮箱格式不正确" },
                  ]}
                >
                  <Input size="large" prefix={<MailOutlined />} placeholder="admin@example.com" />
                </Form.Item>

                <Form.Item label="密码" name="password" rules={[{ required: true, message: "请输入密码" }]}>
                  <Input.Password size="large" prefix={<LockOutlined />} placeholder="admin123456" />
                </Form.Item>

                <Button block type="primary" size="large" htmlType="submit" loading={loading}>
                  登录
                </Button>
              </Form>
            </Card>
          </section>
        </div>
      </div>
    </main>
  );
}
