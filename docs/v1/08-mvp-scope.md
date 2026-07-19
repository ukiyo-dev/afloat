# v1 范围

本文档定义 Afloat v1 的实现边界。

## v1 做什么

v1 做一个单用户个人承诺观察系统。

核心能力：

- 多日历语义映射
- 近期同步
- 重新校准
- 原始日历事件缓存
- 计划层解析
- 偏移层解析
- 同层重叠错误检测
- 偏移覆盖计划生成事实层
- 承诺兑现率
- 维护率
- 本人模式派生视图
- 访客模式派生视图
- 每日笔记
- 线程主动创建
- 线程自动发现
- 空线程删除
- 线程历史显示
- Group 聚合 Item 级 expectedMinutes 与 deadline
- `expectedMinutes + deadline` 可行性分析
- `TEST` 与 `SIGNED` 用户规则
- 规则违约记录
- 规则连续守约 run 计算
- `TEST` 规则正式签署并延续 run
- Overview 履约数统计（范围内无正式违约的正式规则数 / 正式规则总数）
- Overview 已规划线程统计（非红色活跃 Item 数 / 活跃 Item 总数）；红色状态为 `expired`、`stale` 或 `imbalanced`

## v1 不做什么

v1 不做：

- 多用户 SaaS
- 用户间关系
- 评论、点赞、关注
- 通知、提醒、邮件
- 自动排程
- CalDAV 写入
- checklist
- 任务完成按钮
- 评分、排名、柔性打卡 streak
- 规则补签、豁免或事后补救
- 自动判定规则违约
- AI 建议或自动解释
- 模糊标题匹配
- 自动纠错协议错误
- 多 provider 实时同步
- OAuth-based calendar provider
- Google Calendar API

## 推荐技术切分

v1 可以先按单用户本地或自托管产品实现。

最小数据模块：

- settings
- calendar_sources
- calendar_events_raw
- thread_declarations
- notes
- personal_rules
- personal_rule_breaks
- computed_views

不需要长期保存：

- parsed_blocks
- fact_blocks
- thread_views

这些都可以在派生视图生成时临时计算。

## 最小用户流程

1. 用户准备至少一个计划层语义日历。
2. 用户在 Afloat 中映射已有语义日历。
3. 首次执行重新校准。
4. Afloat 生成本人模式派生视图。
5. 用户继续在日历中记录已启用语义。
6. 用户可逐步添加更多计划层或偏移层日历。
7. 日常执行近期同步。
8. 每次同步后全量重算派生视图。
9. 用户查看镜像页本人模式。
10. 用户可在 Afloat 中写每日笔记，并选择私密或公开。
11. 用户可创建 `TEST` 或 `SIGNED` 规则，在违约时记录场景与原因，并将 `TEST` 规则正式签署。
12. 用户可选择开启镜像页访客模式。

## MVP 验收

v1 MVP 至少要能验证：

- 用户可以只绑定一个计划层日历并开始使用。
- 用户可以逐步添加更多语义日历。
- 局部镜像不会把未绑定语义显示为 0。
- 用户可以通过日历写下计划层和偏移层。
- 同层重叠会被识别，错误区间跳过统计。
- 偏移可以覆盖计划并生成事实层。
- 无来源偏移可以进入统计。
- 本人模式能展示承诺兑现与偏移。
- 镜像页主视图默认展示今天的 1 日窗口。
- 镜像页主视图可以通过上一天和下一天快捷操作按 1 个本地日步进切换。
- 镜像页主视图可以按自定义开始日与结束日统计，且范围包含两端日期。若结束日早于开始日，则按结束日单日统计。
- 镜像页主视图提供最近 7d、14d 和 30d 的范围统计快捷入口。
- 线程能从带序号事件自动发现。
- 主动线程能在没有事实推进时显示为未启动。
- 用户可以在已有 Group 下独立添加 Item。
- Group 的 deadline 取所有 Item 中最晚的 deadline，预计时间取所有 Item 之和。
- `expectedMinutes` 只被事实兑现抵扣。
- 未来计划生成未来承诺与未计划缺口。
- 用户可以创建 `TEST` 或 `SIGNED` 规则，记录违约，并看到当前 run、历史 best run 和 break 数量。
- 规则违约当天当前 run 清零，次日本地日期重新开始。
- `TEST` 签署为 `SIGNED` 时直接复用签署当下的 current run 起点与天数，不重新起算；历史 best 和违约历史继续沿用，既有 `test_break` 不改写为 `rule_break`。
- Rules 列表不增加承诺状态筛选或分区，在当前过滤范围内先显示 `TEST`，再显示 `SIGNED`。
- Overview 的日期范围履约指标按 `brokenDate` 判断正式规则是否存在落入范围的 `rule_break`，不统计 `test_break`。
- 停用规则保留历史，但不能继续记录违约。
- 访客模式复用同一镜像界面，但不展示 Threads 和 Rules 模块。
