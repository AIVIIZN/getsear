import * as React from 'react'
import {
  TransactionalLayout,
  formatMoney,
  type TransactionalEmailBrand,
  styles,
} from './_shared'

export interface ReceiptEmailProps extends TransactionalEmailBrand {
  orderNumber?: string
  paidAt?: string
  items?: Array<{ name: string; quantity: number; total: number }>
  subtotal?: number
  tax?: number
  tip?: number
  total?: number
}

export default function ReceiptEmail({
  orderNumber = '1024',
  paidAt = 'Today',
  items = [
    { name: 'Classic Burger', quantity: 2, total: 2800 },
    { name: 'Crispy Fries', quantity: 1, total: 600 },
  ],
  subtotal = 3400,
  tax = 289,
  tip = 700,
  total = 4389,
  ...brand
}: ReceiptEmailProps) {
  return (
    <TransactionalLayout preview={`Receipt for order ${orderNumber}.`} title={`Order #${orderNumber}`} {...brand}>
      <p style={styles.mutedText}>{paidAt}</p>
      <div style={styles.panel}>
        {items.map((item) => (
          <p key={item.name} style={styles.row}>
            <span>
              {item.quantity}x {item.name}
            </span>
            <span>{formatMoney(item.total)}</span>
          </p>
        ))}
      </div>
      <p style={styles.row}><span>Subtotal</span><span>{formatMoney(subtotal)}</span></p>
      <p style={styles.row}><span>Tax</span><span>{formatMoney(tax)}</span></p>
      <p style={styles.row}><span>Tip</span><span>{formatMoney(tip)}</span></p>
      <p style={{ ...styles.row, fontWeight: 700 }}><span>Total</span><span>{formatMoney(total)}</span></p>
    </TransactionalLayout>
  )
}
