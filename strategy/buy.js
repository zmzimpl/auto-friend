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
        // 账户跨桥的金额，觉得不需要可以删掉或者注释掉
        { type: STRATEGY_TYPES.ACCOUNT_BRIDGED_AMOUNT, value: 0.1 },
        // 账户 nonce，觉得不需要可以删掉或者注释掉
        { type: STRATEGY_TYPES.ACCOUNT_NONCE, value: 5 },
        // 推特关注数，觉得不需要可以删掉或者注释掉
        { type: STRATEGY_TYPES.TWITTER_FOLLOWERS, value: 15000 },
        // 推特文章数，觉得不需要可以删掉或者注释掉
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
  // 如果一个 key 是由 bots 列表内的地址出售的，不考虑买入
  skipSoldByBot: false,
};
/** 不自动购买的地址, 可以把一些假号或者买过了知道会亏的放这里面 */
const notBuyList = [
  "0x769dd66767ab8569cedacc11c3165706171ca86b",
  "0x5E305C7d68c50788a34F480BfC33c573CcE3DBDd",
  "0xf7ebfa80d5e3854d95a87fff4f345ee3455436f2",
  "0x82bd50ef1a7444755812b526cfbd7146cf6b46c2",
  "0xf7b1cd33b199ee0831fa0c984fdae0955d47f2f6",
];

export const BOT_JUDGED_NONCE = 300;

/** 不用管这个变量，但不要删除，用来定时读取 bots 名单做过滤的 */
let bots = [];

export const couldBeBought = ({ subject, trader, isBuy }) => {
  const blockList = notBuyList.concat(bots);
  const isInBlockList = blockList.some((address) => {
    const isBlock = address.toLowerCase() === subject.toLowerCase();
    const isSoldByBot =
      BuyStrategy.skipSoldByBot &&
      !isBuy &&
      trader &&
      trader.toLowerCase() === address.toLowerCase();
    if (isBlock) {
      console.log(chalk.yellow(`${subject} 在不购买名单内，跳过`));
    }
    if (isSoldByBot) {
      console.log(chalk.yellow(`bot ${subject} 抛售的，跳过不买`));
    }
    return isBlock || isSoldByBot;
  });
  return !isInBlockList;
};

export const readBotJSON = async () => {
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

const getMaxNonce = (strategy) => {
  if (strategy.type === STRATEGY_TYPES.ACCOUNT_NONCE) {
    return strategy.value;
  }
  if (strategy.conditions) {
    const nonces = strategy.conditions.map(getMaxNonce).filter(Boolean);
    return Math.max(...nonces);
  }
  return -Infinity; // Default value when no nonce is found
};

const getMinBridgedAmount = (strategy) => {
  if (strategy.type === STRATEGY_TYPES.ACCOUNT_BRIDGED_AMOUNT) {
    return strategy.value;
  }
  if (strategy.conditions) {
    const bridgedAmounts = strategy.conditions
      .map(getMinBridgedAmount)
      .filter(Boolean);
    return Math.min(...bridgedAmounts);
  }
  return Infinity; // Default value when no bridgedAmount is found
};

const maxNonceValue = getMaxNonce(BuyStrategy);
const minBridgedAmountValue = getMinBridgedAmount(BuyStrategy);

export const shouldFetchTwitterInfo = (accountInfo, keyInfo) => {
  if (accountInfo.nonce > maxNonceValue) {
    console.log(
      chalk.cyan(
        `${keyInfo.subject} nonce(${accountInfo.nonce}) > maximum allowable value(${maxNonceValue}), no need to fetch Twitter info.`
      )
    );
    return false;
  }
  if (accountInfo.bridgedAmount < minBridgedAmountValue) {
    console.log(
      chalk.blue(
        `${keyInfo.subject} bridgedAmount(${accountInfo.bridgedAmount}) < minimum allowable value(${minBridgedAmountValue}), no need to fetch Twitter info.`
      )
    );
    return false;
  }
  return containsTwitterConditions(BuyStrategy);
};

export const shouldFetchBridgedAmount = (accountInfo, keyInfo) => {
  if (accountInfo.nonce > maxNonceValue) {
    console.log(
      chalk.cyan(
        `${keyInfo.subject} nonce(${accountInfo.nonce}) > maximum allowable value(${maxNonceValue}), no need to fetch bridgedAmount`
      )
    );
    return false;
  }
  return containsBridgedAmountCondition(BuyStrategy);
};

export const shouldFetchNonce = () => {
  return containsNonceCondition(BuyStrategy);
};
