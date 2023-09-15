export const sleep = async (seconds) =>
  new Promise((resolve) =>
    setTimeout(() => {
      // @ts-ignore
      resolve();
    }, seconds * 1000)
  );
