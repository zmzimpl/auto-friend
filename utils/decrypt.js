import crypto from 'crypto';
export const decrypt = (text, password1, password2) => {
  let iv = password2;
  if (iv.length < 16) {
    iv = iv.padEnd(16, "0");
  }
  let key = password1 + password2;
  if (key.length < 32) {
    key = key.padEnd(32, "0");
  }
  const decipher = crypto.createDecipheriv(
    "aes-256-cbc",
    Buffer.from(key),
    Buffer.from(iv)
  );
  let decrypted = decipher.update(Buffer.from(text, "hex"));
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

// console.log(decrypt('your key', 'password1', 'password2'));