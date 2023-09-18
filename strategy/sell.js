import { STRATEGY_OPERATORS, STRATEGY_TYPES } from "../constants";

/**
 * 卖出策略
 * 利润单位为 USD
 */
const sellStrategy = {
  operator: STRATEGY_OPERATORS.OR,
  conditions: [
    // 利润大于 10 USD 才卖出
    { type: STRATEGY_TYPES.BENEFIT, value: 10 },
    // 持有时间超过多少小时后不管盈亏直接卖出
    { type: STRATEGY_TYPES.HOLDING_DURATION, value: 240 },
  ],
  specifies: [
    {
      addresses: ["0x634b5B0D940f6A4C48d5E6180a47EBb543a23F46"],
      strategy: {
        operator: STRATEGY_OPERATORS.AND,
        // 指定某些地址利润大于 100USD 并且持有时长超过 24 小时才卖出
        conditions: [
          { type: STRATEGY_TYPES.BENEFIT, value: 100 },
          { type: STRATEGY_TYPES.HOLDING_DURATION, value: 24 },
        ],
      },
    },
  ],
};

/** 不自动出售的名单 */
const notSellList = [];

/** 传递钱包地址过来，默认不卖出自己的 */
export const couldBeSold = (walletAddress, subject) => {
  const isIn = notSellList.some(
    (address) => address.toLowerCase() === subject.toLowerCase()
  );
  if (walletAddress.toLowerCase() === subject.toLowerCase() || isIn) {
    return false;
  } else {
    return true;
  }
};

const evaluateStrategy = (strategy, profit, holdingDuration) => {
  if (strategy.type) {
    switch (strategy.type) {
      case STRATEGY_TYPES.BENEFIT:
        return profit > strategy.value;
      case STRATEGY_TYPES.HOLDING_DURATION:
        return holdingDuration > strategy.value;
      // ... 其他策略类型判断
      default:
        return false;
    }
  }

  if (strategy.operator === STRATEGY_OPERATORS.OR) {
    for (let condition of strategy.conditions) {
      if (evaluateStrategy(condition, profit, holdingDuration)) {
        return true;
      }
    }
  } else if (strategy.operator === STRATEGY_OPERATORS.AND) {
    for (let condition of strategy.conditions) {
      if (!evaluateStrategy(condition, profit, holdingDuration)) {
        return false;
      }
    }
    return true;
  }

  return false;
};

export const shouldSell = (subject, profit, holdingDuration) => {
  // 检查是否地址在 specifies 中
  for (let specify of sellStrategy.specifies) {
    if (
      specify.addresses.some(
        (address) => address.toLowerCase() === subject.toLowerCase()
      )
    ) {
      return evaluateStrategy(specify.strategy, profit, holdingDuration);
    }
  }

  // 如果地址不在 specifies 中, 使用默认策略
  return evaluateStrategy(sellStrategy, profit, holdingDuration);
};
