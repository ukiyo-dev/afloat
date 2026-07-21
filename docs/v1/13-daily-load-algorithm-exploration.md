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

### 多 Item Deadline 分层

1. 所有超额 Items 组成供给池。
2. 欠缺 Items 按 Deadline 从早到晚形成结算层。
3. 同一层内，接收方按剩余欠缺分钟比例分配。
4. 供给方按剩余超额和当日可释放的理想分钟共同承担。
5. 分配结果必须保持 Start/Deadline 边界和确定性。

### 当前实现：连续逐日前缀

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

多个 Items 时不建立固定 A/B 配对，只在每日供给池和欠缺池中按余额比例分配。

### 供应不足与净超额

若某 Deadline 层欠缺 30，但可交换超额只有 10：

```text
10：通过 Item 构成交换解决
20：均匀增加到 Now ... Deadline
```

系统接受该 Deadline 层的局部负载上升，不再为了恢复全局最平曲线而远距离重排。

所有欠缺层结算后仍未匹配的净超额，从对应 Item 的 Today 开始连续移除：

```text
Today 先降到 0
余额继续消耗 Tomorrow
然后进入后续连续日期
```

因此所有 Items 都超额时，Daily Load 总量也可能连续数日降低或为 0，随后阶梯式恢复。

## Today 与 Future 的共同限制

方案 A / B 都不能自动保证 `Today = Future`。

方案 A 中，Today 使用欠额修正，而 Future 独立重算，所以二者可能不同。

方案 B 的连续前缀语义会主动形成：

```text
Today 0 -> Tomorrow 0 -> Day 3 恢复 30
```

这正是“近期活动已经提前完成”的表达。若要求 Today 与 Future 在简单窗口中保持同值，就必须把余额在整个剩余窗口中摊销：

```text
超额 60，剩余 8 天
=> 每天统一减少 7.5
```

全窗口摊销可以提高滚动稳定性，但不再表达活动从未来连续搬到过去，也不会产生完整休息日。这是独立的产品取舍，不是累计参照可以解决的问题。

## 对比

| 维度 | 方案 A | 方案 B |
| --- | --- | --- |
| 理想矩阵用途 | Today 进度参照 | 过去参照与完整 Future 基础 |
| Future 构成修正 | 否 | 是 |
| 跨日期超额/欠缺 | 间接影响 Today | 显式修改 Future 切片 |
| 多 Item 池化 | 非必要 | 按 Deadline 分层 |
| 供应不足 | 交给 Future 重算 | 局部抬高 Deadline 层 |
| 净超额 | Today 暂时退出 | 从 Today 起连续移除 |
| Future 构成滚动稳定性 | 较弱 | 较强，但会形成阶梯 |
| 实现复杂度 | 较低 | 较高 |
| Today < Future | 可能 | 可能且在连续前缀中是预期行为 |

## 待决策问题

1. 余额应采用连续前缀消费，还是全窗口平滑摊销？
2. 是否接受所有 Items 都超额时出现连续低负载或零负载日？
3. 供应不足时，Deadline 层局部抬高是否优先于重新全局削峰填谷？
4. 当前声明追溯性重建理想历史是否符合产品语义？
5. 已完成但未过 Deadline 的 active Item 是否继续作为超额供给方？
6. Future 构成稳定与近期休息语义，哪一个是更高优先级？

当前工作区实现的是方案 B 的连续逐日前缀变体。
