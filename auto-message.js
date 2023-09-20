import axios from "axios";
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
  chalk,
} from "./utils";
import WebSocket from "ws";
import { createPublicClient, formatEther, webSocket } from "viem";
import { base } from "viem/chains";
import pkg from "lodash";
import readlineSync from "readline-sync";
import consoleStamp from "console-stamp";

const { throttle } = pkg;

const wallets = JSON.parse(readFileSync(getDir("wallets.json"), "utf8"));
const websocketClient = createPublicClient({
  chain: base,
  transport: webSocket(
    "wss://base-mainnet.blastapi.io/fe9c30fc-3bc5-4064-91e2-6ab5887f8f4d"
  ),
});
const abi = JSON.parse(readFileSync(getDir("abi.json"), "utf-8"));
const contractAddress = "0xcf205808ed36593aa40a44f10c7f7c2f67d4a4d4";

const autoMessage = async (wallet) => {
  let holdings = [];
  const wss = `wss://prod-api.kosetto.com/?authorization=${wallet.authorization}`;
  let socket;
  let pingInterval;
  let unwatch;

  const sendPing = () => {
    // 检查连接是否打开
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ action: "ping" }));
    }
  };

  const connect = () => {
    socket = new WebSocket(wss);

    socket.on("open", () => {
      console.log("Connected to the WebSocket server");

      // 当连接打开时，每3秒发送一次ping
      pingInterval = setInterval(sendPing, 3000);
      monitor();
    });

    socket.on("message", (data) => {
      const message = data.toString();
      console.log("Message from server:", JSON.parse(message));
    });

    socket.on("error", (error) => {
      console.error("WebSocket Error:", error);
    });

    socket.on("close", (code, reason) => {
      console.log(`Connection closed with code ${code}: ${reason}`);

      // 清除ping的定时器，因为连接已关闭
      clearInterval(pingInterval);

      setTimeout(() => {
        console.log("Trying to reconnect...");
        connect();
      }, 5000); // 5秒后尝试重连
    });
  };

  const getHoldings = async () => {
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
          "if-none-match": 'W/"24e4-q5fI/jr731JFcPR8geGoj8C83QI"',
          timeout: 3000,
        },
      });
      if (res.data?.holdings?.length) {
        holdings = res.data?.holdings;
      } else {
        holdings = [];
      }
    } catch (error) {
      console.log("refreshHoldings error", error);
      await sleep(3);
      await getHoldings();
    }
  };

  const fetchGlobalActivity = async () => {
    const { data: globalActivities } = await axios.get(
      "https://prod-api.kosetto.com/global-activity",
      {
        headers: {
          accept: "application/json",
          authorization:
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhZGRyZXNzIjoiMHg2MzRiNWIwZDk0MGY2YTRjNDhkNWU2MTgwYTQ3ZWJiNTQzYTIzZjQ2IiwiaWF0IjoxNjk0MzMwNzgzLCJleHAiOjE2OTY5MjI3ODN9.j1Zq2G46fwTl356O5wnOTn2ZQc-F3pvECpp1YApJDl4",
          "content-type": "application/json",
          "sec-ch-ua":
            '"Google Chrome";v="105", "Not)A;Brand";v="8", "Chromium";v="105"',
          "sec-ch-ua-mobile": "?1",
          "sec-ch-ua-platform": '"Android"',
          Referer: "https://www.friend.tech/",
          "Referrer-Policy": "strict-origin-when-cross-origin",
        },
      }
    );
    console.log(globalActivities.events);
  };

  const fetchProfile = async (subject) => {
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
          chalk.blue(`${username} followers ${userInfo?.followers_count}`)
        );
        return {
          subject: subject,
          username,
          followers: userInfo?.followers_count,
        };
      } else {
        return {};
      }
    } catch (error) {
      console.log(chalk.red("fetchProfile err", error.message));
      return {};
    }
  };

  const monitor = async () => {
    if (unwatch) {
      await unwatch();
    }
    unwatch = websocketClient.watchContractEvent({
      address: contractAddress,
      abi: abi,
      eventName: "Trade",
      onLogs: throttle(async (logs) => {
        const lowPriceLogs = logs.filter((log) => {
          return parseFloat(formatEther(log.args.ethAmount)) < 0.01;
        });

        for (let index = 0; index < lowPriceLogs.length; index++) {
          const log = lowPriceLogs[index];
          const profile = await fetchProfile(log.args.subject);
          if (!profile.followers) continue;
          if (profile.followers > 20000) {
            // 向你自己的聊天室发送内容
            sendMessage({
              ...profile,
              price: parseFloat(formatEther(log.args.ethAmount)),
              roomOwner: wallet.user_id,
            });

            // 下面这个代码会向你所有持有的 key 的聊天室发送内容
            // await getHoldings();
            // if (holdings.length) {
            //   for (let index = 0; index < holdings.length; index++) {
            //     const holding = holdings[index];
            //     sendMessage(
            //       {
            //         ...profile,
            //         price: parseFloat(formatEther(log.args.ethAmount)),
            //         roomOwner: holding.username,
            //       },
            //       holding.chatRoomId
            //     );
            //     await sleep(2);
            //   }
            // }
          }
        }
        // const profile = await fetchProfile(log.args.subject);
      }, 2000),
      // 每 3 秒执行一次，因为频率太高，获取推特的关注人数方法会有问题() => checkIfBuy(logs)
    });
  };

  function generateHexId(length = 10) {
    let result = "";
    const characters = "0123456789abcdef";
    for (let i = 0; i < length; i++) {
      result += characters.charAt(
        Math.floor(Math.random() * characters.length)
      );
    }
    return result;
  }

  const sendMessage = (profile, chatRoomId) => {
    const msg = {
      action: "sendMessage",
      text: `${
        profile.roomOwner !== wallet.user_id
          ? "Hi, " + profile.roomOwner
          : "New Event"
      }
Low Price Twitter Active:
Twitter Name: @${profile.username}
Followers: ${profile.followers}
Price: ${profile.price} ETH
`,
      imagePaths: [],
      chatRoomId: chatRoomId || "0x634b5b0d940f6a4c48d5e6180a47ebb543a23f46",
      clientMessageId: generateHexId(),
    };

    socket.send(JSON.stringify(msg));
  };

  const execute = async () => {
    connect();
    // await getHoldings();
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
    autoMessage({
      ...wallet,
      pk: decrypt(wallet.pk, password1, password2),
      authorization: decrypt(wallet.authorization, password1, password2),
    });
  }
}
