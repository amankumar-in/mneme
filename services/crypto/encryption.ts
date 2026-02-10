import QuickCrypto from 'react-native-quick-crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // 96-bit IV for GCM
const TAG_LENGTH = 16 // 128-bit auth tag
const SALT_LENGTH = 32
const KEY_LENGTH = 32 // 256-bit key
const PBKDF2_ITERATIONS = 100000

/**
 * Generate a random salt for PBKDF2
 */
export function generateSalt(): string {
  const salt = QuickCrypto.randomBytes(SALT_LENGTH)
  return Buffer.from(salt).toString('base64')
}

/**
 * Derive an AES-256 key from a password using PBKDF2
 */
export function deriveKey(password: string, saltBase64: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const salt = Buffer.from(saltBase64, 'base64')
    QuickCrypto.pbkdf2(
      password,
      salt,
      PBKDF2_ITERATIONS,
      KEY_LENGTH,
      'sha512',
      (err: Error | null, derivedKey?: any) => {
        if (err) reject(err)
        else resolve(Buffer.from(derivedKey))
      }
    )
  })
}

/**
 * Encrypt plaintext using AES-256-GCM
 * Returns base64-encoded string: iv(12) + tag(16) + ciphertext
 */
export function encrypt(plaintext: string, key: Buffer): string {
  const iv = QuickCrypto.randomBytes(IV_LENGTH)
  const cipher = QuickCrypto.createCipheriv(ALGORITHM, key as any, iv, {
    authTagLength: TAG_LENGTH,
  })

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])

  const tag = cipher.getAuthTag()

  // Pack: iv + tag + ciphertext
  const packed = Buffer.concat([
    Buffer.from(iv),
    Buffer.from(tag),
    encrypted,
  ])

  return packed.toString('base64')
}

/**
 * Decrypt base64-encoded AES-256-GCM ciphertext
 * Input format: iv(12) + tag(16) + ciphertext
 */
export function decrypt(encryptedBase64: string, key: Buffer): string {
  const packed = Buffer.from(encryptedBase64, 'base64')

  const iv = packed.subarray(0, IV_LENGTH)
  const tag = packed.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
  const ciphertext = packed.subarray(IV_LENGTH + TAG_LENGTH)

  const decipher = QuickCrypto.createDecipheriv(ALGORITHM, key as any, iv, {
    authTagLength: TAG_LENGTH,
  })
  decipher.setAuthTag(tag as any)

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ])

  return decrypted.toString('utf8')
}
