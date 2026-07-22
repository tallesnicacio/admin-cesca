import React from 'react';
import { Button } from 'antd';
import { PAYMENT_OPTIONS } from './pdvLogic';

export default function PaymentButtons({ disabled = false, onSelect }) {
  return (
    <div className="pdv-payment-actions">
      {PAYMENT_OPTIONS.map(option => (
        <Button
          key={option.value}
          className={`pdv-payment-${option.value}`}
          type="primary"
          size="large"
          disabled={disabled}
          onClick={() => onSelect(option.value)}
        >
          <strong>{option.label}</strong>
          <small>{option.description}</small>
        </Button>
      ))}
    </div>
  );
}

