# Daily Load 算法探索：方案 A / B

> 状态：探索文档，不构成 v1 最终协议。正式语义仍以 `05-thread-commitments.md` 为准。

## 问题背景

单纯根据当前事实缺口做削峰填谷，可以得到宏观平滑的每日总负载，但无法充分指导用户切换 Item。若用户每天只推进当天排名第一的 Item，该 Item 可能长期保持较大的剩余缺口并继续排名第一，其他 Items 始终没有事实推进。

线性累计进度也不是可靠参照。全局削峰填谷可能为了避开未来峰值而主动前置某个 Item；若 Today 再用 `Target × 已过天数 / 总天数` 判断进度，用户遵守削峰填谷后反而会被判定为超前。

方案 A / B 因此共享同一个基础：先生成无事实理想削峰填谷矩阵，以该矩阵定义每个 Item 的理想 Daily Load。

## 共同基础：无事实理想矩阵

对当前有效、具有 Target 与 Deadline 的 Items，取最早 Start 到最晚 Deadline 的完整日期范围。忽略所有事实推进，使用完整 Target 生成矩阵：

```text
P[i,d] = Item i 在日期 d 的理想分钟数
```

硬约束：

```text
Σd P[i,d] = expectedMinutes[i]
窗口外 P[i,d] = 0
P[i,d] >= 0
```

分配顺序：

1. Steady Daily 在完整窗口中形成稳定底座。
2. Flexible Items 按有效窗口天数、Deadline、Start 排序。
3. 相同 Start/Deadline 的 Items 组成 Cohort。
4. Cohort 通过 water-fill 填入当前低水位日期。
5. Cohort 内按 Target 占比分解，Thread Key 只用于稳定排序。

理想累计进度：

```text
idealCumulative[i,t] = Σ P[i,d]，其中 d <= t
```

当前声明会追溯性地重新解释完整窗口；修改 Target、Start、Deadline 或 Steady Daily 会重建理想矩阵。

## 方案 A：理想累计进度修正 Today

### 定义

方案 A 只把理想矩阵作为 Today 的进度参照。Future 仍然根据当前 `factGapMinutes` 独立重新削峰填谷。

日初欠额：

```text
fulfilledBeforeToday[i]
  = fulfilledMinutes[i] - todayFactMinutes[i]

todayDebt[i]
  = max(0, idealCumulative[i,today] - fulfilledBeforeToday[i])
```

算法步骤：

1. 根据当前事实缺口和剩余窗口生成结构性 Future Load。
2. 取该投影的 Today 总预算。
3. 使用 `todayDebt` 决定 Today 的 Item 构成。
4. 超前 Item 的 `todayDebt` 为 0，可以退出 Today。
5. Future 不继承 Today 的构成修正，而是继续按剩余缺口独立分配。
6. 当天事实只从日初 Today 中扣减，不在同一天重新补满。

### 效果

方案 A 能解决削峰填谷与线性进度互相冲突的问题，也能在用户集中推进 A 后让 B 获得 Today 优先级。

但 Today 修正只作用于第一列：

```text
Today: A 0 / B 60
Future: A 27 / B 33
```

严格完成 Today 后，Future 总量通常可以保持滚动稳定，但 Item 构成会随新的事实缺口重新分解。所有 Items 都超前时，也可能出现今天看到 `Future 60`、明天实际重新结算出 `Today 0`。

## 方案 B：过去事实条件化完整矩阵

### 定义

方案 B 将理想矩阵同时作为过去参照和 Future 基础。以 Now 为界，过去事实相对于理想过去分配形成超额或欠缺；这些差异直接修改理想矩阵的 Today/Future 切片。

对每个 Item：

```text
openingGap[i]
  = factGapMinutes[i] + todayFactMinutes[i]

idealFuture[i]
  = Σ P[i,d]，其中 d >= today

deviation[i]
  = openingGap[i] - idealFuture[i]
```

解释：

```text
deviation > 0：过去欠缺，Future 需要增加
deviation < 0：过去超额，Future 需要减少
```

