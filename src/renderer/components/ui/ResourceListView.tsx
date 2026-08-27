import {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { useVirtualizer } from "@tanstack/react-virtual"

import { WatchResource } from "../../../shared/watch"
import { cn, filterResources, formatAge } from "../../lib/utils"
import { useK8sResource } from "../../src/hooks/useK8sResource"
import {
  ResourceDetailFetcher,
  useResourceDetail,
} from "../../src/hooks/useResourceDetail"
import { useAppStore } from "../../store/app.store"
import { BatchActionBar, BatchConfig } from "./BatchActionBar"
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

export interface SortOption<T> {
  label: string
  compare: (a: T, b: T) => number
}

export interface DetailController {
  onClose: () => void
  onDeleted: () => void
  onDeleteDialogChange: (open: boolean) => void
}

interface ResourceListViewProps<T extends Namespaced, D> {
  title: string
  /** Defaults to `No {title} found`. */
  emptyMessage?: string
  list: (ctx?: string, ns?: string) => Promise<T[]>
  columns: ResourceColumn<T>[]
  /**
   * Fetches the full object for the selected row. List handlers return only
   * what the table renders, so resources with expensive detail (pod templates,
   * rule sets, ConfigMap and Secret payloads) pass this and type `D` as the
   * detail shape. Omit it when the list shape is already the whole object, and
   * the row itself is handed to `renderDetail`.
   */
  getDetail?: ResourceDetailFetcher<D>
  /**
   * Discriminates whether the shared store `selectedItem` belongs to this
   * view's resource type, so the detail panel isn't rendered with a
   * mismatched item after switching views.
   */
  detailGuard: (item: Namespaced) => boolean
  renderDetail: (item: D, ctl: DetailController) => ReactNode
  /**
   * When provided, a sort dropdown is rendered in the header. The first option
   * is the default; picking one sorts the visible rows by its comparator.
   */
  sortOptions?: SortOption<T>[]
  /** Defaults to `namespace/name` (or `name` when cluster-scoped). */
  rowKey?: (item: T) => string
  /**
   * Extra classes for a row's `<TableRow>`, keyed off the item — used to flag
   * unhealthy resources. The selected-row highlight still wins over this.
   */
  rowClassName?: (item: T) => string | undefined
  /**
   * When false, the active namespace filter is not applied (cluster-scoped
   * resources). Defaults to true.
   */
  namespaced?: boolean
  /**
   * Serve the rows from a main-process informer instead of re-listing on every
   * poll tick, for lists big enough that the full payload hurts. `list` is
   * still required: it is what the view falls back to when the watch can't be
   * established or drops.
   */
  watch?: WatchResource
  /**
   * Opts the list into multi-select: a checkbox column, and an action bar that
   * runs one verb over every checked row. Delete comes for free from the GVK;
   * `batch.actions` adds the kind's own verbs.
   */
  batch?: BatchConfig<T>
}

const sameItem = (a: Namespaced | null, b: Namespaced): boolean =>
  a?.name === b.name && a?.namespace === b.namespace

const ESTIMATED_ROW_HEIGHT = 37

export function ResourceListView<T extends Namespaced, D = T>({
  title,
  emptyMessage,
  list,
  columns,
  getDetail,
  detailGuard,
  renderDetail,
  rowKey,
  namespaced = true,
  sortOptions,
  rowClassName,
  watch,
  batch,
}: ResourceListViewProps<T, D>): JSX.Element {
  const selectedItem = useAppStore((s) => s.selectedItem) as T | null
  const setSelectedItem = useAppStore((s) => s.setSelectedItem)
  const selectedNamespace = useAppStore((s) => s.selectedNamespace)
  const selectedContext = useAppStore((s) => s.selectedContext)
  const nameFilter = useAppStore((s) => s.nameFilter)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [batchDialogOpen, setBatchDialogOpen] = useState(false)
  const [sortIndex, setSortIndex] = useState(0)
  // Checked rows, by the same key the table renders them under. Held as keys
  // rather than items so a poll tick handing back new objects doesn't drop the
  // selection.
  const [checkedKeys, setCheckedKeys] = useState<ReadonlySet<string>>(new Set())
  // Anchor for shift-click range selection, as an index into `visible`.
  const anchorRef = useRef<number | null>(null)

  // The active namespace is pushed down to the handler so the API server does
  // the filtering — a cluster-wide list of every pod is a large IPC payload to
  // ship on every poll just to throw most of it away here. `filterResources`
  // below still applies it, which keeps the view correct if a handler ever
  // ignores the hint.
  const { data, loading, error, reload, lastRefreshedAt } = useK8sResource(
    list,
    selectedContext,
    {
      paused: deleteDialogOpen || batchDialogOpen,
      namespace: namespaced ? selectedNamespace : null,
      watch,
    },
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

  const visible = useMemo(() => {
    const filtered = filterResources(
      data,
      nameFilter,
      namespaced ? selectedNamespace : undefined,
    )
    const compare = sortOptions?.[sortIndex]?.compare
    return compare ? [...filtered].sort(compare) : filtered
  }, [data, nameFilter, namespaced, selectedNamespace, sortOptions, sortIndex])
  const keyOf =
    rowKey ??
    ((item: T): string =>
      item.namespace ? `${item.namespace}/${item.name}` : item.name)

  // The selection is over the rows on screen: a key that has been filtered
  // out, or whose object is gone from the cluster, must not end up in a batch.
  const checkedItems = useMemo(
    () => (batch ? visible.filter((item) => checkedKeys.has(keyOf(item))) : []),
    [batch, visible, checkedKeys],
  )
  const clearChecked = useCallback(() => setCheckedKeys(new Set()), [])

  // A different context or namespace is a different set of objects, so any
  // carried-over checkmark would point at the wrong one.
  useEffect(() => {
    clearChecked()
    anchorRef.current = null
  }, [selectedContext, selectedNamespace, clearChecked])

  function toggleChecked(index: number, shiftKey: boolean): void {
    const item = visible[index]
    const key = keyOf(item)
    const next = new Set(checkedKeys)
    const anchor = anchorRef.current
    if (shiftKey && anchor !== null && anchor < visible.length) {
      // Shift-click extends from the anchor, taking the clicked row's new
      // state for the whole range — the behaviour of every other list UI.
      const on = !next.has(key)
      const [from, to] = anchor <= index ? [anchor, index] : [index, anchor]
      for (let i = from; i <= to; i++) {
        const k = keyOf(visible[i])
        if (on) next.add(k)
        else next.delete(k)
      }
    } else if (next.has(key)) {
      next.delete(key)
    } else {
      next.add(key)
    }
    anchorRef.current = index
    setCheckedKeys(next)
  }

  const allChecked =
    checkedItems.length > 0 && checkedItems.length === visible.length

  const showDetail = selectedItem !== null && detailGuard(selectedItem)

  const {
    detail,
    loading: detailLoading,
    error: detailError,
  } = useResourceDetail<D>(
    getDetail,
    showDetail ? selectedItem : null,
    selectedContext,
    { paused: deleteDialogOpen || batchDialogOpen },
  )

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
          <div className="flex items-center gap-2">
            {sortOptions && sortOptions.length > 0 && (
              <select
                value={sortIndex}
                onChange={(e) => setSortIndex(Number(e.target.value))}
                title="Sort by"
                className="rounded border px-2 py-1 text-xs bg-background text-foreground"
              >
                {sortOptions.map((opt, i) => (
                  <option key={opt.label} value={i}>
                    {opt.label}
                  </option>
                ))}
              </select>
            )}
            <RefreshBar lastRefreshedAt={lastRefreshedAt} onRefresh={reload} />
          </div>
        </div>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && !error && visible.length === 0 && (
          <EmptyState message={emptyMessage ?? `No ${title} found`} />
        )}
        {batch && checkedItems.length > 0 && (
          <BatchActionBar
            config={batch}
            selected={checkedItems}
            onClear={clearChecked}
            onDone={(succeeded) => {
              const done = new Set(succeeded.map(keyOf))
              setCheckedKeys(
                new Set([...checkedKeys].filter((k) => !done.has(k))),
              )
            }}
            onReload={reload}
            onDialogChange={setBatchDialogOpen}
          />
        )}
        {!loading && !error && visible.length > 0 && (
          <div ref={scrollRef} className="flex-1 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {batch && (
                    <TableHead className="w-8">
                      <input
                        type="checkbox"
                        aria-label={`Select all ${title}`}
                        className="accent-primary align-middle"
                        checked={allChecked}
                        ref={(el) => {
                          if (el)
                            el.indeterminate =
                              checkedItems.length > 0 && !allChecked
                        }}
                        onChange={() => {
                          anchorRef.current = null
                          setCheckedKeys(
                            allChecked
                              ? new Set()
                              : new Set(visible.map(keyOf)),
                          )
                        }}
                      />
                    </TableHead>
                  )}
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
                      colSpan={columns.length + (batch ? 1 : 0)}
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
                        rowClassName?.(item),
                        sameItem(selectedItem, item) && "bg-muted",
                      )}
                      onClick={() =>
                        setSelectedItem(
                          sameItem(selectedItem, item) ? null : item,
                        )
                      }
                    >
                      {batch && (
                        <TableCell
                          className="w-8"
                          // The checkbox column is for picking rows, not for
                          // opening one: a click here must not swap the detail
                          // panel out from under the selection.
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            aria-label={`Select ${keyOf(item)}`}
                            className="accent-primary align-middle"
                            checked={checkedKeys.has(keyOf(item))}
                            onChange={() => {}}
                            onClick={(e) =>
                              toggleChecked(virtualRow.index, e.shiftKey)
                            }
                          />
                        </TableCell>
                      )}
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
                      colSpan={columns.length + (batch ? 1 : 0)}
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
        <DetailPane
          // Without `getDetail` the list shape is the detail shape, and the row
          // stands in for it.
          item={getDetail ? detail : (selectedItem as unknown as D)}
          loading={detailLoading}
          error={detailError}
          render={(item) =>
            renderDetail(item, {
              onClose: () => setSelectedItem(null),
              onDeleted: reload,
              onDeleteDialogChange: setDeleteDialogOpen,
            })
          }
        />
      )}
    </div>
  )
}

/** Stands in for the detail panel while `getDetail` is in flight, or when it
 *  failed. */
function DetailPane<D>({
  item,
  loading,
  error,
  render,
}: {
  item: D | null
  loading: boolean
  error: string | null
  render: (item: D) => ReactNode
}): JSX.Element {
  // Detail already in hand wins over a failed background refresh: a transient
  // poll error shouldn't blank a panel the user is reading.
  if (item !== null && !loading) return <>{render(item)}</>
  // Matches DetailPanelLayout's own width so the table doesn't shift when the
  // real panel replaces this one.
  return (
    <div className="w-1/2 shrink-0 bg-card text-card-foreground border border-border shadow-md h-full p-4">
      {error !== null ? (
        <p className="text-sm text-red-500">{error}</p>
      ) : (
        <p className="text-sm text-muted-foreground">Loading...</p>
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
