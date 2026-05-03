// lib/ticket/json-signer.ts
// Uses @noble/ed25519 v3 async API. SHA-256 via Node built-in crypto (no extra deps).
import * as ed from '@noble/ed25519';
import { createHash } from 'crypto';
import type { CruzarTicketV1, SignedTicket } from './types';

function canonicalize(obj: unknown): string {
  // Deterministic JSON: sorted keys, no whitespace.
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(canonicalize).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalize((obj as Record<string, unknown>)[k])).join(',') + '}';
}

function b64ToBytes(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

function bytesToB64(b: Uint8Array): string {
  return Buffer.from(b).toString('base64');
}

function bytesToHex(b: Uint8Array): string {
  return Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');
}

function sha256Bytes(input: Uint8Array): Uint8Array {
  return new Uint8Array(createHash('sha256').update(input).digest());
}

export async function signTicket(payload: CruzarTicketV1): Promise<SignedTicket> {
  const privB64 = process.env.CRUZAR_TICKET_SIGNING_KEY;
  const keyId = process.env.CRUZAR_TICKET_KEY_ID;
  if (!privB64 || !keyId) {
    throw new Error('CRUZAR_TICKET_SIGNING_KEY or CRUZAR_TICKET_KEY_ID missing from env');
  }
  const priv = b64ToBytes(privB64);
  const canonical = canonicalize(payload);
  const hash = sha256Bytes(new TextEncoder().encode(canonical));
  const sigBytes = await ed.signAsync(hash, priv);

  return {
    payload_canonical: canonical,
    payload,
    content_hash: bytesToHex(hash),
    signature_b64: bytesToB64(sigBytes),
    signing_key_id: keyId,
  };
}

export async function verifyTicket(signed: SignedTicket, publicKeyB64?: string): Promise<{ valid: boolean; reason?: string }> {
  const pubB64 = publicKeyB64 ?? process.env.CRUZAR_TICKET_PUBLIC_KEY;
  if (!pubB64) return { valid: false, reason: 'no public key available' };

  const reCanonical = canonicalize(signed.payload);
  if (reCanonical !== signed.payload_canonical) {
    return { valid: false, reason: 'payload not in canonical form' };
  }
  const hash = sha256Bytes(new TextEncoder().encode(reCanonical));
  const hashHex = bytesToHex(hash);
  if (hashHex !== signed.content_hash) {
    return { valid: false, reason: 'content_hash mismatch (payload tampered)' };
  }
  try {
    const ok = await ed.verifyAsync(b64ToBytes(signed.signature_b64), hash, b64ToBytes(pubB64));
    return ok ? { valid: true } : { valid: false, reason: 'signature does not verify' };
  } catch (e) {
    return { valid: false, reason: `verify threw: ${(e as Error).message}` };
  }
}