该差值等价于“理想过去累计分配减去截至昨日累计事实”，但使用 Future 行总量计算可以直接保持 Item 分钟守恒。

### 多 Item 同日池化

1. 所有超额 Items 组成供给池。
2. 日期作为外层，从 Today 开始逐日结算。
3. 当天仍有欠额且 `P[i,d] > 0` 的 Items 组成接收池。
4. 接收方按实时剩余欠额 `remainingDeficit[i] / ΣremainingDeficit` 分配。
5. 每次交换后立即扣减剩余欠额；接收池资格不变时，各 Item 欠额同比缩小。
6. 供给方按剩余超额和当日可释放的当前正分配共同承担。
7. 分配结果必须保持 Start/Deadline 边界和确定性。

### 当前实现：逐日交换与比例结算

可配对交换从 Today 开始逐日发生：

```text
Today -> Tomorrow -> 后续连续日期
```

当天能交换多少就交换多少，余额未清才进入下一天。它表达“未来的 A 已在过去完成，过去未完成的 B 被推到未来”。

示例：

```text
理想：A 30/天，B 30/天
过去：A +30，B -30

Today：A 0，B 60
Tomorrow：A 30，B 30
```

多个 Items 时不建立固定 A/B 配对，也不让较早 Deadline 层跨多天独占供给池。每天只在当日供给池和接收池中交换，接收比例由各 Item 的实时剩余欠额决定。`P[i,d]` 只决定当天接收资格，Deadline 通过该有效边界参与计算，不再额外决定当天优先级。

### 供应不足与净超额

结算可以概括为：先在各 Item 的有效边界内尽量交换；无法继续配对的部分成为纯欠额或纯超额，只调整其最小 Deadline 窗口，不触发全局重新削峰填谷。

若某 Item 欠缺 30，但全部日期完成交换后只有 10 被覆盖：

```text
10：通过 Item 构成交换解决
20：均匀增加到 Now ... Deadline
```

剩余 20 成为纯欠额，系统接受该 Item 最小 Deadline 窗口的局部负载上升，不再为了恢复全局最平曲线而远距离重排。

全部逐日交换完成后仍未匹配的净超额，从对应 Item 的剩余窗口中按原分布比例移除。这里的原分布是进入净额结算时仍为正数的分配，不是交换前的理想矩阵：

```text
保留比例 = 1 - 未匹配净超额 / 当前正分配总量
每个正分配日乘以相同保留比例
已在交换阶段释放的分钟不重复计算
Item 原有剩余曲线形状保持不变
```

因此所有 Items 都超额时，Daily Load 会在各自剩余窗口中按原分布降低，不会仅因净超额结算形成从 Today 开始的零负载前缀。

## Today 与 Future 的共同限制

方案 A / B 都不能自动保证 `Today = Future`。

方案 A 中，Today 使用欠额修正，而 Future 独立重算，所以二者可能不同。

若净超额也采用连续前缀消费，会主动形成：

```text
Today 0 -> Tomorrow 0 -> Day 3 恢复 30
```

这表达“近期活动已经提前完成”，但会形成负载阶梯。当前实现改为在对应 Item 的整个剩余窗口中按原分布比例摊销：

```text
超额 60，剩余 8 天
=> 每天统一减少 7.5
```

按原分布比例摊销可以提高滚动稳定性，但不再表达活动从未来连续搬到过去，也不会仅因未配对净超额产生完整休息日。完整休息日仍可能来自原始窗口结构或当天事实扣减。

## 对比

| 维度 | 方案 A | 方案 B |
| --- | --- | --- |
| 理想矩阵用途 | Today 进度参照 | 过去参照与完整 Future 基础 |
| Future 构成修正 | 否 | 是 |
| 跨日期超额/欠缺 | 间接影响 Today | 显式修改 Future 切片 |
| 多 Item 池化 | 非必要 | 逐日按实时剩余欠额比例分配 |
| 供应不足 | 交给 Future 重算 | 局部抬高 Deadline 层 |
| 净超额 | Today 暂时退出 | 在 Item 剩余窗口中按原分布比例移除 |
| Future 构成滚动稳定性 | 较弱 | 较强，净超额不额外制造阶梯 |
| 实现复杂度 | 较低 | 较高 |
| Today < Future | 可能 | 仅由日内事实或不同日期的 Start/Deadline 窗口结构产生 |

