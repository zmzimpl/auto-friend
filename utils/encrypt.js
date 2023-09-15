import crypto from "crypto";

// 加密
export const encrypt = (text, password1, password2) => {
  let iv = password2;
  if (iv.length < 16) {
    iv = iv.padEnd(16, "0");
  }
  let key = password1 + password2;
  if (key.length < 32) {
    key = key.padEnd(32, "0");
  }
  const cipher = crypto.createCipheriv(
    "aes-256-cbc",
    Buffer.from(key),
    Buffer.from(iv)
  );
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return encrypted.toString("hex");
};

// console.log(encrypt('your key', 'password1', 'password2'));
