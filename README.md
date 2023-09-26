![](https://i.ibb.co/nz5X3Lm/20230907173458.png)
![](https://i.ibb.co/pr54WvL/20230914233252.png)

# Friend Tech 自动交易脚本

## 功能

- 限价购买策略
- Twitter 关注数/推文数策略
- Twitter 文章浏览量策略
- 白名单购买策略
- 组合策略
- 超过多少利润自动获利
- 指定 key 使用不同的卖出策略
- Bot 地址筛选

## 启动前准备

确保你的网络能够通畅的访问 Twitter 等网站，并且已经安装了最新版本的 NodeJS.

### 获取你的 `authorization` 和 `private key` 和 `If-None-Match`

如果你是懂抓包的技术人员，则自行通过抓包工具抓包，如果不是，可以通过访问网页版的 friendtech 来获取你的 `authorization`，具体步骤如下

1. 使用 `chrome` 访问 [https://www.friend.tech/](https://www.friend.tech/)
2. 按 `F12` 打开开发者工具，点击以下图标切换到手机预览模式

    ![](https://i.ibb.co/x6D3827/20230914234941.png)

3. 切换之后 `F5` 刷新网页，把 开发者工具切换到 `Console`，输入代码 `document.querySelector('[class^=Home_modalCustomContainer]').remove()` 后回车

    ![](https://i.ibb.co/6vjwhpb/20230914235906.png)

4. 此时你的网页已经可以正常操作了，点击 `Sign In`` 进行登录

5. 登录进来后，打开 `Network` 面板，并且点击 放大镜， 在左侧搜索栏 搜索 `If-None-Match`

    ![](https://i.ibb.co/8bJdJ1Q/20230916010747.png)

6. 在左侧搜索栏中，选择匹配上的文件内容，点击，可在右侧看到 `authorization` 和 `If-None-Match`

    ![](https://i.ibb.co/RH0KHFS/20230916011158.png)

7. 接着你需要导出你的钱包私钥复制出来备用

    ![](https://i.ibb.co/M8QhDtS/20230915000539.png)

### 加密你的 `authorization` 和 `private key`

1. 出于安全考虑，我不建议你以明文形式存储密码，代码中 `utils` 目录下提供了 `encrypt.js` 和 `decrypt.js` 进行加解密，
    - 将 `// console.log(encrypt('your key', 'password1', 'password2'));` 的注释 `//` 删掉，
    - 填充你要加密的信息和密码
    - 执行 `npm run encrypt`，控制台输出的就是加密后的信息，把加密后的 `` 和 `` 填入 `wallets.example.json` 即可
    - 另外，上个步骤获取到的 `If-None-Match` 也要填入到 `IfNoneMatch`，注意将双引号内的双引号通过反斜杠转义一下

    ![](https://i.ibb.co/DfSp4KJ/20230916141626.png)

2. 如果你不想要加密，则删除 index.js 代码底部代码由原来的

```js
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
```

替换为:

```js
  for (let index = 0; index < wallets.length; index++) {
      const wallet = wallets[index];
    main({
        ...wallet,
    });
  }
```

3. 在填好了 `wallets.example.json` 需要的信息之后，将 `wallets.example.json` 改名 `wallets.json`

4. `useTwitterAPI` 默认使用开启，在编辑器下运行需要你全局代理（如果你的电脑需要VPN才能访问推特的话），可以使用 Clash 的 TUN 模式，海外用户不需要代理。
`useTwitterAPI` 设置为 `false` 也能跑，使用的是本地 puppeteer 环境，会很慢并且卡，慎用

## 自定义配置

策略关系到你的盈亏，所以请认真配置，所有的策略都可以在 `strategy/buy` `strategy/sell` 自由组合，策略不是越多越好，策略越多越严检查越费时，会影响买入效率，策略太宽松，会导致频繁买入一些低质量的 key

```js
export const STRATEGY_TYPES = {
  // 购买策略
  // 推特关注数（大于等于）
  TWITTER_FOLLOWERS: "TWITTER_FOLLOWERS",
  // 推特文章数（大于等于）
  TWITTER_POSTS: "TWITTER_POSTS",
  // 按照 key 的价格买入（小于等于）
  KEY_PRICE: "KEY_PRICE",
  // 白名单，只看价格，不看其他的指标
  WHITELIST: "WHITELIST",

  // 出售策略
  // 按照收益多少决定是否出售
  BENEFIT: "BENEFIT",
  // 按照持有时长决定是否出售
  HOLDING_DURATION: "HOLDING_DURATION",
  // 某些特殊地址给特殊的出售策略，比如你的总体出售策略是收益大于 4 USD就出售，有一个 key 想要长期持有，这个就能用上，下面有示例
  SPECIFY_LIST: "SPECIFY_LIST"
};
```

### 买入策略配置 `strategy/buy`

```js
/**
 * 购买策略
 * 涉及价格，金额的单位统一为 ETH
 */
const BuyStrategy = {
  /**
   * 策略解释：
   * 1： 价格 < 0.002 并且 跨链金额 > 0.1 并且 账号的 nonce 数 < 5 并且 关注数 > 15000 并且 文章数 > 100
   * 2.  价格 < 0.004 并且 跨链金额 > 0.2 并且 账号的 nonce 数 < 5 并且 关注数 > 35000 并且 文章数 > 400
   * 3.  白名单 zmzimpl，价格 < 0.0005, 买 1 个
   *     白名单 elonmusk，价格 < 0.05, 买 2 个
   * 
   * 1，2，3 三个策略使用 OR 连接，即满足其中一个即可买入
   */
  operator: STRATEGY_OPERATORS.OR,
  conditions: [
    {
      operator: STRATEGY_OPERATORS.AND,
      conditions: [
        // 价格
        { type: STRATEGY_TYPES.KEY_PRICE, value: 0.002 },
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

```

### 卖出配置 `strategy/sell`

```js
/**
 * 卖出策略
 * 利润单位为 USD
 */
const sellStrategy = {
  /**
   * 策略解释：
   * 1： 利润 > 10 USD
   * 2.  持有时间超过 240 个小时
   * 
   * 1，2 使用 OR 连接，即满足其中一个即卖出
   * 
   * specifies：当地址 0x634b5B0D940f6A4C48d5E6180a47EBb543a23F46 利润超过 100 USD 并且持有时长超过 24 小时，才* 会卖出 0x634b5B0D940f6A4C48d5E6180a47EBb543a23F46
   */
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

```

## 脚本启动

1. 安装 [Nodejs](https://nodejs.org/en/download)
2. 下载代码
3. 使用 cmd，将路径导航到代码文件夹下，执行 `npm install`

    ![](https://i.ibb.co/G7JX1jv/20230915100955.png)

5. 执行 `npm run start`，你可以看到这个界面，输入你的解密密码

    ![](https://i.ibb.co/L9bcBzV/20230915101119.png)

7. 看到像这样的界面说明执行成功了

    ![](https://i.ibb.co/7b1cwnj/20230920103701.png)

## FAQ

1. ubuntu系统若运行过程中报错 `cannot open shared object file: No such file or directory` ，请输入以下命令，安装所需依赖<br>
    `sudo apt-get install ca-certificates fonts-liberation libappindicator3-1 libasound2 libatk-bridge2.0-0 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgbm1 libgcc1 libglib2.0-0 libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 lsb-release wget xdg-utils`<br>
    具体可看： <https://stackoverflow.com/questions/66214552/tmp-chromium-error-while-loading-shared-libraries-libnss3-so-cannot-open-sha>

2. 一直在刷新 Nonce, 是什么问题？
    因为现在使用的是 friendtech 的 rpc, 如果出现这个问题长时间没改善，建议自己注册一个 rpc 使用，修改代码：

    ```js
    const publicClient = createPublicClient({
        chain: base,
        transport: http(
            "https://base-mainnet.blastapi.io/你的 rpc id"
        ),
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
            "wss://base-mainnet.blastapi.io/你的 rpc id"
        ),
    });
    ```

3. 出现了比如以下找不到 chrome, 版本对不上的错误，请更新你的 chrome 版本

    ![](https://i.ibb.co/8rMxMZf/qgZtZ-9U.png)

## 注意事项

此脚本仅用于学习交流目的，不保证盈利，策略错误的情况下甚至会有亏损风险，请基于个人意愿决定是否使用。代码完全开源无后门，使用的依赖库也是都是开源库，有代码能力请自行进行审查

如果你有任何问题，可以提 Issue，或者在在推特上关注我 [@zmzimpl](https://twitter.com/zmzimpl) 在推文下留言询问，我看到了会回复
