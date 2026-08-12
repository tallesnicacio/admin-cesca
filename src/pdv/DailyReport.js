import React from 'react';
import { Alert, Empty, Tag, Typography } from 'antd';

const { Title, Text } = Typography;

export const money = (centavos = 0) => (
  Number(centavos) / 100
).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const quantity = value => Number(value || 0).toLocaleString('pt-BR');

export function formatReportDate(value) {
  const raw = String(value || '');
  const isoDate = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDate) return `${isoDate[3]}/${isoDate[2]}/${isoDate[1]}`;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? 'Data não informada' : parsed.toLocaleDateString('pt-BR');
}

function SummaryCard({ label, value, detail, tone = '' }) {
  return (
    <div className={`pdv-report-summary-card ${tone ? `pdv-report-summary-${tone}` : ''}`}>
      <small>{label}</small>
      <strong>{money(value)}</strong>
      {detail && <span>{detail}</span>}
    </div>
  );
}

function PaymentValue({ label, data }) {
  return (
    <div className="pdv-report-payment-value">
      <small>{label}</small>
      <strong>{quantity(data?.quantidade)} un.</strong>
      <span>{money(data?.total_centavos)}</span>
    </div>
  );
}

export default function DailyReport({ report, showClosing = true }) {
  if (!report?.caixa) return <Empty description="Nenhum caixa encontrado para esta data" />;

  const summary = report.resumo || {};
  const products = report.produtos || [];
  const date = formatReportDate(report.caixa.data);
  const isClosed = report.caixa.status === 'fechado';
  const differenceCents = Math.round(Number(report.caixa.diferenca || 0) * 100);

  return (
    <div className="pdv-report lanchonete-print">
      <header className="pdv-report-heading">
        <div>
          <Text type="secondary">RELATÓRIO DIÁRIO</Text>
          <Title level={3}>{date}</Title>
        </div>
        <Tag color={isClosed ? 'default' : 'green'}>{isClosed ? 'Caixa fechado' : 'Caixa aberto'}</Tag>
      </header>

      <section className="pdv-report-section">
        <div className="pdv-report-section-title">
          <div><span>1</span><div><strong>Resumo financeiro</strong><small>{quantity(summary.quantidade_vendas)} vendas concluídas</small></div></div>
        </div>
        <div className="pdv-report-summary-grid">
          <SummaryCard
            label="Recebido via PIX"
            value={summary.pix_centavos}
            detail={`Produtos ${money(summary.produtos_pix_centavos)} · Doações ${money(summary.doacao_pix_centavos)}`}
            tone="pix"
          />
          <SummaryCard
            label="Recebido em dinheiro"
            value={summary.dinheiro_centavos}
            detail={`Produtos ${money(summary.produtos_dinheiro_centavos)} · Doações ${money(summary.doacao_dinheiro_centavos)}`}
            tone="cash"
          />
          <SummaryCard
            label="Total recebido"
            value={summary.total_centavos}
            detail={`Produtos ${money(summary.produtos_centavos)} · Doações ${money(summary.doacao_centavos)}`}
            tone="total"
          />
        </div>
      </section>

      <section className="pdv-report-section">
        <div className="pdv-report-section-title">
          <div><span>2</span><div><strong>Produtos vendidos</strong><small>Quantidade e valor por forma de pagamento</small></div></div>
        </div>
        <div className="pdv-report-product-list">
          {products.flatMap(product => (product.modalidades || []).map(mode => (
            <article className={`pdv-report-product-row ${mode.tipo === 'promocional' ? 'pdv-report-product-promo' : ''}`} key={`${product.produto_id}-${mode.tipo}`}>
              <div className="pdv-report-product-name">
                <strong>{product.nome}</strong>
                <span>
                  {mode.tipo === 'promocional' ? <Tag color="orange">Promoção</Tag> : <Tag>Preço normal</Tag>}
                  {money(mode.preco_unitario_centavos)} cada
                </span>
              </div>
              <PaymentValue label="PIX" data={mode.pix} />
              <PaymentValue label="Dinheiro" data={mode.dinheiro} />
              <div className="pdv-report-product-total">
                <small>Total</small>
                <strong>{quantity(mode.quantidade)} un.</strong>
                <span>{money(mode.total_centavos)}</span>
              </div>
            </article>
          )))}
        </div>
      </section>

      <section className="pdv-report-section">
        <div className="pdv-report-section-title">
          <div><span>3</span><div><strong>Doações</strong><small>Separadas do pagamento dos produtos</small></div></div>
        </div>
        <div className="pdv-report-donation-grid">
          <SummaryCard label="Doações via PIX" value={summary.doacao_pix_centavos} />
          <SummaryCard label="Doações em dinheiro" value={summary.doacao_dinheiro_centavos} />
          <SummaryCard label="Total de doações" value={summary.doacao_centavos} tone="donation" />
        </div>
      </section>

      {products.some(product => product.estoque_inicial != null) && (
        <section className="pdv-report-section">
          <div className="pdv-report-section-title">
            <div><span>4</span><div><strong>Controle de estoque</strong><small>Entrada, vendas e saldo atual</small></div></div>
          </div>
          <div className="pdv-report-stock-grid">
            {products.filter(product => product.estoque_inicial != null).map(product => (
              <div className="pdv-report-stock-card" key={product.produto_id}>
                <strong>{product.nome}</strong>
                <div><span>Inicial <b>{quantity(product.estoque_inicial)}</b></span><span>Vendidos <b>{quantity(product.quantidade)}</b></span><span>Restante <b>{quantity(product.estoque_disponivel)}</b></span></div>
              </div>
            ))}
          </div>
        </section>
      )}

      {showClosing && isClosed && (
        <section className="pdv-report-section pdv-report-closing">
          <div className="pdv-report-section-title">
            <div><span>✓</span><div><strong>Conferência do caixa</strong><small>Somente valores recebidos em dinheiro</small></div></div>
          </div>
          <div className="pdv-report-closing-values">
            <div><small>Esperado</small><strong>{money(Math.round(Number(report.caixa.valor_final_esperado) * 100))}</strong></div>
            <div><small>Contado</small><strong>{money(Math.round(Number(report.caixa.valor_final_real) * 100))}</strong></div>
            <div className={differenceCents === 0 ? 'is-balanced' : 'has-difference'}><small>Diferença</small><strong>{money(differenceCents)}</strong></div>
          </div>
          {differenceCents !== 0 && <Alert type="warning" showIcon message="Existe diferença entre o dinheiro esperado e o valor contado." />}
        </section>
      )}
    </div>
  );
}
