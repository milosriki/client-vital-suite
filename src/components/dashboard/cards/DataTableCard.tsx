import { ReactNode, useState } from "react";
import { Search, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface Column<T> {
  key: string;
  label: string;
  render?: (item: T) => ReactNode;
  sortable?: boolean;
}

interface DataTableCardProps<T> {
  title: string;
  data: T[];
  columns: Column<T>[];
  searchable?: boolean;
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  onExport?: () => void;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
  };
  filters?: ReactNode;
  className?: string;
}

export function DataTableCard<T extends Record<string, any>>({
  title,
  data,
  columns,
  searchable = false,
  searchPlaceholder = "Search...",
  onSearch,
  onExport,
  pagination,
  filters,
  className,
}: DataTableCardProps<T>) {
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    onSearch?.(query);
  };

  return (
    <div className={cn("bg-[#0A0A0A] border border-[#1F2937] p-6 rounded-xl", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-50">{title}</h3>
        {onExport && (
          <Button variant="ghost" size="sm" onClick={onExport}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        )}
      </div>

      {/* Controls */}
      {(searchable || filters) && (
        <div className="flex items-center gap-3 mb-4">
          {searchable && (
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10 bg-slate-800/50 border-slate-700"
              />
            </div>
          )}
          {filters}
        </div>
      )}

      {/* Table */}
      <div className="border border-slate-800 rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-[#1A1A1A] hover:bg-[#1A1A1A]">
              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  className="font-semibold text-slate-300"
                >
                  {column.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="text-center text-slate-400 py-8"
                >
                  No data available
                </TableCell>
              </TableRow>
            ) : (
              data.map((item, index) => (
                <TableRow
                  key={index}
                  className="border-b border-slate-800 hover:bg-[#1A1A1A]"
                >
                  {columns.map((column) => (
                    <TableCell key={column.key} className="text-slate-200">
                      {column.render
                        ? column.render(item)
                        : item[column.key]}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination && data.length > 0 && (
        <div className="flex items-center justify-between mt-4 text-sm text-slate-400">
          <div>
            Showing {(pagination.page - 1) * pagination.pageSize + 1}-
            {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{" "}
            {pagination.total}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
            >
              Previous
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.ceil(pagination.total / pagination.pageSize) })
                .slice(
                  Math.max(0, pagination.page - 3),
                  Math.min(
                    Math.ceil(pagination.total / pagination.pageSize),
                    pagination.page + 2
                  )
                )
                .map((_, i) => {
                  const page = Math.max(0, pagination.page - 3) + i + 1;
                  return (
                    <Button
                      key={page}
                      variant={page === pagination.page ? "default" : "outline"}
                      size="sm"
                      onClick={() => pagination.onPageChange(page)}
                      className="w-8 h-8 p-0"
                    >
                      {page}
                    </Button>
                  );
                })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              disabled={
                pagination.page ===
                Math.ceil(pagination.total / pagination.pageSize)
              }
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
