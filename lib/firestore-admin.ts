import crypto from 'node:crypto';
import firebaseConfig from '../firebase-applet-config.json';

interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

interface CachedToken {
  accessToken: string;
  expiresAtMs: number;
}

let cachedToken: CachedToken | null = null;
let adcUnavailable = false;

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function parseServiceAccountFromEnv(): ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
  if (!raw) return null;
  try {
    const jsonStr = raw.startsWith('{')
      ? raw
      : Buffer.from(raw, 'base64').toString('utf8');
    const parsed = JSON.parse(jsonStr);
    if (parsed?.client_email && parsed?.private_key) {
      return {
        client_email: parsed.client_email,
        private_key: String(parsed.private_key).replace(/\\n/g, '\n'),
        token_uri: parsed.token_uri || 'https://oauth2.googleapis.com/token',
      };
    }
  } catch {
    // ignore malformed env
  }
  return null;
}

async function getAdminAccessToken(): Promise<string | null> {
  if (cachedToken && Date.now() < cachedToken.expiresAtMs - 60_000) {
    return cachedToken.accessToken;
  }

  // 1. Service account JSON (works on Vercel, Cloud Run, anywhere)
  const sa = parseServiceAccountFromEnv();
  if (sa) {
    try {
      const nowSec = Math.floor(Date.now() / 1000);
      const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
      const claimSet = base64UrlEncode(
        JSON.stringify({
          iss: sa.client_email,
          scope: 'https://www.googleapis.com/auth/datastore',
          aud: sa.token_uri || 'https://oauth2.googleapis.com/token',
          iat: nowSec,
          exp: nowSec + 3600,
        })
      );
      const signingInput = `${header}.${claimSet}`;
      const signer = crypto.createSign('RSA-SHA256');
      signer.update(signingInput);
      const signature = base64UrlEncode(signer.sign(sa.private_key));
      const assertion = `${signingInput}.${signature}`;

      const res = await fetch(sa.token_uri || 'https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion,
        }),
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.access_token) {
          cachedToken = {
            accessToken: data.access_token,
            expiresAtMs: Date.now() + ((data.expires_in || 3600) * 1000),
          };
          return cachedToken.accessToken;
        }
      }
    } catch {
      // ignore
    }
  }

  // 2. GCP Metadata ADC token (works automatically inside Cloud Run / AI Studio)
  if (!adcUnavailable && !process.env.VERCEL) {
    try {
      const res = await fetch(
        'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
        {
          headers: { 'Metadata-Flavor': 'Google' },
          signal: AbortSignal.timeout(800),
        }
      );
      if (res.ok) {
        const data = await res.json();
        if (data?.access_token) {
          cachedToken = {
            accessToken: data.access_token,
            expiresAtMs: Date.now() + ((data.expires_in || 3000) * 1000),
          };
          return cachedToken.accessToken;
        }
      } else {
        adcUnavailable = true;
      }
    } catch {
      adcUnavailable = true;
    }
  }

  return null;
}

export function isFirestoreServerConfigured(): boolean {
  return Boolean(parseServiceAccountFromEnv()) || (!adcUnavailable && !process.env.VERCEL);
}

function getBaseDocumentsUrl(): string {
  const projectId = firebaseConfig.projectId;
  const dbId = firebaseConfig.firestoreDatabaseId || '(default)';
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbId}/documents`;
}

type FsValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { timestampValue: string }
  | { nullValue: null };

function toFsValue(val: unknown): FsValue {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    return Number.isInteger(val) && Math.abs(val) < 9e15
      ? { integerValue: String(val) }
      : { doubleValue: val };
  }
  if (val instanceof Date) return { timestampValue: val.toISOString() };
  return { stringValue: String(val) };
}

function fromFsValue(v: Record<string, unknown> | undefined): unknown {
  if (!v) return undefined;
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  return undefined;
}

function fromFsDocument(doc: { name?: string; fields?: Record<string, Record<string, unknown>> }): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (doc.fields) {
    for (const [k, v] of Object.entries(doc.fields)) {
      out[k] = fromFsValue(v);
    }
  }
  return out;
}

export async function fsListCollection<T extends Record<string, unknown>>(
  collectionName: string,
  pageSize = 200
): Promise<T[] | null> {
  const token = await getAdminAccessToken();
  if (!token) return null;
  try {
    const url = `${getBaseDocumentsUrl()}/${collectionName}?pageSize=${pageSize}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const docs = Array.isArray(data.documents) ? data.documents : [];
    return docs.map((d: any) => fromFsDocument(d) as T);
  } catch {
    return null;
  }
}

export async function fsGetDocument<T extends Record<string, unknown>>(
  collectionName: string,
  docId: string
): Promise<T | null> {
  const token = await getAdminAccessToken();
  if (!token) return null;
  try {
    const url = `${getBaseDocumentsUrl()}/${collectionName}/${encodeURIComponent(docId)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const doc = await res.json();
    return fromFsDocument(doc) as T;
  } catch {
    return null;
  }
}

export async function fsSetDocument(
  collectionName: string,
  docId: string,
  data: Record<string, unknown>
): Promise<boolean> {
  const token = await getAdminAccessToken();
  if (!token) return false;
  try {
    const fields: Record<string, FsValue> = {};
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined) {
        fields[k] = toFsValue(v);
      }
    }
    const url = `${getBaseDocumentsUrl()}/${collectionName}/${encodeURIComponent(docId)}`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
      signal: AbortSignal.timeout(4000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fsDeleteDocument(
  collectionName: string,
  docId: string
): Promise<boolean> {
  const token = await getAdminAccessToken();
  if (!token) return false;
  try {
    const url = `${getBaseDocumentsUrl()}/${collectionName}/${encodeURIComponent(docId)}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(4000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
