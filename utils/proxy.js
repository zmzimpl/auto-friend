import { SocksProxyAgent } from "socks-proxy-agent";

// 设置代理配置
export const proxyConfig = {
  socksHost: "45.192.220.78", // 例如: '127.0.0.1'
  socksPort: 33544, // 例如: 1080
  socksUsername: "user132", // 如果代理需要认证
  socksPassword: "uK260yDX", // 如果代理需要认证
};

export const agent = new SocksProxyAgent(
  `socks://${proxyConfig.socksUsername}:${proxyConfig.socksPassword}@${proxyConfig.socksHost}:${proxyConfig.socksPort}`
);
