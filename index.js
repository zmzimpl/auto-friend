import { readFileSync } from "fs";
import {
  getUserInfo,
  getDir,
  logIntro,
  randint,
  sleep,
  logWork,
  logLoader,
  decrypt,
} from "./utils";
import consoleStamp from "console-stamp";
import {
  createPublicClient,
  http,
  getContract,
  createWalletClient,
  encodeFunctionData,
  webSocket,
  parseGwei,
  decodeFunctionData,
  parseAbiItem,
  formatEther,
} from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import axios from "axios";
import chalk from "chalk";
import pkg from "lodash";
import readlineSync from "readline-sync";

const { throttle } = pkg;

const wallets = JSON.parse(readFileSync(getDir("wallets.json"), "utf8"));
const abi = JSON.parse(readFileSync(getDir("abi.json"), "utf-8"));
const contractAddress = "0xcf205808ed36593aa40a44f10c7f7c2f67d4a4d4";
const publicClient = createPublicClient({
  chain: base,
  transport: http(),
});
const contract = getContract({
  address: contractAddress,
  abi: abi,
  // @ts-ignore
  publicClient: publicClient,
});
const websocketClient = createPublicClient({
  chain: base,
  transport: webSocket(
    "wss://base-mainnet.blastapi.io/fe9c30fc-3bc5-4064-91e2-6ab5887f8f4d"
  ),
});
const BASE_SCAN_API = "GWV3I6MRRIIDB1RA4UAIYAYGJ4KCGRR5ME";

