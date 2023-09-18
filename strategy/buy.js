import { STRATEGY_OPERATORS, STRATEGY_TYPES } from "../constants";
import { promises } from "fs";
import { getDir } from "../utils";
import chalk from "chalk";

/**
 * 购买策略
 * 涉及价格，金额的单位统一为 ETH
 */
const BuyStrategy = {
  operator: STRATEGY_OPERATORS.OR,
  conditions: [
    {
      operator: STRATEGY_OPERATORS.AND,
      conditions: [
        // 价格
        { type: STRATEGY_TYPES.KEY_PRICE, value: 0.002 },
        // 账户跨桥的金额
        { type: STRATEGY_TYPES.ACCOUNT_BRIDGED_AMOUNT, value: 0.1 },
        // 账户 nonce
        { type: STRATEGY_TYPES.ACCOUNT_NONCE, value: 5 },
        // 推特关注数
        { type: STRATEGY_TYPES.TWITTER_FOLLOWERS, value: 15000 },
        // 推特文章数
        { type: STRATEGY_TYPES.TWITTER_POSTS, value: 100 },
      ],
    },
    {
      operator: STRATEGY_OPERATORS.AND,
      conditions: [
        { type: STRATEGY_TYPES.KEY_PRICE, value: 0.004 },
        { type: STRATEGY_TYPES.ACCOUNT_BRIDGED_AMOUNT, value: 0.2 },
        { type: STRATEGY_TYPES.ACCOUNT_NONCE, value: 5 },
        { type: STRATEGY_TYPES.TWITTER_FOLLOWERS, value: 35000 },
        { type: STRATEGY_TYPES.TWITTER_POSTS, value: 400 },
      ],
    },
    {
      // 白名单
      type: STRATEGY_TYPES.WHITELIST,
      whitelist: [
        { username: "zmzimpl", maxPrice: 0.0005, buyAmount: 1 },
        { username: "elonmusk", maxPrice: 0.05, buyAmount: 2 },
      ],
    },
  ],
};
/** 不自动购买的地址, 可以把一些假号或者买过了知道会亏的放这里面 */
const notBuyList = [
  "0x769dd66767ab8569cedacc11c3165706171ca86b",
  "0x5E305C7d68c50788a34F480BfC33c573CcE3DBDd",
  "0xf7ebfa80d5e3854d95a87fff4f345ee3455436f2",
  "0x82bd50ef1a7444755812b526cfbd7146cf6b46c2",
  "0xf7b1cd33b199ee0831fa0c984fdae0955d47f2f6",
];

/** 不用管这个变量，但不要删除，用来定时读取 bots 名单做过滤的 */
let bots = [];

export const couldBeBought = (subject) => {
  const isInBlockList = notBuyList.concat(bots).some((address) => {
    const isBlock = address.toLowerCase() === subject.toLowerCase();
    if (isBlock) {
      console.log(chalk.yellow(`${subject} 在不购买名单内，跳过`));
    }
    return isBlock;
  });
  return !isInBlockList;
};

const readBotJSON = async () => {
  try {
    const data = await promises.readFile(getDir("bots.json"), "utf8");
    bots = JSON.parse(data);

    if (Array.isArray(bots)) {
      console.log(`已经将 ${bots.length} 个 bot 名单列入不购买名单`);
    }
  } catch (error) {
    console.error("Error reading bots.json:", error);
  }
};

// Read bots.json immediately upon starting the script
readBotJSON();

// Set an interval to read bots.json every 30 minutes (1800000 milliseconds)
setInterval(readBotJSON, 1800000);

const evaluateCondition = (condition, accountInfo, twitterInfo, keyInfo) => {
  switch (condition.type) {
    case STRATEGY_TYPES.ACCOUNT_BRIDGED_AMOUNT:
      return accountInfo.bridgedAmount >= condition.value;
    case STRATEGY_TYPES.TWITTER_FOLLOWERS:
      return twitterInfo.followers >= condition.value;
    case STRATEGY_TYPES.TWITTER_POSTS:
      return twitterInfo.posts >= condition.value;
    case STRATEGY_TYPES.ACCOUNT_NONCE:
      return accountInfo.nonce <= condition.value;
    case STRATEGY_TYPES.KEY_PRICE:
      return keyInfo.price < condition.value;
    case STRATEGY_TYPES.WHITELIST:
      const user = condition.whitelist.find(
        (u) => u.username === keyInfo.username
      );
      return user && keyInfo.price <= user.maxPrice;
    default:
      throw new Error("Unknown condition type");
  }
};

const evaluateStrategy = (strategy, accountInfo, twitterInfo, keyInfo) => {
  if (strategy.operator) {
    if (strategy.operator === STRATEGY_OPERATORS.AND) {
      return strategy.conditions.every((condition) =>
        evaluateStrategy(condition, accountInfo, twitterInfo, keyInfo)
      );
    } else if (strategy.operator === STRATEGY_OPERATORS.OR) {
      return strategy.conditions.some((condition) =>
        evaluateStrategy(condition, accountInfo, twitterInfo, keyInfo)
      );
    } else {
      throw new Error("Unknown operator");
    }
  } else {
    return evaluateCondition(strategy, accountInfo, twitterInfo, keyInfo);
  }
};

