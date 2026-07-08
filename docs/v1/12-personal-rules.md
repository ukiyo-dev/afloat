# 用户规则

用户规则是用户给自己签下的刚性约束。

它回答：

> 哪条底线仍然有效？它在哪一天、什么场景、因为什么被打破？

用户规则不是系统解析规则。系统解析规则指标题协议、统计规则和 `ruleVersion`；用户规则指用户主动创建的自我约束。

## 产品定位

用户规则属于承诺账本，但不同于线程。

- 线程追踪：承诺推进某个主题，事实时间抵扣 expectedMinutes
- 用户规则：承诺不越过某条线，连续守约天数证明约束仍然有效

规则不是目标，不是习惯养成，不是提醒，也不是 checklist。

规则一旦违约，当前 run 结束。解释可以被记录，但解释不改变判定。

## 规则字段

一条规则至少包含：

- `title`：规则名
- `content`：规则内容与违约判定
- `startDate`：规则开始日期，按用户本地日历日
- `status`：`active` 或 `archived`
- `archivedAt`
- `archiveReason`

规则内容必须能形成可判定约束。系统不鼓励创建暧昧规则，例如“尽量专注”或“少浪费时间”。

v1 不提供规则编辑。若约束内容需要改变，应停用旧规则并创建新规则，避免通过事后改写规则维持 run。

已停用规则可以删除。删除已停用规则会连同违约历史一起删除，用于支持用户探索功能、清理误建规则或样例数据。active 规则不能直接删除，必须先停用。

## 违约记录

违约记录至少包含：

- `ruleId`
- `brokenDate`
- `scene`
- `reason`
- `createdAt`

`scene` 记录违约现场，`reason` 记录用户解释。两者只进入违约档案，不提供补救或改判。

v1 不自动判断违约。违约由用户主动记录。

## 连续守约计算

系统不每天写入打卡记录。连续天数由规则开始日、违约记录和当前本地日期计算。当前 `RUN` 不计入今天，只统计今天以前已经完整守住的日历日。

没有违约时：

```text
currentRunDays = today - startDate
```

有违约时：

```text
currentRunStartDate = lastBreak.brokenDate + 1 day
```

如果最近一次违约日期等于今天：

```text
runStatus = BROKEN TODAY
currentRunDays = 0
currentRunStartDate = null
```

违约当天不计入新 run。新 run 从次日本地 00:00 开始。

新 run 开始当天显示 `0`，到次日才显示 `1`。

历史最佳 run 保留。规则停用后，历史仍然保留，但不能继续记录违约。

## 不做柔性补救

v1 不做：

- 补签
- 豁免日
- 轻微违约
- 部分违约
- 复活 run
- 事后补救任务
- 自动提醒
- 自动判定违约

这些机制会降低违约成本，使规则变成谈判对象。

## RULES 界面

`/dashboard` 的 `RULES` tab 只在本人模式展示。

顶部提供：

- `New Rule`
- 搜索框
- `ACTIVE / DISACTIVE / ALL` 过滤

规则列表使用薄账本行，不使用线程 Group 那种厚块。

每条规则行展示：

- 规则名
- 当前状态
- `Run`
- `Best`
- `Breaks`
- `Content` 摘要

展开单条规则后展示：

- `Content`
- `Start`
- `Current Start`
- `Last Break`
- `Archived`
- `BROKEN HISTORY`
- `Record Break` 表单
- `Stop Rule` 表单
- 已停用规则的 `Delete Rule` 操作

违约历史只在单条规则展开后显示，不作为全局列表铺开。
