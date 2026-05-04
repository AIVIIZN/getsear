"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/*
 * Sear POS UI v2 — Table
 * Spec: docs/design/UI_V2_COMPONENT_SPEC.md universal rules + V6_VISUAL 6.1.4
 *
 * Composable parts: Table, TableHeader, TableBody, TableRow, TableCell.
 * - Sortable headers: caller passes sort handler via TableCell with sort
 *   props (sortable, sortDirection, onSort).
 * - Mobile-friendly: outer wrapper applies overflow-x-auto so wide tables
 *   scroll horizontally on narrow viewports.
 * - Tokens only — colors via var(--color-*), spacing via var(--space-*).
 */

type DivProps = React.HTMLAttributes<HTMLDivElement>
type TableElProps = React.TableHTMLAttributes<HTMLTableElement>
type RowProps = React.HTMLAttributes<HTMLTableRowElement>
type SectionProps = React.HTMLAttributes<HTMLTableSectionElement>
type CellProps = React.TdHTMLAttributes<HTMLTableCellElement>
type HeaderCellProps = React.ThHTMLAttributes<HTMLTableCellElement>

export interface TableProps extends TableElProps {
  /** Wrap table in a horizontally-scrollable container (default: true). */
  responsive?: boolean
  /** Wrapper div props when responsive=true. */
  wrapperProps?: DivProps
}

const Table = React.forwardRef<HTMLTableElement, TableProps>(
  function Table(
    { className, responsive = true, wrapperProps, ...props },
    ref,
  ) {
    const table = (
      <table
        ref={ref}
        className={cn(
          "w-full border-collapse text-left",
          "font-[var(--font-system)] text-[var(--type-subhead-size)]",
          "text-[var(--color-text)]",
          className,
        )}
        {...props}
      />
    )
    if (!responsive) return table
    return (
      <div
        {...wrapperProps}
        className={cn("w-full overflow-x-auto", wrapperProps?.className)}
      >
        {table}
      </div>
    )
  },
)

const TableHeader = React.forwardRef<HTMLTableSectionElement, SectionProps>(
  function TableHeader({ className, ...props }, ref) {
    return (
      <thead
        ref={ref}
        className={cn(
          "bg-[var(--color-bg-subtle)]",
          "border-b border-[var(--color-border)]",
          className,
        )}
        {...props}
      />
    )
  },
)

const TableBody = React.forwardRef<HTMLTableSectionElement, SectionProps>(
  function TableBody({ className, ...props }, ref) {
    return <tbody ref={ref} className={cn(className)} {...props} />
  },
)

export interface TableRowProps extends RowProps {
  /** When true, row is selectable; gets hover state + cursor pointer. */
  interactive?: boolean
  selected?: boolean
}

const TableRow = React.forwardRef<HTMLTableRowElement, TableRowProps>(
  function TableRow(
    { className, interactive = false, selected = false, ...props },
    ref,
  ) {
    return (
      <tr
        ref={ref}
        data-selected={selected || undefined}
        className={cn(
          "border-b border-[var(--color-border)] last:border-b-0",
          "transition-colors duration-[var(--duration-quick)] ease-[var(--ease-out)]",
          interactive &&
            "cursor-pointer hover:bg-[var(--color-surface-hover)] data-[selected=true]:bg-[var(--color-sidebar-active)]",
          className,
        )}
        {...props}
      />
    )
  },
)

export type SortDirection = "asc" | "desc" | null

export type TableAlign = "left" | "center" | "right"

export interface TableCellProps extends Omit<CellProps, "align"> {
  /** Render as <th> instead of <td>. Auto-true for cells inside <thead>. */
  header?: boolean
  /** Right/center align numeric or status columns. */
  align?: TableAlign
}

export interface TableHeaderCellProps extends Omit<HeaderCellProps, "align"> {
  sortable?: boolean
  sortDirection?: SortDirection
  onSort?: () => void
  align?: TableAlign
}

const alignClass: Record<TableAlign, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
}

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  TableCellProps & { sortable?: boolean; sortDirection?: SortDirection; onSort?: () => void }
>(function TableCell(
  {
    className,
    header = false,
    align = "left",
    sortable,
    sortDirection,
    onSort,
    children,
    ...props
  },
  ref,
) {
  const baseCls = cn(
    "px-[var(--space-4)] py-[var(--space-3)] align-middle",
    alignClass[align],
  )
  if (header) {
    return (
      <TableHeaderCell
        ref={ref as React.Ref<HTMLTableCellElement>}
        className={cn(baseCls, className)}
        sortable={sortable}
        sortDirection={sortDirection ?? null}
        onSort={onSort}
        align={align}
        {...(props as Omit<HeaderCellProps, "align">)}
      >
        {children}
      </TableHeaderCell>
    )
  }
  return (
    <td ref={ref} className={cn(baseCls, className)} {...(props as CellProps)}>
      {children}
    </td>
  )
})

const TableHeaderCell = React.forwardRef<HTMLTableCellElement, TableHeaderCellProps>(
  function TableHeaderCell(
    {
      className,
      sortable = false,
      sortDirection = null,
      onSort,
      align = "left",
      children,
      ...props
    },
    ref,
  ) {
    const handleClick = sortable && onSort ? onSort : undefined
    const handleKey = sortable && onSort
      ? (e: React.KeyboardEvent<HTMLTableCellElement>) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            onSort()
          }
        }
      : undefined

    const ariaSort: React.AriaAttributes["aria-sort"] = sortable
      ? sortDirection === "asc"
        ? "ascending"
        : sortDirection === "desc"
        ? "descending"
        : "none"
      : undefined

    return (
      <th
        ref={ref}
        scope="col"
        aria-sort={ariaSort}
        tabIndex={sortable ? 0 : undefined}
        onClick={handleClick}
        onKeyDown={handleKey}
        className={cn(
          "px-[var(--space-4)] py-[var(--space-3)] align-middle",
          "text-[var(--type-footnote-size)] font-[var(--weight-semibold)]",
          "uppercase tracking-wide text-[var(--color-text-muted)]",
          alignClass[align],
          sortable &&
            "cursor-pointer select-none hover:text-[var(--color-text)] focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] focus-visible:outline-offset-[-2px]",
          className,
        )}
        {...props}
      >
        <span
          className={cn(
            "inline-flex items-center gap-[var(--space-1)]",
            align === "right" && "justify-end",
            align === "center" && "justify-center",
          )}
        >
          {children}
          {sortable && <SortIndicator direction={sortDirection} />}
        </span>
      </th>
    )
  },
)

function SortIndicator({ direction }: { direction: SortDirection }) {
  return (
    <svg
      viewBox="0 0 10 14"
      aria-hidden="true"
      className="h-[12px] w-[10px] shrink-0"
    >
      <path
        d="M5 0 L9 5 L1 5 Z"
        fill="currentColor"
        opacity={direction === "asc" ? 1 : 0.3}
      />
      <path
        d="M5 14 L1 9 L9 9 Z"
        fill="currentColor"
        opacity={direction === "desc" ? 1 : 0.3}
      />
    </svg>
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  TableHeaderCell,
}
export default Table
