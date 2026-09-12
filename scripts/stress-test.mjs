/**
 * Velicham Tharaam — realtime fan-out stress test
 *
 * Simulates N citizen app-clients (each with the SAME Firestore listeners the
 * app uses: reports, activities, torchEvents, system/torchSignal) and measures
 * how reliably a torch event broadcast reaches all N listeners.
 *
 * Usage:
 *   node scripts/stress-test.mjs --users 30 --events 5
 *
 * Env vars (from .env / config.ts) are used for the live project.
 */
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  connectFirestoreEmulator,
} from 'firebase/firestore';

const args = process.argv.slice(2);
const arg = (name, def) => {
  const idx = args.indexOf(name);
  return idx >= 0 ? Number(args[idx + 1]) : def;
};
const USERS = arg('--users', 10);
const EVENTS = arg('--events', 5);
const SHARED = args.includes('--shared');
const TIMEOUT_MS = 15000;
const RUN_ID = 'stress_' + Date.now();
const TEST_EMAIL = `stress_${RUN_ID}@velichamtest.in`;
const TEST_PASSWORD = 'VelichamStress!2026';

async function ensureAuthAccount(auth) {
  try {
    await signInWithEmailAndPassword(auth, TEST_EMAIL, TEST_PASSWORD);
  } catch (e) {
    if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential') {
      await createUserWithEmailAndPassword(auth, TEST_EMAIL, TEST_PASSWORD);
    } else {
      throw e;
    }
  }
}

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || 'AIzaSyAnoDdt5S8ZBXa7CsQ_vDoeyfz9e2LS8VU',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || 'velicham-tharaam-ad249.firebaseapp.com',
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'velicham-tharaam-ad249',
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || 'velicham-tharaam-ad249.firebasestorage.app',
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1001442811628',
  appId: process.env.VITE_FIREBASE_APP_ID || '1:1001442811628:web:b656fec5d3ce52e2fc0fc9',
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-1ER0DQ4MYR',
  databaseURL: process.env.VITE_FIREBASE_DATABASE_URL || 'https://velicham-tharaam-ad249-default-rtdb.firebaseio.com',
};

const clients = [];
const results = {
  USERS,
  EVENTS,
  attached: 0,
  broadcast: [],
  received: 0,
  missing: 0,
  failures: [],
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function createClient(idx) {
  const app = initializeApp(firebaseConfig, `client_${RUN_ID}_${idx}`);
  const auth = getAuth(app);
  await ensureAuthAccount(auth);
  const db = getFirestore(app);
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    connectFirestoreEmulator(db, '127.0.0.1', Number(process.env.FIRESTORE_PORT) || 8080);
  }

  const received = new Set();
  const seenAt = new Map();
  let started = false;
  const onTorchEvent = (snap) => {
    snap.docChanges().forEach((change) => {
      if (change.type === 'added') {
        const ev = change.doc.data();
        if (ev && ev.runId === RUN_ID) {
          received.add(ev.id);
          seenAt.set(ev.id, Date.now());
        }
      }
    });
  };

  // Exactly the listeners the production app attaches
  let unsubs = [];
  await new Promise((resolve) => {
    unsubs = [
      onSnapshot(collection(db, 'torchEvents'), (snap) => {
        onTorchEvent(snap);
        if (!started) { started = true; resolve(); }
      }),
      onSnapshot(collection(db, 'reports'), () => {}),
      onSnapshot(collection(db, 'activities'), () => {}),
      onSnapshot(doc(db, 'system', 'torchSignal'), () => {}),
    ];
  });

  return { idx, db, received, seenAt, unsubs };
}

async function attachSharedSession() {
  // ONE signed-in app + USERS independent torchEvents listeners.
  // Each listener is charged its own Firestore read per delivered event —
  // this isolates the realtime fan-out capacity without hammering Auth.
  const app = initializeApp(firebaseConfig, `shared_${RUN_ID}`);
  const auth = getAuth(app);
  await ensureAuthAccount(auth);
  const db = getFirestore(app);
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    connectFirestoreEmulator(db, '127.0.0.1', Number(process.env.FIRESTORE_PORT) || 8080);
  }

  let attachFail = 0;
  for (let i = 0; i < USERS; i++) {
    try {
      const received = new Set();
      const seenAt = new Map();
      await new Promise((resolve, reject) => {
        let settled = false;
        const unsub = onSnapshot(
          query(collection(db, 'torchEvents'), where('runId', '==', RUN_ID)),
          (snap) => {
          snap.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const ev = change.doc.data();
              if (ev && ev.runId === RUN_ID) {
                if (!received.has(ev.id)) {
                  received.add(ev.id);
                  seenAt.set(ev.id, Date.now());
                }
              }
            }
          });
          if (!settled) { settled = true; resolve(); }
        }, (err) => { if (!settled) { settled = true; reject(err); } });
        clients.push({ db, received, seenAt, unsubs: [unsub] });
        results.attached++;
      });
    } catch (e) {
      attachFail++;
      console.log(`  listener ${i} attach failed: ${e?.message || e}`);
      if (attachFail >= Math.max(5, USERS / 5)) throw new Error('Too many attach failures');
    }
  }
  await sleep(500);
}

