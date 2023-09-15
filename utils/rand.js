export const randfloat = (min, max) => {
  if (min > max) {
    [min, max] = [max, min];
  }

  return Math.random() * (max - min) + min;
};
export const randint = (min, max) => {
  if (min > max) {
    [min, max] = [max, min];
  }

  return Math.floor(Math.random() * (max - min + 1)) + min;
};
