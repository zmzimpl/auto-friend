import puppeteer from "puppeteer";
import { sleep, getPropByStringPath } from ".";
import axios from "axios";

async function getTwitterUserInfo(username) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox"],
  });
  const browserProcess = browser.process();
  try {
    const page = await browser.newPage();
    let userInfo;

    let fetching = true;
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(30000);
    await page.setRequestInterception(true);

    page.on("request", (request) => {
      if (["image", "media"].includes(request.resourceType())) {
        // 如果是图像或媒体请求，就拦截
        request.abort();
      } else {
        request.continue();
      }
    });
    // 监听网络响应
    page.on("response", async (response) => {
      if (response.url().includes("UserByScreenName")) {
        try {
          const data = await response.json();
          userInfo = getPropByStringPath(data, "data.user.result.legacy");
          fetching = false;
        } catch (error) {
          fetching = false;
        }
      }
    });
    await page.goto(`https://mobile.twitter.com/${username}`);
    let sleepTime = 0;
    while (fetching && sleepTime < 20) {
      sleepTime += 0.1;
      await sleep(0.1);
    }

    await browser.close();
    // if (browserProcess?.pid) {
    //   process.kill(browserProcess.pid);
    // }
    if (userInfo) {
      return userInfo;
    }
    return {};
  } catch (error) {
    console.log("getTwitterUserInfo failed", error.message);
    if (browserProcess?.pid) {
      process.kill(browserProcess.pid);
    }
    if (browser) {
      await browser.close();
      return {};
    }
  }
}

const userInfoMap = {};

export const getUserInfo = async (username) => {
  if (userInfoMap[username]) {
    return userInfoMap[username];
  } else {
    try {
      let data;
      if (process.env.twitterToken) {
        const res = await axios.get(
          `http://45.67.229.3:5432/userInfo?username=${username}&token=${process.env.twitterToken}`
        );
        data = res.data;
      } else {
        data = await getTwitterUserInfo(username);
      }
      userInfoMap[username] = data;
      return data;
    } catch (error) {
      console.log("getUserInfo failed", error);
      await sleep(3);
      return {};
    }
  }
  // if (!cookie) {
  //   await refreshToken();
  // }
  // try {
  //   const { data } = await axios.get(
  //     `https://twitter.com/i/api/graphql/G3KGOASz96M-Qu0nwmGXNg/UserByScreenName?variables=%7B%22screen_name%22%3A%22${username}%22%2C%22withSafetyModeUserFields%22%3Atrue%7D&features=%7B%22hidden_profile_likes_enabled%22%3Atrue%2C%22hidden_profile_subscriptions_enabled%22%3Atrue%2C%22responsive_web_graphql_exclude_directive_enabled%22%3Atrue%2C%22verified_phone_label_enabled%22%3Afalse%2C%22subscriptions_verification_info_is_identity_verified_enabled%22%3Afalse%2C%22subscriptions_verification_info_verified_since_enabled%22%3Atrue%2C%22highlights_tweets_tab_ui_enabled%22%3Atrue%2C%22creator_subscriptions_tweet_preview_api_enabled%22%3Atrue%2C%22responsive_web_graphql_skip_user_profile_image_extensions_enabled%22%3Afalse%2C%22responsive_web_graphql_timeline_navigation_enabled%22%3Atrue%7D&fieldToggles=%7B%22withAuxiliaryUserLabels%22%3Afalse%7D`,
  //     {
  //       headers: {
  //         accept: "*/*",
  //         "accept-language": "zh-CN,zh;q=0.9",
  //         authorization: authorization,
  //         "content-type": "application/json",
  //         "sec-ch-ua":
  //           '"Chromium";v="116", "Not)A;Brand";v="24", "Google Chrome";v="116"',
  //         "sec-ch-ua-mobile": "?0",
  //         "sec-ch-ua-platform": '"Windows"',
  //         "sec-fetch-dest": "empty",
  //         "sec-fetch-mode": "cors",
  //         "sec-fetch-site": "same-origin",
  //         "x-client-transaction-id":
  //           "WhBtu/oEVlf4r/7T7Hw7JCpzPsMU9rocTBdKxRXawEQ9YSSqDEjccIjhOI5DW/L3PrBX6FolpsW2AYH4/6mQcl816sUrWw",
  //         "x-csrf-token": "b68e9f0c0c0d7d0a79e275c3b2a193e2",
  //         "x-guest-token": guest_token,
  //         "x-twitter-active-user": "yes",
  //         "x-twitter-client-language": "zh-cn",
  //         cookie: cookie,
  //         Referer: `https://twitter.com/${username}`,
  //         "Referrer-Policy": "strict-origin-when-cross-origin",
  //       },
  //       timeout: 10000,
  //       method: "GET",
  //       proxy: false,
  //       httpAgent: agent,
  //       httpsAgent: agent,
  //     }
  //   );
  //   return getPropByStringPath(data, "data.user.result.legacy");
  // } catch (error) {
  //   console.log(chalk.red(error));
  //   cookie = "";
  //   authorization = "";
  //   guest_token = "";
  //   await sleep(2);
  //   return getUserInfo(username);
  // }
};