async function attachAll() {
  const max = USERS;
  let failed = 0;
  for (let i = 0; i < max; i++) {
    try {
      const c = await createClient(i);
      clients.push(c);
      results.attached++;
    } catch (e) {
      failed++;
      console.warn(`  client ${i} attach failed: ${e.message}`);
      if (failed >= Math.max(3, USERS / 4)) throw new Error('Too many attach failures');
    }
  }
  await sleep(500); // settle
}

async function broadcast() {
  const db = clients[0].db;
  for (let e = 0; e < EVENTS; e++) {
    const eventId = `${RUN_ID}_event_${e}`;
    const t0 = Date.now();
    await setDoc(doc(db, 'torchEvents', eventId), {
      id: eventId,
      communityId: 'ALL',
      action: 'BLINK_THEN_ON',
      pattern: '3_BLINKS',
      createdAt: Date.now(),
      createdBy: 'LOADTEST',
      runId: RUN_ID,
    });

    const latencies = [];
    const deadline = t0 + TIMEOUT_MS;
    while (Date.now() < deadline) {
      const missing = clients.filter((c) => !c.received.has(eventId));
      if (missing.length === 0) break;
      await sleep(100);
    }
    for (const c of clients) {
      if (c.received.has(eventId)) latencies.push(c.seenAt.get(eventId) - t0);
      else results.missing++;
    }
    const missingNow = clients.filter((c) => !c.received.has(eventId)).length;
    results.broadcast.push({
      event: eventId,
      delivered: USERS - missingNow,
      latencyMs: latencies.length ? Math.round(latencies.sort((a, b) => a - b)[Math.floor(latencies.length / 2)]) : null,
    });
    console.log(`  event ${e + 1}/${EVENTS}: delivered ${USERS - missingNow}/${USERS}`);
  }
}

async function cleanup() {
  const db = clients?.[0]?.db || null;
  if (!db) return;
  for (const c of clients) {
    try { c.unsubs.forEach((u) => u()); } catch (e) {}
  }
  for (let e = 0; e < EVENTS; e++) {
    try { await deleteDoc(doc(db, 'torchEvents', `${RUN_ID}_event_${e}`)); } catch (e) {}
  }
}

process.on('SIGINT', async () => { await cleanup(); process.exit(130); });

console.log(`[stress] ${USERS} simulated users, ${EVENTS} broadcast events, runId=${RUN_ID}`);
console.log(`  mode: ${SHARED ? 'shared-session (fan-out)' : 'per-client (auth-each)'}`);
console.log('  attaching clients...');
if (SHARED) {
  await attachSharedSession();
} else {
  await attachAll();
}
console.log(`  attached ${results.attached}/${USERS}`);
console.log('  broadcasting events...');
await broadcast();
await cleanup();

// Summary
const deliveredTotal = results.broadcast.reduce((a, b) => a + b.delivered, 0);
const expectedTotal = results.broadcast.reduce((a, b) => a + USERS, 0);
const medians = results.broadcast.map((b) => b.latencyMs).filter((l) => l != null);
const p50 = medians.length ? Math.round(medians.sort((a, b) => a - b)[Math.floor(medians.length / 2)]) : null;

console.log('\n========== SUMMARY ==========');
console.log(`attached clients : ${results.attached}`);
console.log(`events broadcast  : ${results.broadcast.length}`);
console.log(`delivery          : ${deliveredTotal}/${expectedTotal} (${(deliveredTotal / expectedTotal * 100).toFixed(2)}%)`);
console.log(`missing           : ${results.missing}`);
console.log(`median latency    : ${p50} ms`);
console.log('=============================\n');

const perEventReads = results.attached; // 1 delivered doc read per connected listener
console.log(`Cost model (per broadcast event with ${results.attached} connected phones): ${perEventReads} Firestore reads.`);
process.exit(0);