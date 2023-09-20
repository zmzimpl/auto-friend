import figlet from "figlet";
import logUpdate from "log-update";

import { chalk } from "./chalk.js";
import { formatDate } from "./date.js";
import { sleep } from "./sleep.js";
import { actionToColor } from "../constants/actionToColor.js";
import { LOADER_FRAMES } from "../constants/index.js";

export const logIntro = () => {
  console.log(
    `\n${chalk.cyanBright(
      figlet.textSync("MILES", {
        font: "Alligator",
        horizontalLayout: "default",
        verticalLayout: "default",
        width: 150,
        whitespaceBreak: true,
      })
    )}\n`
  );
  console.log(
    chalk.cyanBright.bold(
      `👽 Supports: Twitter followers check, Pending tx watching, Auto sell if profitable.
      ❤️  Follow me on Twitter if you find it helpful: @zmzimpl `
    )
  );
};
export const logWork = ({ walletAddress, actionName, subject, price }) => {
  console.log(
    `${chalk.cyanBright(
      `[LOG ${walletAddress.slice(0, 6)}..${walletAddress.slice(-3)}]`
    )} ${actionToColor[actionName](
      actionName.toUpperCase()
    )} > ${subject} - ${price}`
  );
};

export const logLoader = async ({ loadingText, successText }, fn) => {
  let i = 0;
  const interval = setInterval(() => {
    logUpdate(
      `[${formatDate(new Date())}] ` +
        chalk.gray(
          `${loadingText} ${LOADER_FRAMES[(i = ++i % LOADER_FRAMES.length)]}`
        )
    );
  }, 100);
  await fn();
  clearInterval(interval);
  if (successText) {
    logUpdate(`[${formatDate(new Date())}] ` + chalk.green(successText));
  }
};

export const logClock = async ({ waitingText, endText, timeout }, fn) => {
  let i = 0;

  const interval = setInterval(() => {
    timeout = timeout - 1;
    logUpdate(
      `[${formatDate(new Date())}] ` +
        chalk.gray(
          `${waitingText}, after ${timeout} seconds ${
            LOADER_FRAMES[(i = ++i % LOADER_FRAMES.length)]
          }`
        )
    );
  }, 1000);
  await sleep(timeout);
  clearInterval(interval);
  await fn();
  logUpdate(`[${formatDate(new Date())}] ` + chalk.green(endText));
};
