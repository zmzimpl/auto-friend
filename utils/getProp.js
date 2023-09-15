export const getPropByStringPath = (obj, path) => {
  const parts = path.split(".");
  let current = obj;

  for (let i = 0; i < parts.length; i++) {
    if (current === null || typeof current !== "object") {
      return undefined;
    }

    // Check if the current part is an array index
    const arrayMatch = parts[i].match(/(\w+)\[(\d+)\]/);
    if (arrayMatch) {
      const arrayName = arrayMatch[1];
      const index = parseInt(arrayMatch[2], 10);
      if (
        Array.isArray(current[arrayName]) &&
        index < current[arrayName].length
      ) {
        current = current[arrayName][index];
      } else {
        return undefined;
      }
    } else {
      current = current[parts[i]];
    }
  }

  return current;
};
