const PDV_DB_NAME = 'cesca-pdv-offline';
const PDV_DB_VERSION = 1;

function pdvRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function pdvTransactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('Transação offline cancelada'));
  });
}

function pdvOpenDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(PDV_DB_NAME, PDV_DB_VERSION);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function pdvBroadcast(payload) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  clients.forEach(client => client.postMessage(payload));
}

async function pdvBackgroundSync() {
  const db = await pdvOpenDb();
  const read = db.transaction(['meta', 'outbox', 'promotionEvents'], 'readonly');
  const meta = read.objectStore('meta');
  const [deviceId, deviceName, authToken, pending, allEvents] = await Promise.all([
    pdvRequest(meta.get('deviceId')),
    pdvRequest(meta.get('deviceName')),
    pdvRequest(meta.get('authToken')),
    pdvRequest(read.objectStore('outbox').getAll()),
    pdvRequest(read.objectStore('promotionEvents').getAll()),
  ]);
  await pdvTransactionDone(read);
  if (!pending.length && !allEvents.length) return;
  if (!deviceId || !authToken) throw new Error('Credenciais locais de sincronização indisponíveis');
  pending.sort((a, b) => a.createdAt - b.createdAt);
  allEvents.sort((a, b) => a.createdAt - b.createdAt);
  const caixaId = pending[0]?.caixaId || allEvents[0].caixaId;
  const batch = pending.filter(sale => sale.caixaId === caixaId).slice(0, 100);
  const events = allEvents.filter(event => event.caixaId === caixaId).slice(0, 100);
  const response = await fetch('/api/pdv/sincronizacoes/vendas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
    body: JSON.stringify({
      deviceId,
      deviceName,
      caixaId,
      vendas: batch.map(record => ({
        requestId: record.requestId,
        vendedorId: record.vendedorId,
        registradaEm: record.registradaEm,
        offline: Boolean(record.offline),
        itens: record.itens,
        doacaoCentavos: record.doacaoCentavos,
        formaPagamento: record.formaPagamento,
        formaPagamentoDoacao: record.formaPagamentoDoacao,
      })),
      eventosPromocao: events,
    }),
  });
  const payload = await response.json().catch(() => ({ error: 'Resposta inválida do servidor' }));
  if (!response.ok || payload.error) throw new Error(payload.error || `Erro HTTP ${response.status}`);

  const write = db.transaction(['outbox', 'receipts', 'promotionEvents'], 'readwrite');
  const outbox = write.objectStore('outbox');
  const receipts = write.objectStore('receipts');
  let synced = 0;
  let errors = 0;
  for (const result of payload.data?.resultados || []) {
    if (result.status === 'sincronizada' || result.status === 'duplicada') {
      outbox.delete(result.requestId);
      receipts.put({
        requestId: result.requestId,
        vendaId: result.vendaId,
        status: result.status,
        syncedAt: Date.now(),
      });
      synced += 1;
    } else {
      const record = await pdvRequest(outbox.get(result.requestId));
      if (record) outbox.put({ ...record, lastError: result.erro, lastAttemptAt: Date.now() });
      errors += 1;
    }
  }
  for (const result of payload.data?.eventosPromocao || []) {
    if (result.status === 'sincronizado' || result.status === 'duplicado') {
      write.objectStore('promotionEvents').delete(result.eventId);
    }
  }
  await pdvTransactionDone(write);
  await pdvBroadcast({
    type: 'CESCA_PDV_SYNC_COMPLETE',
    synced,
    errors,
    conflict: Boolean(payload.data?.conflitoEstoque),
    recalculatedClose: Boolean(payload.data?.recalculouFechamento),
  });

  const remaining = await pdvRequest(db.transaction('outbox', 'readonly').objectStore('outbox').count());
  if (remaining > 0 && errors === 0 && self.registration.sync) {
    await self.registration.sync.register('cesca-pdv-sync');
  }
}

self.addEventListener('sync', event => {
  if (event.tag === 'cesca-pdv-sync') event.waitUntil(pdvBackgroundSync());
});
