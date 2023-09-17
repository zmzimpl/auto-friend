import { STRATEGY_OPERATORS, STRATEGY_TYPES } from "../constants";

const sellStrategy = {
  operator: STRATEGY_OPERATORS.OR,
  conditions: [
    { type: STRATEGY_TYPES.BENEFIT, value: 10 },
    { type: STRATEGY_TYPES.HOLDING_DURATION, value: 24 },
    {
      operator: STRATEGY_OPERATORS.AND,
      conditions: [
        { type: STRATEGY_TYPES.BENEFIT, value: 100 },
        { type: STRATEGY_TYPES.SPECIFY_LIST, list: [""] },
      ],
    },
    {
      operator: STRATEGY_OPERATORS.AND,
      conditions: [
        { type: STRATEGY_TYPES.BENEFIT, value: 200 },
        { type: STRATEGY_TYPES.SPECIFY_LIST, list: [""] },
      ],
    },
  ],
};

/** 不自动出售的名单 */
const notSellList = [];

export const couldBeSold = (walletAddress, subject) => {
    const isIn = notSellList.some(address => address.toLowerCase() === subject.toLowerCase());
    if (walletAddress.toLowerCase() === subject.toLowerCase() || isIn) {
        return false;
    } else {
        return true;
    }
};
