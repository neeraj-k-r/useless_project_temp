import { randomBytes } from 'node:crypto';

const API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyAnoDdt5S8ZBXa7CsQ_vDoeyfz9e2LS8VU';
const PROJECT = 'velicham-tharaam-ad249';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

const email = `dbg_${randomBytes(4).toString('hex')}@velichamtest.in`;
const password = `DbgPass!${randomBytes(4).toString('hex')}`;

const signUp = await fetch(
  `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true })
  }
);
const auth = await signUp.json();
if (!auth.idToken) {
  console.error('SIGNUP FAILED:', JSON.stringify(auth).slice(0, 500));
  process.exit(1);
}
console.log(`probe account: ${email}`);

async function listDocs(collection, mapFn) {
  try {
    const res = await fetch(`${BASE}/${collection}?pageSize=500`, {
      headers: { Authorization: `Bearer ${auth.idToken}` }
    });
    const data = await res.json();
    if (!data.documents) return [];
    return data.documents.map(mapFn);
  } catch (e) {
    return [{ error: String(e) }];
  }
}

const short = (s) => (s || '').toString().slice(0, 24);

const communities = await listDocs('communities', (d) => {
  const f = d.fields || {};
  return {
    id: short(f.id?.stringValue),
    name: short(f.name?.stringValue),
    district: short(f.district?.stringValue),
    pincode: short(f.pincode?.stringValue),
    memberCount: f.memberCount?.integerValue,
    status: short(f.status?.stringValue),
    lat: f.lat?.doubleValue ?? f.lat?.integerValue
  };
});

const reports = await listDocs('reports', (d) => {
  const f = d.fields || {};
  return {
    id: short(d.name.split('/').pop()),
    userId: short(f.userId?.stringValue),
    communityId: short(f.communityId?.stringValue),
    type: short(f.type?.stringValue),
    createdAt: f.createdAt?.integerValue
  };
});

const users = await listDocs('users', (d) => {
  const f = d.fields || {};
  return {
    uid: short(f.uid?.stringValue),
    email: short(f.email?.stringValue),
    communityId: short(f.communityId?.stringValue),
    localityName: short(f.localityName?.stringValue),
    role: short(f.role?.stringValue),
    lastSeen: f.lastSeen?.integerValue
  };
});

const torch = await listDocs('torchEvents', (d) => d.name.split('/').pop());

console.log('\n=== COMMUNITIES (' + communities.length + ') ===');
communities.forEach((c) => console.log(JSON.stringify(c)));
console.log('\n=== REPORTS (' + reports.length + ') ===');
reports.forEach((r) => console.log(JSON.stringify(r)));
console.log('\n=== USERS (' + users.length + ') ===');
users.forEach((u) => console.log(JSON.stringify(u)));
console.log('\n=== TORCH EVENTS (' + torch.length + ') ===');
torch.forEach((t) => console.log(t));