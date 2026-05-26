import * as React from 'react'
import { PrimaryButton, TransactionalLayout, formatMoney, type TransactionalEmailBrand, styles } from './_shared'

export interface StatementEmailProps extends TransactionalEmailBrand {
  accountName?: string
  statementUrl?: string
  balanceDue?: number
  dueDate?: string
}

export default function StatementEmail({
  accountName = 'House Account',
  statementUrl = 'https://getsear.com/house-accounts',
  balanceDue = 124350,
  dueDate = 'June 15',
  ...brand
}: StatementEmailProps) {
  return (
    <TransactionalLayout preview="Your restaurant statement is ready." title="Statement ready" {...brand}>
      <p style={styles.bodyText}>{accountName} has a new statement.</p>
      <div style={styles.panel}>
        <p style={styles.row}><span>Balance due</span><span>{formatMoney(balanceDue)}</span></p>
        <p style={styles.row}><span>Due date</span><span>{dueDate}</span></p>
      </div>
      <PrimaryButton href={statementUrl} accentColor={brand.accentColor}>
        View statement
      </PrimaryButton>
    </TransactionalLayout>
  )
}
