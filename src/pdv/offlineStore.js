const DB_NAME = 'cesca-pdv-offline';
const DB_VERSION = 1;
const CHANGE_EVENT = 'cesca-pdv-offline-change';

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('Transação local cancelada'));
  });
}

let dbPromise;
function openDb() {
  if (!('indexedDB' in window)) return Promise.reject(new Error('Este navegador não oferece armazenamento offline'));
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
        if (!db.objectStoreNames.contains('context')) db.createObjectStore('context');
        if (!db.objectStoreNames.contains('outbox')) {
          const store = db.createObjectStore('outbox', { keyPath: 'requestId' });
          store.createIndex('createdAt', 'createdAt');
        }
        if (!db.objectStoreNames.contains('promotionEvents')) {
          const store = db.createObjectStore('promotionEvents', { keyPath: 'eventId' });
          store.createIndex('createdAt', 'createdAt');
        }
        if (!db.objectStoreNames.contains('receipts')) {
          const store = db.createObjectStore('receipts', { keyPath: 'requestId' });
          store.createIndex('syncedAt', 'syncedAt');
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return dbPromise;
}

function notifyChange() {
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function subscribeOfflineChanges(listener) {
  window.addEventListener(CHANGE_EVENT, listener);
  return () => window.removeEventListener(CHANGE_EVENT, listener);
}

async function getAll(storeName) {
  const db = await openDb();
  return requestResult(db.transaction(storeName, 'readonly').objectStore(storeName).getAll());
}

export async function getDeviceId() {
  const db = await openDb();
  const transaction = db.transaction('meta', 'readwrite');
  const store = transaction.objectStore('meta');
  let deviceId = await requestResult(store.get('deviceId'));
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    store.put(deviceId, 'deviceId');
    store.put(`PDV-${deviceId.slice(0, 8)}`, 'deviceName');
  }
  await transactionDone(transaction);
  return deviceId;
}

export async function getDeviceName() {
  const db = await openDb();
  const transaction = db.transaction('meta', 'readonly');
  return requestResult(transaction.objectStore('meta').get('deviceName'));
}

export async function setBackgroundSyncToken(token) {
  if (!token) return;
  const db = await openDb();
  const transaction = db.transaction('meta', 'readwrite');
  transaction.objectStore('meta').put(token, 'authToken');
  await transactionDone(transaction);
}

export async function cacheContext(context) {
  if (!context) return;
  const db = await openDb();
  const transaction = db.transaction('context', 'readwrite');
  transaction.objectStore('context').put({
    ...context,
    cachedAt: new Date().toISOString(),
  }, 'current');
  await transactionDone(transaction);
  notifyChange();
}

export async function getCachedContext() {
  const db = await openDb();
  const transaction = db.transaction('context', 'readonly');
  return requestResult(transaction.objectStore('context').get('current'));
}

export async function setLocalPromotion(produtoId, ativa, userId) {
  const db = await openDb();
  const transaction = db.transaction(['context', 'promotionEvents'], 'readwrite');
  const contextStore = transaction.objectStore('context');
  const context = await requestResult(contextStore.get('current'));
  if (!context?.caixa?.id) throw new Error('Caixa offline não disponível');
  context.produtos = context.produtos.map(product => (
    product.id === produtoId ? { ...product, promocao_ativa: ativa, promocao_local: true } : product
  ));
  contextStore.put(context, 'current');
  const event = {
    eventId: crypto.randomUUID(),
    caixaId: context.caixa.id,
    produtoId,
    ativa,
    vendedorId: userId,
    registradaEm: new Date().toISOString(),
    createdAt: Date.now(),
  };
  transaction.objectStore('promotionEvents').put(event);
  await transactionDone(transaction);
  notifyChange();
  return context;
}

export async function enqueueSale(sale) {
  const db = await openDb();
  const transaction = db.transaction(['outbox', 'context'], 'readwrite');
  const contextStore = transaction.objectStore('context');
  const context = await requestResult(contextStore.get('current'));
  if (!context?.caixa?.id || context.caixa.id !== sale.caixaId) {
    throw new Error('O caixa salvo no aparelho não corresponde a esta venda');
  }
  const record = {
    ...sale,
    status: 'pendente',
    createdAt: Date.now(),
    attempts: 0,
    lastError: null,
  };
  transaction.objectStore('outbox').add(record);
  context.produtos = context.produtos.map(product => {
    const item = sale.itens.find(candidate => candidate.produtoId === product.id);
    if (!item || product.estoque_disponivel == null) return product;
    return { ...product, estoque_disponivel: Number(product.estoque_disponivel) - Number(item.quantidade) };
  });
  contextStore.put(context, 'current');
  await transactionDone(transaction);
  notifyChange();
  return record;
}

export async function listPendingSales() {
  const records = await getAll('outbox');
  return records.sort((a, b) => a.createdAt - b.createdAt);
}

export async function countPendingSales() {
  const db = await openDb();
  return requestResult(db.transaction('outbox', 'readonly').objectStore('outbox').count());
}

export async function markSaleAttempt(requestId, error = null) {
  const db = await openDb();
  const transaction = db.transaction('outbox', 'readwrite');
  const store = transaction.objectStore('outbox');
  const record = await requestResult(store.get(requestId));
  if (record) {
    store.put({ ...record, attempts: (record.attempts || 0) + 1, lastError: error, lastAttemptAt: Date.now() });
  }
  await transactionDone(transaction);
  notifyChange();
}

export async function acknowledgeSale(requestId, receipt) {
  const db = await openDb();
  const transaction = db.transaction(['outbox', 'receipts'], 'readwrite');
  transaction.objectStore('outbox').delete(requestId);
  transaction.objectStore('receipts').put({
    requestId,
    vendaId: receipt.vendaId,
    status: receipt.status,
    syncedAt: Date.now(),
  });
  await transactionDone(transaction);
  notifyChange();
}

export async function undoPendingSale(requestId, reason) {
  const db = await openDb();
  const transaction = db.transaction(['outbox', 'context', 'receipts'], 'readwrite');
  const outbox = transaction.objectStore('outbox');
  const record = await requestResult(outbox.get(requestId));
  if (!record) throw new Error('Venda pendente não encontrada');
  const contextStore = transaction.objectStore('context');
  const context = await requestResult(contextStore.get('current'));
  if (context?.caixa?.id === record.caixaId) {
    context.produtos = context.produtos.map(product => {
      const item = record.itens.find(candidate => candidate.produtoId === product.id);
      if (!item || product.estoque_disponivel == null) return product;
      return { ...product, estoque_disponivel: Number(product.estoque_disponivel) + Number(item.quantidade) };
    });
    contextStore.put(context, 'current');
  }
  outbox.delete(requestId);
  transaction.objectStore('receipts').put({
    requestId,
    status: 'desfeita_localmente',
    reason,
    syncedAt: Date.now(),
  });
  await transactionDone(transaction);
  notifyChange();
  return { ...record, undoReason: reason };
}

export async function listPromotionEvents() {
  const records = await getAll('promotionEvents');
  return records.sort((a, b) => a.createdAt - b.createdAt);
}

export async function acknowledgePromotionEvents(eventIds) {
  if (!eventIds.length) return;
  const db = await openDb();
  const transaction = db.transaction('promotionEvents', 'readwrite');
  const store = transaction.objectStore('promotionEvents');
  eventIds.forEach(id => store.delete(id));
  await transactionDone(transaction);
  notifyChange();
}

export async function replaceCachedContextPreservingPending(serverContext) {
  const pending = await listPendingSales();
  const next = {
    ...serverContext,
    produtos: (serverContext.produtos || []).map(product => {
      let updated = product;
      const pendingQuantity = pending
        .filter(sale => sale.caixaId === serverContext.caixa?.id)
        .flatMap(sale => sale.itens)
        .filter(item => item.produtoId === product.id)
        .reduce((sum, item) => sum + Number(item.quantidade), 0);
      if (updated.estoque_disponivel != null) {
        updated = { ...updated, estoque_disponivel: Number(updated.estoque_disponivel) - pendingQuantity };
      }
      return updated;
    }),
  };
  await cacheContext(next);
  return next;
}

export async function purgeOldReceipts(maxAgeDays = 7) {
  const db = await openDb();
  const transaction = db.transaction('receipts', 'readwrite');
  const store = transaction.objectStore('receipts');
  const records = await requestResult(store.getAll());
  const threshold = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  records.filter(record => record.syncedAt < threshold).forEach(record => store.delete(record.requestId));
  await transactionDone(transaction);
}
