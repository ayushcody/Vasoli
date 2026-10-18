/**
 * Local-first Receipt Vault Encryption
 *
 * Uses WebCrypto (SubtleCrypto) — runs entirely in the browser.
 * - PBKDF2 to derive key from user passphrase
 * - AES-GCM for symmetric encryption of receipts
 * - Salt and IV stored alongside ciphertext, passphrase NEVER stored.
 *
 * THREAT MODEL & PRIVACY GUARANTEES:
 * 1. Encryption happens BEFORE storage: The raw OCR text and manual notes
 *    are encrypted in the browser's memory. The backend only ever receives
 *    the ciphertext (the `vault:v1:...` payload).
 * 2. Zero-Knowledge: The passphrase and the derived key material NEVER leave
 *    the browser. They are not sent over the network, ensuring the server
 *    cannot decrypt user receipts even if the database is compromised.
 */

const PBKDF2_ITERATIONS = 100_000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const VAULT_PREFIX = "vault:v1:";

/** Derive an AES-GCM key from a passphrase and salt */
export async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        encoder.encode(passphrase),
        "PBKDF2",
        false,
        ["deriveKey"]
    );

    return crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt.buffer as ArrayBuffer,
            iterations: PBKDF2_ITERATIONS,
            hash: "SHA-256",
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
}

/** Generate a random salt */
export function generateSalt(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
}

/** Encrypt data with AES-GCM. Returns { iv, ciphertext } as Uint8Arrays */
export async function encrypt(
    data: ArrayBuffer,
    key: CryptoKey
): Promise<{ iv: Uint8Array; ciphertext: Uint8Array }> {
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv.buffer as ArrayBuffer } as any,
        key,
        data
    );
    return { iv, ciphertext: new Uint8Array(ciphertext) };
}

/** Decrypt data with AES-GCM */
export async function decrypt(
    ciphertext: ArrayBuffer,
    key: CryptoKey,
    iv: Uint8Array
): Promise<ArrayBuffer> {
    return crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv.buffer as ArrayBuffer } as any,
        key,
        ciphertext
    );
}

/** Encode encrypted payload to a single Uint8Array: [iv (12) | ciphertext (...)] */
export function packEncrypted(iv: Uint8Array, ciphertext: Uint8Array): Uint8Array {
    const packed = new Uint8Array(iv.length + ciphertext.length);
    packed.set(iv, 0);
    packed.set(ciphertext, iv.length);
    return packed;
}

/** Encode encrypted payload to a single Uint8Array: [salt (16) | iv (12) | ciphertext (...)] */
export function packVaultPayload(
    salt: Uint8Array,
    iv: Uint8Array,
    ciphertext: Uint8Array
): Uint8Array {
    const packed = new Uint8Array(salt.length + iv.length + ciphertext.length);
    packed.set(salt, 0);
    packed.set(iv, salt.length);
    packed.set(ciphertext, salt.length + iv.length);
    return packed;
}

/** Unpack: extract salt, iv, and ciphertext from packed vault array */
export function unpackVaultPayload(
    packed: Uint8Array
): { salt: Uint8Array; iv: Uint8Array; ciphertext: Uint8Array } {
    return {
        salt: packed.slice(0, SALT_LENGTH),
        iv: packed.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH),
        ciphertext: packed.slice(SALT_LENGTH + IV_LENGTH),
    };
}

/** Unpack: extract iv and ciphertext from packed array */
export function unpackEncrypted(packed: Uint8Array): { iv: Uint8Array; ciphertext: Uint8Array } {
    return {
        iv: packed.slice(0, IV_LENGTH),
        ciphertext: packed.slice(IV_LENGTH),
    };
}

/** Encode Uint8Array to hex string */
export function toHex(bytes: Uint8Array): string {
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Decode hex string to Uint8Array */
export function fromHex(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    }
    return bytes;
}

/** Encrypt a string, return hex-encoded packed result */
export async function encryptString(text: string, key: CryptoKey): Promise<string> {
    const encoder = new TextEncoder();
    const encoded = encoder.encode(text);
    const { iv, ciphertext } = await encrypt(encoded.buffer as ArrayBuffer, key);
    return toHex(packEncrypted(iv, ciphertext));
}

/** Decrypt a hex-encoded packed string */
export async function decryptString(hex: string, key: CryptoKey): Promise<string> {
    const packed = fromHex(hex);
    const { iv, ciphertext } = unpackEncrypted(packed);
    const decrypted = await decrypt(ciphertext.buffer as ArrayBuffer, key, iv);
    return new TextDecoder().decode(decrypted);
}

export function isVaultPayload(payload: string): boolean {
    return payload.startsWith(VAULT_PREFIX);
}

/** Encrypt a string with a passphrase and embed salt + iv into the payload */
export async function encryptStringWithPassphrase(text: string, passphrase: string): Promise<string> {
    const salt = generateSalt();
    const key = await deriveKey(passphrase, salt);
    const encoder = new TextEncoder();
    const encoded = encoder.encode(text);
    const { iv, ciphertext } = await encrypt(encoded.buffer as ArrayBuffer, key);
    return `${VAULT_PREFIX}${toHex(packVaultPayload(salt, iv, ciphertext))}`;
}

/** Decrypt a vault payload that embeds salt + iv */
export async function decryptStringWithPassphrase(payload: string, passphrase: string): Promise<string> {
    if (!isVaultPayload(payload)) {
        return payload;
    }

    const packed = fromHex(payload.slice(VAULT_PREFIX.length));
    const { salt, iv, ciphertext } = unpackVaultPayload(packed);
    const key = await deriveKey(passphrase, salt);
    const decrypted = await decrypt(ciphertext.buffer as ArrayBuffer, key, iv);
    return new TextDecoder().decode(decrypted);
}