## 仍待决策问题

1. 供应不足时，最小 Deadline 窗口局部抬高是否优先于重新全局削峰填谷？
2. 当前声明追溯性重建理想历史是否符合产品语义？
3. 已完成但未过 Deadline 的 active Item 是否继续作为超额供给方？

## 超额 / 欠额的剩余窗口策略

超额与欠额在逐日交换后仍可能存在未匹配余额。此处有两种都合理的策略，属于个人偏好与产品体验选择，不应视为理想矩阵或事实层的硬语义。

### 策略一：Deadline Pressure（最小 Deadline 窗口）

剩余欠额只增加到该 Item 从 Now 到 Deadline 的最小有效窗口；剩余超额从该 Item 当前剩余分配中按比例移除。

```text
欠额：优先抬高最紧窗口
超额：按当前正分配比例减少
```

这代表“履约优先”的产品偏好：过去落后的 Item 应尽快补齐，越接近 Deadline 越应该暴露真实压力。优点是更强调 deadline 可行性，尽快暴露无法完成的 Item 风险；缺点是超欠额处理不完全对称，可能在临近 Deadline 的日期形成局部峰值。

### 策略二：Curve Preservation（全窗口比例）

对该 Item 的全部剩余有效日期按结算前理想矩阵的比例分配压力。设理想分配为 `P[i,d]`，欠额为 `delta`：

```text
欠额 delta > 0：A'[i,d] = A[i,d] + delta × P[i,d] / ΣP[i,d]
超额 delta > 0：沿当前剩余正分配按比例移除
```

这代表“曲线稳定优先”的产品偏好。该策略保持原有曲线形状，使超额与欠额完全对称；超额可以沿 Item 的整个剩余曲线传导，而不会因为净额结算额外制造局部负载阶梯，因此通常更符合滚动使用的直觉。它仍然是相对于既定理想曲线的局部优解：只在该 Item 的剩余分配形状上做比例投影，不会重新联合优化所有 Item 和所有日期。代价是欠额不会特别优先集中到更近的 Deadline，风险暴露可能更晚。

如果当前剩余窗口的分配总量 `S` 为零，比例缩放没有基准；实现必须使用确定性的兜底规则，例如在整个有效窗口均匀分配，或退回策略一的最小窗口增加规则。

两种策略都必须保持：Start / Deadline 边界、Item 分钟守恒、确定性，以及已完成逐日交换结果不被重复计算。两者不是单纯的技术 fallback，而是不同的产品偏好；具体采用哪一种，可以由用户偏好或 Dashboard 设置决定。当前实现采用 `Deadline Pressure`。

## 当前实现语义

当前实现采用两层结构：

1. 理想矩阵层：将同一 `Start / Deadline` 窗口的 Flexible Items 聚合为 Cohort，在由 `Now`、所有 `Start` 和 `Deadline + 1` 形成的原子区间上，使用每日容量固定的 EDF 可行性判断与峰值二分，求全局 minimax 理想 Daily Load；区间内的每日负载固定，Cohort 内再按 Target 比例拆分。
2. 事实结算层：保留方案 B 的语义，从 Today 开始沿连续日期逐日池化处理超额与欠额；交换完成后，剩余纯欠额和纯超额按所选的 `Deadline Pressure` 或 `Curve Preservation` 策略结算。

区间级求解器已通过小规模连续分钟穷举对照测试：在当前“连续窗口、可拆分分钟、区间容量固定”的约束下，EDF 可行性判断与全局 minimax 峰值一致。该验证不改变第 3 步事实结算的局部语义。
