# Afloat v1 Specification

Afloat 是一个承诺观察系统。

它不安排你的时间，只呈现承诺如何成为事实，或如何偏离事实。

用户在日历中写下时间承诺，在偏移日历中记录承诺如何被改写。Afloat 读取这些记录，生成事实层，并通过统一镜像页呈现时间最终流向。本人访问看到完整镜像，匿名访问复用同一界面但隐藏 Threads。

## 文档结构

- [01-product-definition.md](./01-product-definition.md)：产品定义与边界
- [02-core-model.md](./02-core-model.md)：核心模型
- [03-calendar-protocol.md](./03-calendar-protocol.md)：日历协议
- [04-fact-layer-and-statistics.md](./04-fact-layer-and-statistics.md)：事实层与统计规则
- [05-thread-commitments.md](./05-thread-commitments.md)：线程承诺与可行性
- [06-sync-and-derived-views.md](./06-sync-and-derived-views.md)：同步与派生视图
- [07-private-and-public-pages.md](./07-private-and-public-pages.md)：镜像页与可见性
- [08-mvp-scope.md](./08-mvp-scope.md)：v1 范围
- [09-progressive-adoption.md](./09-progressive-adoption.md)：渐进式使用
- [10-technical-architecture.md](./10-technical-architecture.md)：技术架构路线
- [11-design-system.md](./11-design-system.md)：设计系统与 UI 边界

## 核心术语

- **主题承诺**：用户希望某个主题持续存在于自己的时间中。线程是主题承诺。
- **时间承诺**：用户把某段未来时间承诺给某类活动。计划层是时间承诺。
- **计划层**：理想、娱乐、休息三种计划时间，继承同一套计划事件结构。
- **偏移层**：外部偏移、内部偏移两种偏移记录。
- **事实层**：计划层被偏移层覆盖后得到的实际时间流向。
- **派生视图**：由事实源全量计算出的结构化展示数据。
- **未计划缺口**：考虑已兑现时间和未来计划后，仍没有被安排的承诺缺口。

## v1 总原则

Afloat 不评价用户，不提醒用户，不替用户排程，不修改日历。它只要求用户把承诺与偏移写入日历，然后忠实呈现承诺、偏移和事实之间的关系。
