import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { FileX } from "lucide-react";

interface Column<T> {
  key: string;
  header: string;
  render?: (row: T, index: number) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string;
  maxHeight?: string;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  isLoading = false,
  emptyMessage = "No data available",
  emptyIcon,
  onRowClick,
  rowClassName,
  maxHeight = "400px",
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex gap-4">
            {columns.map((col, j) => (
              <Skeleton key={j} className="h-10 flex-1" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        {emptyIcon || <FileX className="h-12 w-12 text-muted-foreground/30 mb-4" />}
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="overflow-auto scrollbar-thin" style={{ maxHeight }}>
      <Table>
        <TableHeader className="sticky top-0 bg-card z-10">
          <TableRow className="border-border/50 hover:bg-transparent">
            {columns.map((col) => (
              <TableHead 
                key={col.key} 
                className={cn(
                  "text-xs font-semibold uppercase tracking-wider text-muted-foreground",
                  col.className
                )}
              >
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, i) => (
            <TableRow
              key={i}
              onClick={() => onRowClick?.(row)}
              className={cn(
                "border-border/30 transition-colors",
                onRowClick && "cursor-pointer hover:bg-muted/30",
                rowClassName?.(row)
              )}
            >
              {columns.map((col) => (
                <TableCell key={col.key} className={col.className}>
                  {col.render ? col.render(row, i) : row[col.key]}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
