import { apply, initialState, uid } from './engine';
import type { Command, State } from './model';
let connection: Promise<IDBDatabase> | undefined;
const listeners = new Set<() => void>();
let channel: BroadcastChannel | undefined;
function open(): Promise<IDBDatabase> {
  if (!connection)
    connection = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('此瀏覽器不支援本機資料庫，無法建立交易。'));
        return;
      }
      const request = indexedDB.open('lunjian-sportsbook-demo', 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('state');
      };
      request.onerror = () => reject(new Error('無法開啟本機資料庫，請檢查瀏覽器儲存設定。'));
      request.onblocked = () => reject(new Error('請關閉舊版試玩分頁後重新整理。'));
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          connection = undefined;
        };
        resolve(db);
      };
    }).catch((e: unknown) => {
      connection = undefined;
      throw e;
    });
  return connection;
}
async function transaction<T>(mode: IDBTransactionMode, work: (s: State) => T): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('state', mode),
      store = tx.objectStore('state'),
      get = store.get('root');
    let result: T;
    let failure: unknown;
    get.onsuccess = () => {
      try {
        const state: State = get.result ? structuredClone(get.result as State) : initialState();
        if (state.version !== 1) throw new Error('資料版本不符，請勿覆寫既有紀錄。');
        result = work(state);
        if (mode === 'readwrite') store.put(state, 'root');
      } catch (e) {
        failure = e;
        tx.abort();
      }
    };
    tx.oncomplete = () => resolve(result);
    tx.onabort = () =>
      reject(failure instanceof Error ? failure : new Error('本機儲存失敗；本次操作未成立。'));
    tx.onerror = () => {
      failure ??= new Error('本機儲存失敗；請檢查可用空間。');
    };
  });
}
export const readState = () => transaction('readonly', (s) => s);
function notifyListeners() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* A view notification cannot undo a committed transaction. */
    }
  });
}
export async function execute(command: Command, key = uid()): Promise<string> {
  const result = await transaction('readwrite', (s) => apply(s, command, key));
  notifyListeners();
  try {
    channel?.postMessage('changed');
  } catch {
    /* Refresh reads the committed state. */
  }
  return result;
}
export function subscribe(fn: () => void) {
  listeners.add(fn);
  if (!channel && typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel('lunjian-sportsbook-demo');
    channel.onmessage = notifyListeners;
  }
  return () => {
    listeners.delete(fn);
    if (!listeners.size) {
      channel?.close();
      channel = undefined;
    }
  };
}
const hex = (data: ArrayBuffer) =>
  Array.from(new Uint8Array(data), (b) => b.toString(16).padStart(2, '0')).join('');
async function passwordHash(password: string, salt: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  return hex(
    await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 210000, hash: 'SHA-256' },
      key,
      256,
    ),
  );
}
export async function register(login: string, password: string, name: string) {
  if (password.length < 8) throw new Error('密碼至少 8 字，請勿使用真實服務的密碼。');
  const salt = uid(),
    hash = await passwordHash(password, salt);
  return execute({
    type: 'register',
    member: { id: uid(), login, name, salt, hash, discord: '', balance: '0' },
  });
}
export async function loginLocal(login: string, password: string) {
  const state = await readState(),
    m = state.members.find((m) => m.login === login.trim().toLowerCase() && !!m.login);
  if (!m || (await passwordHash(password, m.salt)) !== m.hash)
    throw new Error('帳號或密碼不正確。');
  return m.id;
}
export async function discordLocal(identity: string, name: string) {
  const discord = identity.trim().toLowerCase();
  if (!discord || discord.length > 80) throw new Error('請輸入 1–80 字的模擬 Discord 身分。');
  const state = await readState(),
    m = state.members.find((m) => m.discord === discord);
  if (m) return m.id;
  return execute({
    type: 'register',
    member: {
      id: uid(),
      login: '',
      name: name.trim() || discord,
      salt: '',
      hash: '',
      discord,
      balance: '0',
    },
  });
}
export function session() {
  try {
    return sessionStorage.getItem('lunjian-sportsbook-user') || '';
  } catch {
    return '';
  }
}
export function saveSession(id: string) {
  try {
    if (id) sessionStorage.setItem('lunjian-sportsbook-user', id);
    else sessionStorage.removeItem('lunjian-sportsbook-user');
    window.dispatchEvent(new Event('lunjian:sports-session'));
  } catch {
    throw new Error('無法儲存登入狀態，請檢查瀏覽器設定。');
  }
}
