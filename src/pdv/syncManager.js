import { apiFetch } from '../supabaseClient';
import {
  acknowledgePromotionEvents,
  acknowledgeSale,
  getDeviceId,
  getDeviceName,
  listPendingSales,
  listPromotionEvents,
  markSaleAttempt,
  purgeOldReceipts,
} from './offlineStore';

let running = null;

export async function syncPendingSales() {
  if (running) return running;
  running = (async () => {
    if (!navigator.onLine) return { online: false, synced: 0, errors: 0 };
    const pending = await listPendingSales();
    const allPromotionEvents = await listPromotionEvents();
    if (!pending.length && !allPromotionEvents.length) {
      await purgeOldReceipts();
      return { online: true, synced: 0, errors: 0 };
    }
    const caixaId = pending[0]?.caixaId || allPromotionEvents[0].caixaId;
    const batch = pending.filter(sale => sale.caixaId === caixaId).slice(0, 100);
    const promotionEvents = allPromotionEvents
      .filter(event => event.caixaId === caixaId)
      .slice(0, 100);
    const deviceId = await getDeviceId();
    const deviceName = await getDeviceName();
    let result;
    try {
      result = await apiFetch('/pdv/sincronizacoes/vendas', {
        method: 'POST',
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
          eventosPromocao: promotionEvents,
        }),
      });
    } catch (error) {
      await Promise.all(batch.map(record => markSaleAttempt(record.requestId, error.message)));
      return { online: false, synced: 0, errors: batch.length, error };
    }
    if (result?.error) {
      const errorMessage = typeof result.error === 'string' ? result.error : result.error.message;
      await Promise.all(batch.map(record => markSaleAttempt(record.requestId, errorMessage)));
      return { online: true, synced: 0, errors: batch.length, error: new Error(errorMessage) };
    }
    const responses = result?.data?.resultados || [];
    let synced = 0;
    let errors = 0;
    for (const response of responses) {
      if (response.status === 'sincronizada' || response.status === 'duplicada') {
        await acknowledgeSale(response.requestId, response);
        synced += 1;
      } else {
        await markSaleAttempt(response.requestId, response.erro || 'Falha de sincronização');
        errors += 1;
      }
    }
    const acceptedEventIds = (result?.data?.eventosPromocao || [])
      .filter(event => event.status === 'sincronizado' || event.status === 'duplicado')
      .map(event => event.eventId);
    await acknowledgePromotionEvents(acceptedEventIds);
    await purgeOldReceipts();
    return {
      online: true,
      synced,
      eventsSynced: acceptedEventIds.length,
      errors,
      conflict: Boolean(result?.data?.conflitoEstoque),
      recalculatedClose: Boolean(result?.data?.recalculouFechamento),
    };
  })();
  try {
    return await running;
  } finally {
    running = null;
  }
}

export function requestBackgroundSync() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.ready.then(registration => {
    if ('sync' in registration) registration.sync.register('cesca-pdv-sync').catch(() => {});
  }).catch(() => {});
}
