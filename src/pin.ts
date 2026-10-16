import { getSetting, setSetting } from './db/repo';

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPin(pin: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  return toHex(await crypto.subtle.digest('SHA-256', data));
}

export const isValidPin = (pin: string) => /^\d{4}$/.test(pin);

export async function hasPin(): Promise<boolean> {
  return (await getSetting<string | null>('pin_hash', null)) !== null;
}

export async function setPin(pin: string): Promise<void> {
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  await setSetting('pin_salt', salt);
  await setSetting('pin_hash', await hashPin(pin, salt));
}

export async function checkPin(pin: string): Promise<boolean> {
  const hash = await getSetting<string | null>('pin_hash', null);
  const salt = await getSetting<string>('pin_salt', '');
  if (!hash) return false;
  return (await hashPin(pin, salt)) === hash;
}
