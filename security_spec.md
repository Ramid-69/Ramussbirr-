# Security Specification — CBEBirr Plus Owner Device Control

## 1. Data Invariants
1. **Strict Zero-Trust Default**: Every path under `/databases/{database}/documents` defaults to `allow read, write: if false;`.
2. **Verified Admin & Ownership Integrity**:
   - Client reads and writes require verified authentication (`request.auth != null && request.auth.token.email_verified == true`).
   - Only the bootstrapped owner (`ramidfozi6969@gmail.com` with verified email) or explicitly registered `/admins/{uid}` documents may administer `/devices`, `/device_transactions`, `/owner_notifications`, and `/owner_config`.
   - Regular users cannot elevate themselves to `admins` or forge `ownerId`.
3. **Referential & ID Integrity**:
   - Every document ID (`userId`, `deviceId`, `txId`, `notifId`, `configId`) must match `^[a-zA-Z0-9_\-]+$` and be <= 128 characters.
   - Every `DeviceTransaction` created via client SDK must reference an existing `/devices/$(incoming().deviceId)` document (`exists(...)`).
   - Every single `create` enforces exact required/allowed key sets (`keys().hasAll(...) && keys().hasOnly(...)`) preventing shadow fields.
   - Every `update` wraps validation with `isValid[Entity](incoming())`, validates `affectedKeys().hasOnly(...)`, preserves `ownerId` and `createdAt`, and mandates `updatedAt == request.time`.
4. **Temporal Integrity**: `createdAt` on create and `updatedAt` on update must equal `request.time`.
5. **No Blanket List Scraping**: `allow list` never uses `get()` or `exists()` and strictly evaluates `resource.data.ownerId == request.auth.uid || (request.auth.token.email == 'ramidfozi6969@gmail.com' && request.auth.token.email_verified == true)`.
6. **Notification & Transaction Immutability**: Once logged, `DeviceTransaction` and `OwnerNotification` records cannot be altered by non-admins; `OwnerNotification` has bounded `durationSeconds` (`>= 1 && <= 86400`).

---

## 2. The "Dirty Dozen" Attack Payloads
1. **Unauthenticated Device Write**: `setDoc(/devices/dev1, {...})` with `auth = null` -> `PERMISSION_DENIED`.
2. **Unverified Email Admin Spoof**: `auth = { uid: 'x', token: { email: 'ramidfozi6969@gmail.com', email_verified: false } }` writing `/admins/x` -> `PERMISSION_DENIED`.
3. **Self-Privilege Escalation**: Non-admin user creating `/admins/hackerUid` with `{ role: 'admin', ... }` -> `PERMISSION_DENIED`.
4. **Shadow Field Injection on Device**: Creating `/devices/dev_1` with valid fields plus ghost key `isSuperUser: true` -> `PERMISSION_DENIED`.
5. **1MB Resource Poisoning in ID**: Targeting `/devices/${'a'.repeat(150)}` or invalid chars `/devices/bad$id` -> `PERMISSION_DENIED`.
6. **1MB String Poisoning in Message**: Updating `owner_notifications` with `message.size() > 500` -> `PERMISSION_DENIED`.
7. **Orphaned Transaction Injection**: Creating `/device_transactions/tx1` with non-existent `deviceId: 'ghost_device'` -> `PERMISSION_DENIED`.
8. **Fake Client Timestamp**: Creating `/devices/dev_2` with backdated `createdAt: new Date('2020-01-01')` instead of `serverTimestamp()` -> `PERMISSION_DENIED`.
9. **Immutable Field Tampering**: Updating `/devices/dev_1` changing `ownerId` or `createdAt` -> `PERMISSION_DENIED`.
10. **Value Type Poisoning on Whitelisted Update Key**: Updating `/owner_config/global` setting `globalLocked: "yes"` instead of boolean -> `PERMISSION_DENIED`.
11. **Non-Owner PII Read**: Authenticated non-admin user reading another user's `/devices/dev_other` (which holds `phoneNumber`, `userAccount`, `balance`) -> `PERMISSION_DENIED`.
12. **Blanket List Query Scraping**: Authenticated non-admin querying `collection('device_transactions')` without matching `ownerId == auth.uid` -> `PERMISSION_DENIED`.

---

