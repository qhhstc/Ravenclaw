import { getSelectedRoute } from "@/lib/routes";

export type HelpSection = {
  title: string;
  items: string[];
};

export type HelpContent = {
  title: string;
  summary: string;
  quickStart: string[];
  sections: HelpSection[];
  relatedFlows: string[];
  fieldTips?: HelpSection[];
};

const sharedFlows = [
  "基础初始化：基础资料 → 供应商 → 产品库 → 客户档案。",
  "销售业务：询盘/报价 → 转订单 → 状态备注/附件 → 回款跟进。",
  "利润核算：订单商品 → 成本分项 → 汇率 → 毛利 → 利润报表。",
  "经营分析：渠道数据 W1-W5 → 经营看板 → AI 分析 → 预警/预算建议。",
];

const helpByRoute: Record<string, HelpContent> = {
  "/dashboard": {
    title: "经营看板使用说明",
    summary: "经营看板把渠道周数据、四板块经营、AI 分析、预警和预算建议放在一起，适合管理员/财务做经营复盘。",
    quickStart: [
      "先选择年份、月份、季度、品牌、店铺或币种。",
      "查看顶部 KPI、趋势图和渠道 ROI 排行，判断本月整体表现。",
      "查看“四板块经营”，确认亚马逊、独立站、TikTok、B端的销售额、毛利、ROI 和关键动作。",
      "管理员可点击“AI 分析四板块经营”，生成评级、风险提示和预算建议。",
      "查看“预警与动作”，优先处理 C/D 等级预警。",
    ],
    sections: [
      {
        title: "角色可见范围",
        items: ["管理员可看完整全局经营数据和预算建议。", "财务可看财务和利润相关经营数据。", "业务员不显示公司整体毛利、预算建议和全局 AI 经营分析。"],
      },
      {
        title: "AI 分析怎么用",
        items: ["AI 分析不会自动运行，必须管理员手动点击。", "AI 结果写入四板块经营计划，不会覆盖渠道明细。", "AI 建议只是辅助判断，后续可以人工补充负责人、deadline 和备注。"],
      },
    ],
    relatedFlows: [sharedFlows[3], sharedFlows[2]],
    fieldTips: [
      { title: "核心口径", items: ["经营毛利 = 销售额 - 广告投入 - 产品成本 - 其他成本。", "毛利率 = 经营毛利 ÷ 销售额；销售额为 0 时显示 —。", "ROI = 销售额 ÷ 广告投入；广告为 0 时显示 —。"] },
      { title: "评级", items: ["S/A/B/C 评级支持人工或 AI，人工优先，AI 兜底。", "预警等级使用 A/B/C/D，D 风险最高。"] },
    ],
  },
  "/channel-data": {
    title: "渠道数据使用说明",
    summary: "渠道数据页用于维护客户原 WPS 渠道效率追踪表里的 W1-W5 销售和广告数据，并计算月度、季度 ROI、广告占销和销售占比。",
    quickStart: [
      "选择年月、品牌、平台、店铺、业务线或渠道类型后点击查询。",
      "在表格中录入 W1-W5 销售额和广告费。",
      "点击“保存本月数据”写入数据库。",
      "需要批量维护时，先下载导入模板，填好后导入 Excel。",
      "管理员可点击“AI 分析当前渠道”，生成渠道级评级、总结、风险和建议动作。",
    ],
    sections: [
      {
        title: "哪些字段可以改",
        items: ["W1-W5 销售和广告可直接编辑。", "产品成本、其他成本、人工评级、人工建议、负责人、deadline 和备注可维护。", "月销售、月广告、ROI、广告占销、销售占比、季度指标由系统计算。"],
      },
      {
        title: "AI 和人工字段",
        items: ["AI 分析结果写在渠道级记录里。", "人工评级/人工建议优先展示，AI 评级/AI 建议作为兜底。", "AI 总结和风险在详情弹窗里查看，避免撑乱表格。"],
      },
    ],
    relatedFlows: [sharedFlows[3]],
    fieldTips: [{ title: "Excel", items: ["导出会按当前筛选条件导出。", "导入时系统计算字段以系统结果为准，不信任模板里的计算值。"] }],
  },
  "/products": {
    title: "产品库使用说明",
    summary: "产品库维护 SKU、产品名称、规格、默认采购单价、包装成本、币种和默认供应商，是订单利润核算的基础资料。",
    quickStart: ["先维护供应商。", "新增或导入产品，确保 SKU 唯一。", "新建订单时选择产品，会带出 SKU、名称、规格和默认成本。", "需要批量维护时使用下载模板、导入预览、确认导入。"],
    sections: [
      { title: "导入规则", items: ["SKU 重复时按 upsert 更新。", "默认供应商必须已存在，否则导入会提示供应商不存在。", "导出会导出当前筛选条件下的产品。"] },
      { title: "成本关系", items: ["默认采购单价和默认包装成本会作为订单商品成本的参考值。", "订单里仍可按实际情况调整采购单价和包装单价。"] },
    ],
    relatedFlows: [sharedFlows[0], sharedFlows[2]],
  },
  "/orders": {
    title: "订单中心使用说明",
    summary: "订单中心用于录入外贸订单商品明细、状态、附件、汇率、成本分项，并实时核算订单毛利。",
    quickStart: ["点击新增订单，填写客户、业务员、币种、汇率和订单基础信息。", "在商品明细表选择产品，录入数量、销售单价、采购单价和包装单价。", "保存订单后可继续维护成本分项、状态记录和附件。", "订单附件建议上传提单、装箱单、报关单、聊天记录等关键资料。"],
    sections: [
      { title: "利润核算", items: ["销售小计、采购小计、包装小计会实时计算。", "成本为空按 0 处理。", "订单毛利 = 销售额 - 商品采购成本 - 包装成本 - 其他成本。"] },
      { title: "权限", items: ["业务员只能新增和维护自己的订单。", "财务可查看利润和维护成本，但不能随意改订单基础信息。", "管理员拥有全部订单权限。"] },
    ],
    relatedFlows: [sharedFlows[1], sharedFlows[2]],
  },
  "/reports/profit": {
    title: "利润报表使用说明",
    summary: "利润报表按订单、客户、产品、成本构成和周期维度汇总毛利表现，适合财务和管理者复盘。",
    quickStart: ["选择统计维度和时间范围。", "查看总销售额、总成本、总毛利和平均毛利率。", "切换客户排行、产品排行、订单明细、成本构成等 Tab。", "需要留档时导出 Excel。"],
    sections: [{ title: "权限", items: ["管理员和财务可查看整体利润报表。", "业务员不可查看公司整体利润报表。"] }],
    relatedFlows: [sharedFlows[2]],
  },
  "/crm/customers": {
    title: "客户 CRM 使用说明",
    summary: "客户 CRM 管理客户档案、来源渠道、负责人、联系人、跟进记录和历史成交分析。",
    quickStart: ["新增客户并补充国家、类型、等级、来源渠道和负责人。", "进入客户详情维护联系人和跟进记录。", "查看历史订单、历史成交产品、总销售额、总毛利和平均毛利率。", "销售人员重点维护自己负责客户。"],
    sections: [{ title: "和订单的关系", items: ["订单选择客户后，会沉淀到客户历史交易记录。", "客户成交价格和成交产品来自订单商品明细。"] }],
    relatedFlows: [sharedFlows[0], sharedFlows[1]],
  },
  "/inquiries": {
    title: "询盘报价使用说明",
    summary: "询盘报价用于承接客户需求和报价单，已成交报价可转为订单，避免重复录入。",
    quickStart: ["维护询盘或报价信息。", "确认成交后点击转订单。", "已转订单的报价不能重复转。", "转成订单后继续在订单中心维护商品、成本、附件和状态。"],
    sections: [{ title: "注意事项", items: ["报价转订单是销售流程入口之一。", "最终利润仍以订单中心的商品和成本数据为准。"] }],
    relatedFlows: [sharedFlows[1]],
  },
  "/settings/basic": {
    title: "基础资料使用说明",
    summary: "基础资料维护品牌、平台、店铺、渠道、国家、币种、汇率等系统运行基础数据。",
    quickStart: ["先维护品牌、平台和店铺。", "再维护渠道，并关联品牌、平台、店铺。", "维护国家/地区、币种和汇率。", "渠道数据、订单、客户来源都会使用这些基础资料。"],
    sections: [
      { title: "渠道配置", items: ["渠道是经营看板和渠道效率表的基础。", "业务线和渠道类型会影响四板块归类。"] },
      { title: "汇率", items: ["汇率可手动维护，也可以使用一键更新。", "订单保存后的手动汇率不会被系统自动覆盖。"] },
    ],
    relatedFlows: [sharedFlows[0], sharedFlows[3]],
  },
  "/settings/system": {
    title: "账号管理使用说明",
    summary: "账号管理用于维护系统用户、角色和启停状态。管理员不能停用自己。",
    quickStart: ["管理员可新增、编辑、删除或停用账号。", "为用户选择管理员、业务员、财务或只读用户。", "业务员账号用于录入和查看自己的订单。", "财务账号用于查看利润和维护成本。"],
    sections: [{ title: "角色边界", items: ["管理员：全权限。", "业务员：看和录自己的订单，不看整体利润和全局经营数据。", "财务：看利润和成本，默认不能改订单基础信息。", "只读用户：只读。"] }],
    relatedFlows: ["权限同时由前端按钮隐藏和后端 API 校验，不只靠页面隐藏。"],
  },
  "/finance": {
    title: "财务中心使用说明",
    summary: "财务中心当前为预留模块，后续承接收款、付款、费用和财务复核能力。",
    quickStart: ["当前可先通过订单中心维护成本。", "通过利润报表查看利润和成本构成。", "后续财务中心会集中处理应收、应付和费用。"],
    sections: [{ title: "当前替代路径", items: ["成本维护：订单中心。", "利润查看：利润报表。", "经营汇总：经营看板。"] }],
    relatedFlows: [sharedFlows[2]],
  },
  "/influencers": {
    title: "红人合作使用说明",
    summary: "红人合作当前为预留模块，后续用于达人合作、内容投放、转化和成本归集。",
    quickStart: ["当前红人相关渠道可先在基础资料的渠道中维护。", "投放数据可先进入渠道数据。", "相关订单和成本仍在订单中心核算。"],
    sections: [{ title: "当前替代路径", items: ["渠道表现：渠道数据。", "成本利润：订单中心和利润报表。"] }],
    relatedFlows: [sharedFlows[3]],
  },
};

export const defaultHelpContent: HelpContent = {
  title: "系统使用说明",
  summary: "本系统围绕基础资料、产品、客户、订单、渠道数据、经营看板和利润报表形成闭环。",
  quickStart: ["先完成基础资料和产品库。", "录入客户、询盘或订单。", "维护订单成本、状态和附件。", "录入渠道 W1-W5 数据。", "通过经营看板和利润报表复盘业务。"],
  sections: [{ title: "核心流程", items: sharedFlows }],
  relatedFlows: sharedFlows,
};

export function getHelpContent(pathname: string) {
  return helpByRoute[getSelectedRoute(pathname)] ?? defaultHelpContent;
}
