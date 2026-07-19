# 用户规则

用户规则是用户给自己的限制。规则可以处于 `TEST` 测试状态，也可以处于 `SIGNED` 正式签署状态。

它回答：

> 哪条底线仍然有效？它在哪一天、什么场景、因为什么被打破？

用户规则不是系统解析规则。系统解析规则指标题协议、统计规则和 `ruleVersion`；用户规则指用户主动创建的自我约束。

## 产品定位

用户规则属于承诺账本，但不同于线程。

- 线程追踪：承诺推进某个主题，事实时间抵扣 expectedMinutes
- 用户规则：限制自己不越过某条线，连续守约天数证明约束仍然有效

`TEST` 规则用于验证一项可能失败的自我限制是否可以承担；`SIGNED` 规则表示用户已经正式接受这项限制。两者是同一种规则对象，不拆成两个模块，也不使用两套 run 模型。

规则不是目标，不是习惯养成，不是提醒，也不是 checklist。无论处于 `TEST` 还是 `SIGNED`，一旦违约，当前 run 都会结束。解释可以被记录，但解释不改变判定。

`TEST` 规则可以被正式签署。签署不创建新规则，也不重置或重新起算 run：`SIGNED` 直接复用签署当下的 `currentRunStartDate` 与 `currentRunDays`，连续守约天数跨越签署点继续增长。历史 best 和违约历史同样保留；签署只改变规则的承诺状态以及此后产生的违约类型。

## 规则字段

一条规则至少包含：

- `title`：规则名
- `content`：规则内容与违约判定
- `startDate`：规则开始日期，按用户本地日历日
- `commitment`：`test` 或 `signed`
- `signedAt`：从 `TEST` 正式签署为 `SIGNED` 的时间；直接创建为正式规则时等于创建时间
- `status`：`active` 或 `archived`
- `archivedAt`
- `archiveReason`

规则内容必须能形成可判定约束。系统不鼓励创建暧昧规则，例如“尽量专注”或“少浪费时间”。

v1 不提供规则编辑。若约束内容需要改变，应停用旧规则并创建新规则，避免通过事后改写规则维持 run。

已停用规则可以删除。删除已停用规则会连同违约历史一起删除，用于支持用户探索功能、清理误建规则或样例数据。active 规则不能直接删除，必须先停用。

## 违约记录

违约记录至少包含：

- `ruleId`
- `type`：`test_break` 或 `rule_break`
- `brokenDate`
- `scene`
- `reason`
- `createdAt`

违约类型由违约发生时的规则承诺状态决定：`TEST` 下产生 `test_break`，`SIGNED` 下产生 `rule_break`。类型写入后不可因规则后来被签署而回溯改变。

`scene` 记录违约现场，`reason` 记录用户解释。两者只进入违约档案，不提供补救或改判。两种违约都会清空当前 run，并参与规则自身的 current run、best run 和 break 数量计算。

Overview 的“履约数”指标显示为“日期范围内无 `rule_break` 的正式规则数 / 正式规则总数”。正式规则指 `commitment` 为 `signed` 的规则；同一规则在范围内无论产生多少条 `rule_break`，都只从履约数中排除一次。`test_break` 保留在规则账本及规则自身统计中，不影响全局履约数。范围归属按 `brokenDate` 判断，不按记录的 `createdAt` 判断。

v1 不自动判断违约。违约由用户主动记录。

## 正式签署

正式签署是同一规则上的状态变化，不是新一轮 run 的开始。签署时不得写入违约、修改 `startDate` 或生成新的 `currentRunStartDate`。若规则在签署前已连续守住 12 天，签署当天仍显示同一条 12 天 run，之后继续在其上累计。

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

规则账本不为 `TEST` 和 `SIGNED` 增加独立区域或筛选。当前过滤范围内，`TEST` 规则排在 `SIGNED` 规则之前；同一承诺状态内沿用既有排序。规则签署后在同一列表中移动到 `SIGNED` 规则之后。

规则列表使用薄账本行，不使用线程 Group 那种厚块。

每条规则行展示：

- 规则名
- `TEST` 或 `SIGNED` 承诺状态
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
- `TEST` 规则的 `Sign Rule` 操作
- `Stop Rule` 表单
- 已停用规则的 `Delete Rule` 操作

违约历史只在单条规则展开后显示，不作为全局列表铺开。
