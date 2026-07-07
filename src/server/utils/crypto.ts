import crypto from "crypto";

const FERNET_KEY = process.env.FERNET_KEY || "generate_a_real_fernet_key_of_32_bytes_length";

// Generate a 32-byte key from the FERNET_KEY string using SHA256
function getEncryptionKey(): Buffer {
  return crypto.createHash("sha256").update(FERNET_KEY).digest();
}

/**
 * Encrypts a text string using AES-256-CBC
 */
export function encryptApiKey(apiKey: string): string {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    
    let encrypted = cipher.update(apiKey, "utf8", "hex");
    encrypted += cipher.final("hex");
    
    // Return iv and encrypted data concatenated with a colon
    return `${iv.toString("hex")}:${encrypted}`;
  } catch (err) {
    console.error("Encryption failed:", err);
    throw new Error("Failed to encrypt API key");
  }
}

/**
 * Decrypts an AES-256-CBC encrypted string
 */
export function decryptApiKey(encryptedData: string): string {
  try {
    const parts = encryptedData.split(":");
    if (parts.length !== 2) {
      throw new Error("Invalid encrypted data format");
    }
    
    const iv = Buffer.from(parts[0], "hex");
    const encryptedText = Buffer.from(parts[1], "hex");
    const key = getEncryptionKey();
    
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString("utf8");
  } catch (err) {
    console.error("Decryption failed:", err);
    throw new Error("Failed to decrypt API key");
  }
}

/**
 * Masks an API key for safe representation in the frontend
 * Example: sk-abc...xyz
 */
export function maskApiKey(apiKey: string): string {
  if (!apiKey) return "";
  if (apiKey.length <= 8) return "********";
  return `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}`;
}
