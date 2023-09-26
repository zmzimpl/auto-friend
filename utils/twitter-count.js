import puppeteer from "puppeteer";
import { sleep, getPropByStringPath, getDir } from "./index.js";
import axios from "axios";
import fs from "fs";
import { authorization } from "../constants/oauth.js";
import { BuyStrategy, shouldFetchTwitterViewInfo } from "../strategy/buy.js";

let guestToken;
const guestTokenMap = JSON.parse(fs.readFileSync("guest-tokens.json", "utf-8"));
let userCacheMap = {};
setInterval(() => {
  userCacheMap = {};
}, 1000 * 60 * 30);

export async function fetchEntriesInfo(userId, guestToken) {
  const url = `https://twitter.com/i/api/graphql/S1oSH7OJKAdzafiVzZqz1Q/UserTweets?variables=%7B%22userId%22%3A%22${userId}%22%2C%22count%22%3A20%2C%22includePromotedContent%22%3Atrue%2C%22withQuickPromoteEligibilityTweetFields%22%3Atrue%2C%22withVoice%22%3Atrue%2C%22withV2Timeline%22%3Atrue%7D&features=%7B%22responsive_web_graphql_exclude_directive_enabled%22%3Atrue%2C%22verified_phone_label_enabled%22%3Afalse%2C%22creator_subscriptions_tweet_preview_api_enabled%22%3Atrue%2C%22responsive_web_graphql_timeline_navigation_enabled%22%3Atrue%2C%22responsive_web_graphql_skip_user_profile_image_extensions_enabled%22%3Afalse%2C%22tweetypie_unmention_optimization_enabled%22%3Atrue%2C%22responsive_web_edit_tweet_api_enabled%22%3Atrue%2C%22graphql_is_translatable_rweb_tweet_is_translatable_enabled%22%3Atrue%2C%22view_counts_everywhere_api_enabled%22%3Atrue%2C%22longform_notetweets_consumption_enabled%22%3Atrue%2C%22responsive_web_twitter_article_tweet_consumption_enabled%22%3Afalse%2C%22tweet_awards_web_tipping_enabled%22%3Afalse%2C%22freedom_of_speech_not_reach_fetch_enabled%22%3Atrue%2C%22standardized_nudges_misinfo%22%3Atrue%2C%22tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled%22%3Atrue%2C%22longform_notetweets_rich_text_read_enabled%22%3Atrue%2C%22longform_notetweets_inline_media_enabled%22%3Atrue%2C%22responsive_web_media_download_video_enabled%22%3Afalse%2C%22responsive_web_enhance_cards_enabled%22%3Afalse%7D`;

  const res = await axios.get(url, {
    headers: {
      accept: "*/*",
      "accept-language": "zh-CN,zh;q=0.9",
      authorization: authorization,
      "content-type": "application/json",
      "sec-ch-ua":
        '"Chromium";v="116", "Not)A;Brand";v="24", "Google Chrome";v="116"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "x-guest-token": `${guestToken}`,
      "x-twitter-active-user": "yes",
      "x-twitter-client-language": "zh-cn",
    },
    withCredentials: true,
    timeout: 6000,
  });

  const instructions = getPropByStringPath(
    res.data,
    "data.user.result.timeline_v2.timeline.instructions"
  );
  const entries =
    instructions.find((f) => f.type === "TimelineAddEntries")?.entries || [];
  const views = [];
  const favorites = [];

  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];
    const isTweet =
      entry.entryId?.includes("tweet-") &&
      entry.content.entryType === "TimelineTimelineItem";

    if (isTweet) {
      const isAuthor =
        getPropByStringPath(
          entry,
          "content.itemContent.tweet_results.result.legacy.user_id_str"
        ) == userId;
      if (isAuthor) {
        const viewCount = getPropByStringPath(
          entry,
          "content.itemContent.tweet_results.result.views.count"
        );
        const legacy = getPropByStringPath(
          entry,
          "content.itemContent.tweet_results.result.legacy"
        );
        const favoriteCount = legacy.favorite_count;
        if (viewCount) {
          views.push(+viewCount);
        }
        if (favoriteCount) {
          favorites.push(favoriteCount);
        }
      }
    }
  }
  console.log(
    "views data: ",
    JSON.stringify(views),
    `from ${views.length} posts`
  );
  console.log(
    "favorites data: ",
    JSON.stringify(favorites),
    `from ${favorites.length} posts`
  );
  return {
    viewAvg: views.length
      ? Math.floor(views.reduce((a, b) => a + b) / views.length)
      : 0,
    favoriteAvg: favorites.length
      ? Math.floor(favorites.reduce((a, b) => a + b) / favorites.length)
      : 0,
  };
}

