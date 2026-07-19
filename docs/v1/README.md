# Afloat v1 Specification

Afloat 是一个承诺观察系统。

它不安排你的时间，只呈现承诺如何成为事实，或如何偏离事实。

用户在日历中写下时间承诺，在偏移日历中记录承诺如何被改写。Afloat 读取这些记录，生成事实层，并通过统一镜像页呈现时间最终流向。本人访问看到完整镜像，匿名访问复用同一界面但隐藏 Threads 和 Rules。

## 文档结构

- [01-product-definition.md](./01-product-definition.md)：产品定义与边界
- [02-core-model.md](./02-core-model.md)：核心模型
- [03-calendar-protocol.md](./03-calendar-protocol.md)：日历协议
- [04-fact-layer-and-statistics.md](./04-fact-layer-and-statistics.md)：事实层与统计规则
- [05-thread-commitments.md](./05-thread-commitments.md)：线程追踪与可行性
- [06-sync-and-derived-views.md](./06-sync-and-derived-views.md)：同步与派生视图
- [07-private-and-public-pages.md](./07-private-and-public-pages.md)：镜像页与可见性
- [08-mvp-scope.md](./08-mvp-scope.md)：v1 范围
- [09-progressive-adoption.md](./09-progressive-adoption.md)：渐进式使用
- [10-technical-architecture.md](./10-technical-architecture.md)：技术架构路线
- [11-design-system.md](./11-design-system.md)：设计系统与 UI 边界
- [12-personal-rules.md](./12-personal-rules.md)：用户刚性规则

## 核心术语

- **线程追踪**：用户希望某个主题、分类或事项持续可见。线程可以是承诺，也可以是 `To Do`、`Relax List`、`Explore List` 这类开放分类。
- **时间承诺**：用户把某段未来时间承诺给某类活动。计划层是时间承诺。
- **计划层**：理想、娱乐、休息三种计划时间，继承同一套计划事件结构。
- **偏移层**：外部偏移、内部偏移两种偏移记录。
- **事实层**：计划层被偏移层覆盖后得到的实际时间流向。
- **派生视图**：由事实源全量计算出的结构化展示数据。
- **未计划缺口**：考虑已兑现时间和未来计划后，仍没有被安排的承诺缺口。
- **用户规则**：用户给自己的限制，分为测试中的 `TEST` 与正式签署的 `SIGNED`。两种违约都会结束当前 run；只有正式 `rule_break` 会影响 Overview 范围履约指标。

## v1 总原则

Afloat 不评价用户，不提醒用户，不替用户排程，不修改日历。它只要求用户把承诺与偏移写入日历，然后忠实呈现承诺、偏移和事实之间的关系。

Afloat 不假设自愿就等于无压迫。用户自己构造的计划、规则和公开镜像也可能形成内在凝视，因此系统只描述结构，不把事实镜像升级为身份审判。