const extractPricesFromStrategy = (strategy) => {
  let prices = [];

  if (strategy.conditions) {
    for (let condition of strategy.conditions) {
      if (condition.type === STRATEGY_TYPES.KEY_PRICE) {
        prices.push(condition.value);
      } else if (condition.type === STRATEGY_TYPES.WHITELIST) {
        for (let user of condition.whitelist) {
          prices.push(user.maxPrice);
        }
      } else if (condition.operator) {
        // AND or OR conditions
        prices = prices.concat(extractPricesFromStrategy(condition));
      }
    }
  }

  return prices;
};

export const isWhitelisted = (keyInfo) => {
  const whitelistedUser = BuyStrategy.conditions.find(
    (condition) => condition.type === STRATEGY_TYPES.WHITELIST
  );
  if (!whitelistedUser) return false;

  const user = whitelistedUser.whitelist.find(
    (u) => u.username === keyInfo.username
  );

  return user;
};

export const shouldFetchPrice = (accountInfo, twitterInfo, keyInfo) => {
  return evaluateStrategy(BuyStrategy, accountInfo, twitterInfo, keyInfo);
};

export const shouldBuy = (accountInfo, twitterInfo, keyInfo) => {
  return evaluateStrategy(BuyStrategy, accountInfo, twitterInfo, keyInfo);
};

export const getMaxPrice = () => {
  const prices = extractPricesFromStrategy(BuyStrategy);
  return Math.max(...prices);
};

const containsTwitterConditions = (strategy) => {
  if (strategy.conditions) {
    for (let condition of strategy.conditions) {
      if (
        condition.type === STRATEGY_TYPES.TWITTER_FOLLOWERS ||
        condition.type === STRATEGY_TYPES.TWITTER_POSTS
      ) {
        return true;
      }
      if (condition.operator && containsTwitterConditions(condition)) {
        // 如果是 AND 或 OR 条件
        return true;
      }
    }
  }
  return false;
};

const containsBridgedAmountCondition = (strategy) => {
  if (strategy.conditions) {
    for (let condition of strategy.conditions) {
      if (condition.type === STRATEGY_TYPES.ACCOUNT_BRIDGED_AMOUNT) {
        return true;
      }
      if (condition.operator && containsTwitterConditions(condition)) {
        // 如果是 AND 或 OR 条件
        return true;
      }
    }
  }
  return false;
};

const containsNonceCondition = (strategy) => {
  if (strategy.conditions) {
    for (let condition of strategy.conditions) {
      if (condition.type === STRATEGY_TYPES.ACCOUNT_NONCE) {
        return true;
      }
      if (condition.operator && containsTwitterConditions(condition)) {
        // 如果是 AND 或 OR 条件
        return true;
      }
    }
  }
  return false;
};

const getMaxNonceFromStrategy = (strategy) => {
  if (strategy.type === STRATEGY_TYPES.ACCOUNT_NONCE) {
    return strategy.value;
  }
  if (strategy.conditions) {
    const nonces = strategy.conditions
      .map(getMaxNonceFromStrategy)
      .filter(Boolean);
    return Math.max(...nonces);
  }
  return null;
};

export const shouldFetchTwitterInfo = (accountInfo, keyInfo) => {
  const hasNonceCondition = containsNonceCondition(BuyStrategy);
  const hasBridgedAmountCondition = containsBridgedAmountCondition(BuyStrategy);

  const meetsNonceCondition = (strategy) => {
    if (!hasNonceCondition) {
      return true;
    }
    if (strategy.type === STRATEGY_TYPES.ACCOUNT_NONCE) {
      return accountInfo.nonce <= strategy.value;
    }
    if (strategy.conditions) {
      return strategy.conditions.some(meetsNonceCondition);
    }
    return false;
  };

  const meetsBridgedAmountCondition = (strategy) => {
    if (!hasBridgedAmountCondition) {
      return true;
    }
    if (strategy.type === STRATEGY_TYPES.ACCOUNT_BRIDGED_AMOUNT) {
      return accountInfo.bridgedAmount >= strategy.value;
    }
    if (strategy.conditions) {
      return strategy.conditions.some(meetsBridgedAmountCondition);
    }
    return false;
  };

  if (
    !meetsNonceCondition(BuyStrategy) ||
    !meetsBridgedAmountCondition(BuyStrategy)
  ) {
    console.log(
      chalk.gray(
        `${keyInfo.subject} either nonce or bridgedAmount conditions aren't met, no need to fetch Twitter info.`
      )
    );
    return false;
  }
  return containsTwitterConditions(BuyStrategy);
};

export const shouldFetchBridgedAmount = (accountInfo, keyInfo) => {
  if (containsNonceCondition(BuyStrategy)) {
    const meetsNonceCondition = (strategy) => {
      if (strategy.type === STRATEGY_TYPES.ACCOUNT_NONCE) {
        return accountInfo.nonce <= strategy.value;
      }
      if (strategy.conditions) {
        return strategy.conditions.some(meetsNonceCondition);
      }
      return false;
    };

    if (!meetsNonceCondition(BuyStrategy)) {
      console.log(
        chalk.gray(
          `${keyInfo.subject} nonce condition isn't met, no need to fetch bridgedAmount`
        )
      );
      return false;
    }
  }

  return containsBridgedAmountCondition(BuyStrategy);
};

export const shouldFetchNonce = () => {
  return containsNonceCondition(BuyStrategy);
};