export async function callTwitterApi(username, guestToken) {
  const url = `https://twitter.com/i/api/graphql/G3KGOASz96M-Qu0nwmGXNg/UserByScreenName?variables=%7B%22screen_name%22%3A%22${username}%22%2C%22withSafetyModeUserFields%22%3Atrue%7D&features=%7B%22hidden_profile_likes_enabled%22%3Atrue%2C%22hidden_profile_subscriptions_enabled%22%3Atrue%2C%22responsive_web_graphql_exclude_directive_enabled%22%3Atrue%2C%22verified_phone_label_enabled%22%3Afalse%2C%22subscriptions_verification_info_is_identity_verified_enabled%22%3Atrue%2C%22subscriptions_verification_info_verified_since_enabled%22%3Atrue%2C%22highlights_tweets_tab_ui_enabled%22%3Atrue%2C%22creator_subscriptions_tweet_preview_api_enabled%22%3Atrue%2C%22responsive_web_graphql_skip_user_profile_image_extensions_enabled%22%3Afalse%2C%22responsive_web_graphql_timeline_navigation_enabled%22%3Atrue%7D&fieldToggles=%7B%22withAuxiliaryUserLabels%22%3Afalse%7D`;

  const res = await axios.get(url, {
    headers: {
      accept: "*/*",
      "accept-language": "zh-CN,zh;q=0.9",
      authorization: authorization,
      "content-type": "application/json",
      "sec-ch-ua":
        '"Chromium";v="116", "Not)A;Brand";v="24", "Google Chrome";v="116"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "x-guest-token": `${guestToken}`,
      "x-twitter-active-user": "yes",
      "x-twitter-client-language": "zh-cn",
    },
    withCredentials: true,
    timeout: 5000,
  });
  const isBlueVerified = getPropByStringPath(
    res.data,
    "data.user.result.is_blue_verified"
  );
  const userId = getPropByStringPath(res.data, "data.user.result.rest_id");
  const userInfo = getPropByStringPath(res.data, "data.user.result.legacy");
  if (userInfo) {
    if (
      isBlueVerified &&
      BuyStrategy.onlyBuyBlueVerified &&
      shouldFetchTwitterViewInfo()
    ) {
      const entriesInfo = await fetchEntriesInfo(userId, guestToken);
      Object.assign(userInfo, { ...entriesInfo });
    }
    userInfo.isBlueVerified = isBlueVerified;
    return userInfo;
  } else {
    return {};
  }
}

export async function getGuestToken() {
  const headers = {
    Authorization: authorization,
  };
  try {
    const response = await axios.post(
      "https://api.twitter.com/1.1/guest/activate.json",
      {},
      { headers: headers }
    );

    if (response.data && response.data.guest_token) {
      return response.data.guest_token;
    } else {
      console.error("Failed to get guest token:", response.data);
      return null;
    }
  } catch (error) {
    console.error("Error fetching guest token:", error.message);
    return null;
  }
}

async function getTwitterUserInfoUseApi(username) {
  if (!guestToken || (guestToken && guestTokenMap[guestToken] > 60)) {
    guestToken = await getGuestToken();
  }
  let retry = 0;
  const fn = async () => {
    if (guestToken) {
      try {
        if (userCacheMap[username]) {
          return userCacheMap[username];
        } else {
          const user = await callTwitterApi(username, guestToken);
          if (user) {
            userCacheMap[username] = user;
          }

          if (guestTokenMap[guestToken] !== undefined) {
            guestTokenMap[guestToken] += 1;
          } else {
            guestTokenMap[guestToken] = 1;
          }
          fs.writeFileSync(
            getDir("guest-tokens.json"),
            JSON.stringify(guestTokenMap, null, 2)
          );
          return user;
        }
      } catch (error) {
        console.log("error", error.code);
        if (retry < 3) {
          await sleep(5);
          guestToken = await getGuestToken();
          retry++;
          return await fn();
        } else {
          // 如果所有尝试都失败，返回一个空响应
          return {};
        }
      }
    }
  };
  return await fn();
}

async function getTwitterUserInfoUsePuppeteer(username) {
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

export const getUserInfo = async (username) => {
  try {
    let data;
    if (process.env.useTwitterAPI) {
      data = await getTwitterUserInfoUseApi(username);
    } else {
      data = await getTwitterUserInfoUsePuppeteer(username);
    }
    return data;
  } catch (error) {
    console.log("getUserInfo failed", error);
    await sleep(3);
    return {};
  }
};
