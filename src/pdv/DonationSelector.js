import React from 'react';
import { Button, InputNumber, Typography } from 'antd';
import { DONATION_PRESETS, normalizeDonationCentavos } from './pdvLogic';

const { Text } = Typography;
const money = centavos => (Number(centavos) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function DonationSelector({ value = 0, onChange }) {
  return (
    <>
      <div className="pdv-donation-title">
        <Text strong>Doação <Text type="secondary">(opcional)</Text></Text>
        <Text strong>{money(value)}</Text>
      </div>
      <div className="pdv-donation">
        {DONATION_PRESETS.map(preset => (
          <Button
            key={preset}
            data-donation-centavos={preset}
            type={value === preset ? 'primary' : 'default'}
            onClick={() => onChange(preset)}
          >
            {preset === 0 ? 'Sem doação' : money(preset)}
          </Button>
        ))}
        <InputNumber
          min={0}
          precision={2}
          decimalSeparator=","
          value={value / 100}
          onChange={next => onChange(normalizeDonationCentavos(next))}
          prefix="R$"
          addonBefore="Outro"
        />
      </div>
    </>
  );
}
