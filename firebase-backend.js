// オンライン対戦のつなぎ先(GitHub Pages 用):Firestore + 匿名ログイン
// ゲーム本体(index.html)が claude.ai の中で使うのと同じ小さな形にそろえてある:
//   db.doc(path).get / set / delete / onSnapshot
//   db.collection(path).where(...).limit(n).onSnapshot(...)
//   db.runTx(path, update)  … 1手ごとの読み書きをトランザクションでまとめる
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore, doc, getDoc, setDoc, deleteDoc, onSnapshot,
  collection, query, where, limit, runTransaction, Timestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const KEEP_MS = 2 * 24 * 3600 * 1000;   // 最後の手から2日たった部屋は TTL で消せる(README 参照)

// Firestore は「配列の中の配列」を保存できないので、部屋の状態はまるごと JSON 文字列で持つ。
// ロビーの一覧とセキュリティルールに使う項目だけ、外に出しておく。
function encode(s) {
  return {
    fmt: Number(s.fmt) || 0,
    code: String(s.code || ''),
    status: String(s.status || ''),
    hostId: String(s.hostId || ''),
    memberIds: (s.players || []).filter(p => !p.cpu).map(p => String(p.id)),
    updatedAt: Number(s.updatedAt) || Date.now(),
    expireAt: Timestamp.fromMillis(Date.now() + KEEP_MS),
    json: JSON.stringify(s),
  };
}
function decode(d) {
  if (!d || typeof d.json !== 'string') return null;
  try { return JSON.parse(d.json); } catch (e) { return null; }
}
function wrap(snap) {
  const v = snap.exists() ? decode(snap.data()) : null;
  return { id: snap.id, exists: v !== null, data: () => v };
}
function fail(e) {
  const c = (e && e.code) || 'unavailable';
  return { code: c === 'resource-exhausted' ? 'quota_exceeded' : c, message: String((e && e.message) || e) };
}

function signIn(auth) {
  // 前回の匿名ユーザーが復元されるのを待ってから、いなければ新しくログインする
  return new Promise((resolve, reject) => {
    let tried = false;
    const off = onAuthStateChanged(auth, user => {
      if (user) { off(); resolve(user.uid); return; }
      if (tried) return;
      tried = true;
      signInAnonymously(auth).catch(e => { off(); reject(e); });
    }, e => { off(); reject(e); });
  });
}

export async function connect() {
  const key = firebaseConfig && firebaseConfig.apiKey;
  if (!key || /ここに/.test(key)) throw { code: 'config-missing' };
  const app = initializeApp(firebaseConfig);
  const uid = await signIn(getAuth(app));
  const fs = getFirestore(app);

  const db = {
    doc(path) {
      const r = doc(fs, path);
      return {
        path, id: r.id,
        async get() { try { return wrap(await getDoc(r)); } catch (e) { throw fail(e); } },
        async set(s) { try { await setDoc(r, encode(s)); } catch (e) { throw fail(e); } },
        async delete() { try { await deleteDoc(r); } catch (e) { throw fail(e); } },
        onSnapshot(next, onErr) {
          return onSnapshot(r, x => next(wrap(x)), e => { if (onErr) onErr(fail(e)); });
        },
      };
    },
    collection(path) {
      const make = cons => ({
        where: (f, op, v) => make([...cons, where(f, op, v)]),
        limit: n => make([...cons, limit(n)]),
        onSnapshot(next, onErr) {
          return onSnapshot(query(collection(fs, path), ...cons), q => {
            const docs = q.docs.map(wrap).filter(x => x.exists);
            next({ docs, size: docs.length, empty: !docs.length });
          }, e => { if (onErr) onErr(fail(e)); });
        },
      });
      return make([]);
    },
    async runTx(path, update) {
      const r = doc(fs, path);
      try {
        return await runTransaction(fs, async tx => {
          const snap = await tx.get(r);
          const cur = snap.exists() ? decode(snap.data()) : null;
          if (!cur) return false;
          const next = update(structuredClone(cur));
          if (!next) return false;
          tx.set(r, encode(next));
          return true;
        });
      } catch (e) { throw fail(e); }
    },
  };
  return { db, uid };
}
