import { ReactNode, useEffect, useMemo, useRef, useState } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"

import { cn, filterResources, formatAge } from "../../lib/utils"
import { useK8sResource } from "../../src/hooks/useK8sResource"
import { useAppStore } from "../../store/app.store"
import { EmptyState } from "./EmptyState"
import { RefreshBar } from "./RefreshBar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./Table"

interface Namespaced {
  name: string
  namespace?: string | null
}

export interface ResourceColumn<T> {
  head: string
  cell: (item: T) => ReactNode
  /**
   * Extra classes for the <TableCell> (appended to `whitespace-nowrap`).
   * May be a function of the row item for per-row styling.
   */
  className?: string | ((item: T) => string | undefined)
  headClassName?: string
}

export interface DetailController {
  onClose: () => void
  onDeleted: () => void
  onDeleteDialogChange: (open: boolean) => void
}

interface ResourceListViewProps<T extends Namespaced> {
  title: string
  /** Defaults to `No {title} found`. */
  emptyMessage?: string
  list: (ctx?: string) => Promise<T[]>
  columns: ResourceColumn<T>[]
  /**
   * Discriminates whether the shared store `selectedItem` belongs to this
   * view's resource type, so the detail panel isn't rendered with a
   * mismatched item after switching views.
   */
  detailGuard: (item: Namespaced) => boolean
  renderDetail: (item: T, ctl: DetailController) => ReactNode
  /** Defaults to `namespace/name` (or `name` when cluster-scoped). */
  rowKey?: (item: T) => string
  /**
   * When false, the active namespace filter is not applied (cluster-scoped
   * resources). Defaults to true.
   */
  namespaced?: boolean
}

const sameItem = (a: Namespaced | null, b: Namespaced): boolean =>
  a?.name === b.name && a?.namespace === b.namespace

const ESTIMATED_ROW_HEIGHT = 37

export function ResourceListView<T extends Namespaced>({
  title,
  emptyMessage,
  list,
  columns,
  detailGuard,
  renderDetail,
  rowKey,
  namespaced = true,
}: ResourceListViewProps<T>): JSX.Element {
  const selectedItem = useAppStore((s) => s.selectedItem) as T | null
  const setSelectedItem = useAppStore((s) => s.setSelectedItem)
  const selectedNamespace = useAppStore((s) => s.selectedNamespace)
  const selectedContext = useAppStore((s) => s.selectedContext)
  const nameFilter = useAppStore((s) => s.nameFilter)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const { data, loading, error, reload, lastRefreshedAt } = useK8sResource(
    list,
    selectedContext,
    { paused: deleteDialogOpen },
  )

  // Re-sync the selected item with fresh data after a reload. Every poll hands
  // back newly-deserialized objects, so compare by content: an unconditional
  // write re-renders the detail panel (events, metrics, charts) every interval
  // even when nothing about the resource changed.
  useEffect(() => {
    if (!selectedItem || data.length === 0) return
    if (!detailGuard(selectedItem)) return
    const fresh = data.find((d) => sameItem(selectedItem, d))
    if (!fresh) return
    if (JSON.stringify(fresh) === JSON.stringify(selectedItem)) return
    setSelectedItem(fresh as object)
  }, [data])

  const visible = useMemo(
    () =>
      filterResources(
        data,
        nameFilter,
        namespaced ? selectedNamespace : undefined,
      ),
    [data, nameFilter, namespaced, selectedNamespace],
  )
  const keyOf =
    rowKey ??
    ((item: T): string =>
      item.namespace ? `${item.namespace}/${item.name}` : item.name)

  const showDetail = selectedItem !== null && detailGuard(selectedItem)

  // Only the rows in view are mounted; a large cluster otherwise puts thousands
  // of cells in the DOM. Spacer rows above/below preserve auto table layout,
  // which absolute-positioned rows would collapse.
  const scrollRef = useRef<HTMLDivElement>(null)
  const tbodyRef = useRef<HTMLTableSectionElement>(null)
  const rowVirtualizer = useVirtualizer({
    count: visible.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 12,
    scrollMargin: tbodyRef.current?.offsetTop ?? 0,
  })
  const virtualRows = rowVirtualizer.getVirtualItems()
  const paddingTop =
    virtualRows.length > 0
      ? virtualRows[0].start - rowVirtualizer.options.scrollMargin
      : 0
  const paddingBottom =
    virtualRows.length > 0
      ? rowVirtualizer.getTotalSize() -
        (virtualRows[virtualRows.length - 1].end -
          rowVirtualizer.options.scrollMargin)
      : 0

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex flex-1 flex-col overflow-hidden p-4">
        <div className="flex shrink-0 items-center justify-between mb-4">
          <h1 className="text-lg font-semibold">{title}</h1>
          <RefreshBar lastRefreshedAt={lastRefreshedAt} onRefresh={reload} />
        </div>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && !error && visible.length === 0 && (
          <EmptyState message={emptyMessage ?? `No ${title} found`} />
        )}
        {!loading && !error && visible.length > 0 && (
          <div ref={scrollRef} className="flex-1 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((col) => (
                    <TableHead
                      key={col.head}
                      className={cn("whitespace-nowrap", col.headClassName)}
                    >
                      {col.head}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody ref={tbodyRef}>
                {paddingTop > 0 && (
                  <tr aria-hidden>
                    <td
                      colSpan={columns.length}
                      style={{ height: paddingTop }}
                    />
                  </tr>
                )}
                {virtualRows.map((virtualRow) => {
                  const item = visible[virtualRow.index]
                  return (
                    <TableRow
                      key={keyOf(item)}
                      data-index={virtualRow.index}
                      ref={rowVirtualizer.measureElement}
                      className={cn(
                        "cursor-pointer",
                        sameItem(selectedItem, item) && "bg-muted",
                      )}
                      onClick={() =>
                        setSelectedItem(
                          sameItem(selectedItem, item) ? null : item,
                        )
                      }
                    >
                      {columns.map((col) => (
                        <TableCell
                          key={col.head}
                          className={cn(
                            "whitespace-nowrap",
                            typeof col.className === "function"
                              ? col.className(item)
                              : col.className,
                          )}
                        >
                          {col.cell(item)}
                        </TableCell>
                      ))}
                    </TableRow>
                  )
                })}
                {paddingBottom > 0 && (
                  <tr aria-hidden>
                    <td
                      colSpan={columns.length}
                      style={{ height: paddingBottom }}
                    />
                  </tr>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {showDetail && (
        <>
          {renderDetail(selectedItem as T, {
            onClose: () => setSelectedItem(null),
            onDeleted: reload,
            onDeleteDialogChange: setDeleteDialogOpen,
          })}
        </>
      )}
    </div>
  )
}

/** Common trailing "Age" column used by most resource lists. */
export function ageColumn<
  T extends { creationTimestamp: string },
>(): ResourceColumn<T> {
  return { head: "Age", cell: (item) => formatAge(item.creationTimestamp) }
}
