import * as React from 'react'
import {
  PrimaryButton,
  TransactionalLayout,
  formatMoney,
  type TransactionalEmailBrand,
  styles,
} from './_shared'

export interface WeeklySummaryEmailProps extends TransactionalEmailBrand {
  weekLabel?: string
  reportUrl?: string
  revenue?: number
  orders?: number
  averageCheck?: number
}

export default function WeeklySummaryEmail({
  weekLabel = 'This week',
  reportUrl = 'https://getsear.com/reports/weekly',
  revenue = 4289500,
  orders = 1842,
  averageCheck = 2329,
  ...brand
}: WeeklySummaryEmailProps) {
  return (
    <TransactionalLayout preview={`${weekLabel} in Sear POS.`} title="Weekly summary" {...brand}>
      <p style={styles.bodyText}>{weekLabel} is ready for review.</p>
      <div style={styles.panel}>
        <p style={styles.row}><span>Revenue</span><span>{formatMoney(revenue)}</span></p>
        <p style={styles.row}><span>Orders</span><span>{orders.toLocaleString()}</span></p>
        <p style={styles.row}><span>Average check</span><span>{formatMoney(averageCheck)}</span></p>
      </div>
      <PrimaryButton href={reportUrl} accentColor={brand.accentColor}>
        Open report
      </PrimaryButton>
    </TransactionalLayout>
  )
}