const main = async (wallet) => {
  const client = createWalletClient({
    account: privateKeyToAccount(`0x${wallet.pk}`),
    chain: base,
    transport: http(),
  });

  const amount = 1;
  const gasLimit = "100000";

  let holdings = [];
  let nonce = 56;
  let ETH_USCT_Rate = 1600;
  let unwatch;
  let buying = false;
  let lastActivity;
  let intervalId;
  let selling = false;

  const buyShare = async (value, subjectAddress) => {
    if (buying) return;
    buying = true;
    const data = encodeFunctionData({
      abi: abi,
      functionName: "buyShares",
      args: [subjectAddress, amount],
    });
    const txParams = {
      value: value,
      data: data,
      to: contractAddress,
      gasPrice: parseGwei("0.3"),
      gasLimit,
      nonce: nonce++,
    };
    try {
      const hash = await client.sendTransaction(txParams);
      console.log(`Sent tx > ${hash}`);
      const transaction = await publicClient.waitForTransactionReceipt({
        confirmations: 2,
        hash,
      });

      console.log(
        chalk[transaction.status === "success" ? "green" : "red"](
          `Buy ${subjectAddress} ${transaction.status}`
        )
      );
      buying = false;
    } catch (error) {
      buying = false;
      console.log("error", error.shortMessage);
    }
  };

  const watchContractTradeEvent = async () => {
    await freshNonce();
    if (unwatch) {
      await unwatch();
    }
    unwatch = websocketClient.watchContractEvent({
      address: contractAddress,
      abi: abi,
      eventName: "Trade",
      onLogs: throttle(async (logs) => {
        console.log(
          chalk.gray(
            `Block number: ${logs[0].blockNumber}, Check to see if purchase conditions are met...`
          )
        );
        await checkIfBuy(logs);
      }, 3000),
      // 每 3 秒执行一次，因为频率太高，获取推特的关注人数方法会有问题() => checkIfBuy(logs)
    });
  };

  const getBuyPrice = async (subjectAddress) => {
    console.log(chalk.gray("get buy price...", subjectAddress));
    try {
      const price = await contract.read.getBuyPriceAfterFee({
        args: [subjectAddress, amount],
      });
      return price > 0 ? price : await getBuyPrice(subjectAddress);
    } catch (error) {
      console.log("get buy price failed", error);
      return await getBuyPrice(subjectAddress);
    }
  };

  const checkIfBuy = async (logs) => {
    if (buying) return;
    if (logs instanceof Array && logs.length > 0) {
      try {
        const filterLogs = logs.filter((log) => {
          return (
            parseFloat(formatEther(log.args.ethAmount)) <
              wallet.buyLimit2.price &&
            !wallet.blockList.some(
              (address) =>
                address.toLowerCase() === log.args.subject.toLowerCase()
            )
          );
        });
        for (let index = 0; index < filterLogs.length; index++) {
          const log = filterLogs[index];
          const ethAmount = log.args.ethAmount;
          const profile = await fetchProfile(log.args.subject);
          if (!profile.followers) continue;
          if (
            (profile.followers > wallet.buyLimit1.followers &&
              profile.posts_count > (wallet.buyLimit1.posts_count || 10) &&
              parseFloat(formatEther(ethAmount)) < wallet.buyLimit1.price) ||
            (profile.followers > wallet.buyLimit2.followers &&
              profile.posts_count > (wallet.buyLimit1.posts_count || 50) &&
              parseFloat(formatEther(ethAmount)) < wallet.buyLimit2.price)
          ) {
            const price = await getBuyPrice(profile.subject);
            console.log(
              chalk.cyan(
                "user",
                profile.username,
                " address",
                profile.subject,
                " follower",
                profile.followers,
                "price",
                formatEther(price)
              )
            );
            const ethPrice = formatEther(price);
            if (
              (profile.followers > wallet.buyLimit1.followers &&
                profile.posts_count > (wallet.buyLimit1.posts_count || 10) &&
                parseFloat(formatEther(ethAmount)) < wallet.buyLimit1.price) ||
              (profile.followers > wallet.buyLimit2.followers &&
                profile.posts_count > (wallet.buyLimit1.posts_count || 50) &&
                parseFloat(formatEther(ethAmount)) < wallet.buyLimit2.price)
            ) {
              logWork({
                walletAddress: wallet.address,
                actionName: "buy",
                shareAddress: profile.subject,
                price: ethPrice,
              });
              await buyShare(price, profile.subject);
            }
          }
        }
      } catch (error) {}
    }
  };

  const fetchProfile = async (subject, count = 0) => {
    console.log(chalk.gray("fetch user profile..."));
    try {
      const res = await axios.get(
        `https://prod-api.kosetto.com/users/${subject}`,
        {
          timeout: 3000,
        }
      );
      if (res.data?.id) {
        const username = res.data?.twitterUsername;
        if (!username) {
          console.log("no twitter username, skip");
          return {};
        }
        const userInfo = await getUserInfo(username);
        console.log(
          chalk.blue(
            `${username} followers ${userInfo?.followers_count} posts count ${userInfo.statuses_count}`
          )
        );
        return {
          subject: subject,
          username,
          followers: userInfo?.followers_count,
          posts_count: userInfo?.statuses_count,
        };
      } else {
        return {};
      }
    } catch (error) {
      if (error.message.includes("404") && count < 2) {
        await sleep(2);
        return await fetchProfile(subject, count + 1);
      }
      return {};
    }
  };

  const freshNonce = async () => {
    const transactionCount = await publicClient.getTransactionCount({
      address: wallet.address,
    });
    nonce = transactionCount;
  };

  const refreshHoldings = async () => {
    try {
      const res = await axios({
        method: "get",
        url: `https://prod-api.kosetto.com/portfolio/${wallet.address}`,
        headers: {
          Host: "prod-api.kosetto.com",
          "sec-ch-ua":
            '"Chromium";v="112", "Google Chrome";v="112", "Not:A-Brand";v="99"',
          accept: "application/json",
          "sec-ch-ua-platform": '"Android"',
          "sec-ch-ua-mobile": "?1",
          authorization: wallet.authorization,
          "user-agent":
            "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36",
          "content-type": "application/json",
          origin: "https://www.friend.tech",
          "sec-fetch-site": "cross-site",
          "sec-fetch-mode": "cors",
          "sec-fetch-dest": "empty",
          referer: "https://www.friend.tech/",
          "accept-language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7",
          "if-none-match": wallet.ifNoneMatch,
          timeout: 3000,
        },
      });
      if (res.data?.holdings?.length) {
        await mergeCosts(res.data?.holdings);
      } else {
        holdings = [];
      }
    } catch (error) {
      console.log("refreshHoldings error", error);
      await sleep(3);
      await refreshHoldings();
    }
  };

  const mergeCosts = async (arr) => {
    const transactions = await getTransactionHistory();
    const subjectMap = {};
    arr.forEach((item) => {
      subjectMap[item.subject.toString().toLowerCase()] = item;
      console.log(item.username, item.subject.toString().toLowerCase());
    });
    transactions.forEach((transaction) => {
      const { args } = decodeFunctionData({
        abi: abi,
        data: transaction.input,
      });
      const subject = args[0].toString().toLowerCase();
      if (subjectMap[subject]) {
        subjectMap[subject].cost = calculateTransactionCost(transaction);
      }
    });
    holdings = arr.filter((item) => {
      return item.cost;
    });
    console.log("holdings", holdings.length);
  };

  const calculateTransactionCost = (transaction) => {
    const gasUsed = BigInt(transaction.gasUsed);
    const gasPrice = BigInt(transaction.gasPrice);
    const value = BigInt(transaction.value);

    // 计算总成本
    const totalCost = gasUsed * gasPrice + value;

    return totalCost.toString();
  };

  const getTransactionHistory = async () => {
    try {
      const transactions = await axios.get(
        `https://api.basescan.org/api?module=account&action=txlist&address=${wallet.address}&startblock=0&endblock=99999999&sort=asc&apikey=${BASE_SCAN_API}`,
        {
          timeout: 3000,
        }
      );
      const succeedTransactions = (transactions?.data?.result || [])?.filter(
        (transaction) => {
          return (
            transaction.isError === "0" && transaction.to === contractAddress
          );
        }
      );
      return succeedTransactions || [];
    } catch (error) {
      await sleep(5);
      return await getTransactionHistory();
    }
  };

  const watchHoldingsActivity = async () => {
    console.log(chalk.gray("check holdings activity..."));
    try {
      const res = await axios({
        method: "get",
        url: `https://prod-api.kosetto.com/holdings-activity/${wallet.address}`,
        headers: {
          Host: "prod-api.kosetto.com",
          "sec-ch-ua":
            '"Chromium";v="112", "Google Chrome";v="112", "Not:A-Brand";v="99"',
          accept: "application/json",
          "sec-ch-ua-platform": '"Android"',
          "sec-ch-ua-mobile": "?1",
          authorization: wallet.authorization,
          "user-agent":
            "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36",
          "content-type": "application/json",
          origin: "https://www.friend.tech",
          "sec-fetch-site": "cross-site",
          "sec-fetch-mode": "cors",
          "sec-fetch-dest": "empty",
          referer: "https://www.friend.tech/",
          "accept-language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7",
          "if-none-match": wallet.ifNoneMatch,
        },
        timeout: 1000 * 5,
      });
      // console.log(chalk.blue("res.data?.events", res.data?.events.length));
      if (res.data?.events?.length) {
        if (!lastActivity) {
          lastActivity = res.data.events[0];
          if (
            lastActivity.isBuy &&
            lastActivity.trader.address.toLowerCase() !==
              wallet.address.toLowerCase()
          ) {
            console.warn(chalk.green("try execute sell..."));
            await refreshHoldings();
            await checkIfSell();
          }
        } else {
          const index = res.data.events.findIndex(
            (item) =>
              item.subject.address === lastActivity.subject.address &&
              item.createAt === lastActivity.createAt &&
              item.trader.address === lastActivity.trader.address
          );
          if (index > -1) {
            const newEvents = res.data.events.slice(0, index);
            const newBuyEvents = newEvents.filter(
              (item) =>
                item.isBuy &&
                item.trader.address.toLowerCase() !==
                  wallet.address.toLowerCase()
            );
            console.log(
              chalk.yellow(`there are ${newBuyEvents.length} new buy events`)
            );
            if (newBuyEvents.length) {
              console.warn(chalk.green("try execute sell..."));
              await refreshHoldings();
              await checkIfSell();
            }
            lastActivity = res.data.events[0];
          }
        }
      }
    } catch (error) {
      console.log("fetch holdings activity error");
    }
    await watchContractTradeEvent();
  };

  const getSellPrice = async (subjectAddress) => {
    const price = await contract.read.getSellPriceAfterFee({
      args: [subjectAddress, amount],
    });
    return price;
  };

  const checkIfOwn = async (subjectAddress) => {
    try {
      const balance = await contract.read.sharesBalance({
        args: [subjectAddress, wallet.address],
      });
      if (balance > 0n) {
        return balance;
      } else {
        console.log("not own");
        return false;
      }
    } catch (error) {
      await sleep(3);
      return await checkIfOwn(subjectAddress);
    }
  };

  const sellShare = async (subjectAddress, own = 1) => {
    try {
      const data = encodeFunctionData({
        abi: abi,
        functionName: "sellShares",
        args: [subjectAddress, own],
      });
      const txParams = {
        value: 0,
        data: data,
        to: contractAddress,
        gasPrice: parseGwei("0.3"),
        gasLimit,
        nonce: nonce++,
      };
      const hash = await client.sendTransaction(txParams);
      console.log(`Sent tx > ${hash}`);
      const transaction = await publicClient.waitForTransactionReceipt({
        hash,
      });
      if (transaction.status === "success") {
        return true;
      } else {
        return false;
      }
    } catch (error) {
      return false;
    }
  };

  const trySell = async (share) => {
    const price = await getSellPrice(share.subject);
    console.log(share.subject, price, share.cost);
    const ethPrice = formatEther(price).substring(0, 8);
    const costEthPrice = formatEther(share.cost).substring(0, 8);
    const benefit =
      (parseFloat(ethPrice) - parseFloat(costEthPrice)) * ETH_USCT_Rate;
    console.log(
      chalk[benefit > 0 ? "green" : "yellow"]("benefit", benefit, " USDT")
    );
    const own = await checkIfOwn(share.subject);
    if (!own) {
      return false;
    }
    if (
      parseFloat(ethPrice) > 0 &&
      benefit > wallet.sellBenefit &&
      !wallet.whiteList.some(
        (address) => address.toLowerCase() === share.subject.toLowerCase()
      )
    ) {
      console.log("selling", share.subject, "price", ethPrice);
      const isSold = await sellShare(share.subject, own);
      if (isSold) {
        holdings = holdings.filter((item) => item.subject !== share.subject);
      }
      return isSold;
    } else {
      return false;
    }
  };

  const checkIfSell = async () => {
    await freshNonce();
    let unwatched = false;
    if (unwatch) {
      await unwatch();
      unwatched = true;
    }
    while (buying) {
      await sleep(1);
    }
    for (let index = 0; index < holdings.length; index++) {
      selling = true;
      const share = holdings[index];
      const sold = await trySell(share);
      if (sold) {
        index = index - 1;
      }
    }
    selling = false;
    // 如果去取消了购买轮询，要重新启用
    if (unwatched) {
      await watchContractTradeEvent();
    }
  };

  const execute = async () => {
    if (unwatch) {
      await unwatch();
    }
    if (intervalId !== undefined) {
      clearInterval(intervalId);
    }
    await refreshHoldings();
    await checkIfSell();
    await watchContractTradeEvent();

    intervalId = setInterval(async () => {
      if (!selling) {
        await watchHoldingsActivity();
      }
    }, 1000 * 30);
  };

  execute();
};

logIntro();
consoleStamp(console, {
  format: ":date(yyyy/mm/dd HH:MM:ss)",
});
const password1 = readlineSync.question("Password1: ", {
  hideEchoBack: true, // The typed text on screen is hidden by `*` (default).
});
const password2 = readlineSync.question("Password2: ", {
  hideEchoBack: true, // The typed text on screen is hidden by `*` (default).
});
process.env.pw1 = password1;
process.env.pw2 = password2;
if (password1 && password2) {
  for (let index = 0; index < wallets.length; index++) {
    const wallet = wallets[index];
    main({
      ...wallet,
      pk: decrypt(wallet.pk, password1, password2),
      authorization: decrypt(wallet.authorization, password1, password2),
    });
  }
}