## 3. Test Runner (`firestore.rules.test.ts`)
```ts
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, getDocs, collection, serverTimestamp, query, where } from 'firebase/firestore';
import fs from 'node:fs';

let testEnv: RulesTestEnvironment;

const OWNER_EMAIL = 'ramidfozi6969@gmail.com';
const OWNER_UID = 'owner-uid-1';
const OTHER_UID = 'attacker-uid-2';

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'gen-lang-client-0298902096',
    firestore: {
      rules: fs.readFileSync('firestore.rules', 'utf8'),
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

test('Dirty Dozen #1: Unauthenticated write fails', async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(
    setDoc(doc(db, 'owner_config', 'global'), {
      configId: 'global',
      globalLocked: true,
      globalLockMessage: 'Locked',
      updatedBy: 'system',
      ownerId: OWNER_UID,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );
});

test('Dirty Dozen #2: Unverified admin email spoof fails', async () => {
  const db = testEnv.authenticatedContext('spoof', { email: OWNER_EMAIL, email_verified: false }).firestore();
  await assertFails(
    setDoc(doc(db, 'admins', 'spoof'), {
      uid: 'spoof',
      email: OWNER_EMAIL,
      role: 'admin',
      ownerId: 'spoof',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );
});

test('Dirty Dozen #3: Self-privilege escalation fails', async () => {
  const db = testEnv.authenticatedContext(OTHER_UID, { email: 'user@example.com', email_verified: true }).firestore();
  await assertFails(
    setDoc(doc(db, 'admins', OTHER_UID), {
      uid: OTHER_UID,
      email: 'user@example.com',
      role: 'admin',
      ownerId: OTHER_UID,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );
});

test('Dirty Dozen #4: Shadow ghost field rejected', async () => {
  const db = testEnv.authenticatedContext(OWNER_UID, { email: OWNER_EMAIL, email_verified: true }).firestore();
  await assertFails(
    setDoc(doc(db, 'devices', 'dev_1'), {
      deviceId: 'dev_1',
      deviceName: 'Pixel 8',
      platform: 'android-apk',
      appVersion: '1.0.86',
      userName: 'Aymen',
      phoneNumber: '0959754788',
      userAccount: '0959754788',
      balance: 1000,
      isLocked: false,
      lockReason: '',
      lastSeenAtMs: Date.now(),
      ownerId: OWNER_UID,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isSuperUser: true,
    })
  );
});

test('Dirty Dozen #5: Oversized / invalid ID rejected', async () => {
  const db = testEnv.authenticatedContext(OWNER_UID, { email: OWNER_EMAIL, email_verified: true }).firestore();
  await assertFails(
    setDoc(doc(db, 'devices', 'bad$id'), {
      deviceId: 'bad$id',
      deviceName: 'Pixel 8',
      platform: 'android-apk',
      appVersion: '1.0.86',
      userName: 'Aymen',
      phoneNumber: '0959754788',
      userAccount: '0959754788',
      balance: 1000,
      isLocked: false,
      lockReason: '',
      lastSeenAtMs: Date.now(),
      ownerId: OWNER_UID,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );
});

test('Dirty Dozen #6: Notification message > 500 chars rejected', async () => {
  const db = testEnv.authenticatedContext(OWNER_UID, { email: OWNER_EMAIL, email_verified: true }).firestore();
  await assertFails(
    setDoc(doc(db, 'owner_notifications', 'notif_1'), {
      notifId: 'notif_1',
      targetDeviceId: 'all',
      title: 'Alert',
      message: 'x'.repeat(501),
      durationSeconds: 30,
      sentBy: 'telegram',
      ownerId: OWNER_UID,
      createdAtMs: Date.now(),
      expiresAtMs: Date.now() + 30000,
      createdAt: serverTimestamp(),
    })
  );
});

test('Dirty Dozen #7: Orphaned transaction without existing device fails', async () => {
  const db = testEnv.authenticatedContext(OWNER_UID, { email: OWNER_EMAIL, email_verified: true }).firestore();
  await assertFails(
    setDoc(doc(db, 'device_transactions', 'tx_orphan'), {
      txId: 'tx_orphan',
      deviceId: 'non_existent_dev',
      deviceName: 'Ghost',
      senderName: 'Test',
      senderPhone: '0911',
      senderAccount: '0911',
      title: 'Send Money',
      txType: 'debit',
      amount: 50,
      totalDeducted: 50,
      balanceAfter: 100,
      recipientName: 'Rec',
      recipientAccount: '1000',
      destBank: 'CBE',
      transferLabel: 'CBE',
      ref: 'FT1234',
      reason: 'Transfer',
      status: 'Completed',
      ownerId: OWNER_UID,
      createdAtMs: Date.now(),
      createdAt: serverTimestamp(),
    })
  );
});

test('Dirty Dozen #8: Client-forged timestamp fails', async () => {
  const db = testEnv.authenticatedContext(OWNER_UID, { email: OWNER_EMAIL, email_verified: true }).firestore();
  await assertFails(
    setDoc(doc(db, 'owner_config', 'global'), {
      configId: 'global',
      globalLocked: false,
      globalLockMessage: '',
      updatedBy: 'app_0069',
      ownerId: OWNER_UID,
      createdAt: new Date('2020-01-01T00:00:00Z'),
      updatedAt: serverTimestamp(),
    })
  );
});

test('Dirty Dozen #9 & #10: Immutable field tampering and invalid value type rejected', async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'owner_config', 'global'), {
      configId: 'global',
      globalLocked: false,
      globalLockMessage: '',
      updatedBy: 'system',
      ownerId: OWNER_UID,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
  const db = testEnv.authenticatedContext(OWNER_UID, { email: OWNER_EMAIL, email_verified: true }).firestore();
  await assertFails(
    updateDoc(doc(db, 'owner_config', 'global'), {
      ownerId: OTHER_UID,
      updatedAt: serverTimestamp(),
    })
  );
  await assertFails(
    updateDoc(doc(db, 'owner_config', 'global'), {
      globalLocked: 'true' as unknown as boolean,
      updatedAt: serverTimestamp(),
    })
  );
});

test('Dirty Dozen #11 & #12: Non-owner PII read and blanket list scraping fail', async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'devices', 'dev_victim'), {
      deviceId: 'dev_victim',
      deviceName: 'Samsung A12',
      platform: 'android-apk',
      appVersion: '1.0.86',
      userName: 'Victim User',
      phoneNumber: '0959754788',
      userAccount: '0959754788',
      balance: 63535,
      isLocked: false,
      lockReason: '',
      lastSeenAtMs: Date.now(),
      ownerId: OWNER_UID,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
  const attackerDb = testEnv.authenticatedContext(OTHER_UID, { email: 'other@example.com', email_verified: true }).firestore();
  await assertFails(getDoc(doc(attackerDb, 'devices', 'dev_victim')));
  await assertFails(getDocs(collection(attackerDb, 'devices')));
  const ownerDb = testEnv.authenticatedContext(OWNER_UID, { email: OWNER_EMAIL, email_verified: true }).firestore();
  await assertSucceeds(getDocs(query(collection(ownerDb, 'devices'), where('ownerId', '==', OWNER_UID))));
});
```
