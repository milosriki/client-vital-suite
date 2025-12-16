import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { HealthScoreBadge } from "./HealthScoreBadge";
import { TrendIndicator } from "./TrendIndicator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ClientContextMenu, PhoneContextMenu } from "@/components/ui/context-menu-custom";
import { ArrowUpDown, Phone, Mail, ExternalLink } from "lucide-react";
import type { ClientHealthScore } from "@/types/database";
import { toast } from "@/hooks/use-toast";
interface ClientTableProps {
  clients: ClientHealthScore[];
}

type SortField = 'name' | 'health_score' | 'health_zone' | 'days_since_last_session' | 'assigned_coach';
type SortDirection = 'asc' | 'desc';

export const ClientTable = ({ clients }: ClientTableProps) => {
  const navigate = useNavigate();
  const [sortField, setSortField] = useState<SortField>('health_score');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedClients = useMemo(() => {
    return [...clients].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      // Handle name field specially by combining firstname and lastname
      if (sortField === 'name') {
        aValue = `${a.firstname || ''} ${a.lastname || ''}`.trim();
        bValue = `${b.firstname || ''} ${b.lastname || ''}`.trim();
      } else {
        aValue = a[sortField];
        bValue = b[sortField];
      }

      // Handle null values
      if (aValue === null) return 1;
      if (bValue === null) return -1;

      // Convert to numbers if needed
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }

      // String comparison
      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();
      return sortDirection === 'asc' 
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });
  }, [clients, sortField, sortDirection]);

  const totalPages = Math.ceil(sortedClients.length / itemsPerPage);
  const paginatedClients = sortedClients.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getZoneBadgeColor = (zone: string) => {
    switch (zone) {
      case 'RED': return 'bg-[#ef4444] text-white border-none';
      case 'YELLOW': return 'bg-[#eab308] text-white border-none';
      case 'GREEN': return 'bg-[#22c55e] text-white border-none';
      case 'PURPLE': return 'bg-[#a855f7] text-white border-none';
      default: return '';
    }
  };

  const getPriorityBadgeColor = (priority: string | null) => {
    switch (priority?.toUpperCase()) {
      case 'CRITICAL': return 'bg-red-500 text-white border-none';
      case 'HIGH': return 'bg-orange-500 text-white border-none';
      case 'MEDIUM': return 'bg-yellow-500 text-white border-none';
      case 'LOW': return 'bg-blue-500 text-white border-none';
      default: return 'bg-gray-500 text-white border-none';
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer" onClick={() => handleSort('name')}>
                <div className="flex items-center gap-2">
                  Name
                  <ArrowUpDown className="h-4 w-4" />
                </div>
              </TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="cursor-pointer text-center" onClick={() => handleSort('health_score')}>
                <div className="flex items-center justify-center gap-2">
                  Health Score
                  <ArrowUpDown className="h-4 w-4" />
                </div>
              </TableHead>
              <TableHead className="cursor-pointer text-center" onClick={() => handleSort('health_zone')}>
                <div className="flex items-center justify-center gap-2">
                  Zone
                  <ArrowUpDown className="h-4 w-4" />
                </div>
              </TableHead>
              <TableHead className="text-center">Trend</TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort('assigned_coach')}>
                <div className="flex items-center gap-2">
                  Coach
                  <ArrowUpDown className="h-4 w-4" />
                </div>
              </TableHead>
              <TableHead className="cursor-pointer text-center" onClick={() => handleSort('days_since_last_session')}>
                <div className="flex items-center justify-center gap-2">
                  Days Since Session
                  <ArrowUpDown className="h-4 w-4" />
                </div>
              </TableHead>
              <TableHead className="text-center">Priority</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedClients.map((client) => (
              <ClientContextMenu
                key={client.id}
                clientName={`${client.firstname || ''} ${client.lastname || ''}`.trim()}
                email={client.email || undefined}
                phone={undefined}
                hubspotId={client.hubspot_contact_id || undefined}
                onViewProfile={() => navigate(`/clients/${encodeURIComponent(client.email || '')}`)}
              >
                <TableRow 
                  className="hover:bg-muted/50 cursor-pointer group transition-colors"
                  onClick={() => navigate(`/clients/${encodeURIComponent(client.email || '')}`)}
                  tabIndex={0}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span>{`${client.firstname || ''} ${client.lastname || ''}`.trim() || 'Unknown Client'}</span>
                      {/* Quick action icons on hover */}
                      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                        {client.email && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={(e) => { e.stopPropagation(); window.open(`mailto:${client.email}`); }}
                                  className="p-1 hover:bg-primary/10 rounded"
                                >
                                  <Mail className="h-3 w-3 text-muted-foreground hover:text-primary" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Send email</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {client.hubspot_contact_id && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    window.open(`https://app.hubspot.com/contacts/27656685/contact/${client.hubspot_contact_id}`, '_blank'); 
                                  }}
                                  className="p-1 hover:bg-primary/10 rounded"
                                >
                                  <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-primary" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>View in HubSpot</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{client.email}</TableCell>
                  <TableCell className="text-center">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <div className="flex justify-center">
                            <HealthScoreBadge 
                              score={client.health_score || 0} 
                              zone={client.health_zone as any} 
                              size="sm"
                            />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          Health score based on engagement, sessions, and retention metrics
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className={getZoneBadgeColor(client.health_zone)}>
                      {client.health_zone}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center">
                      <TrendIndicator trend={client.health_zone} />
                    </div>
                  </TableCell>
                  <TableCell 
                    className="cursor-pointer hover:text-primary hover:underline"
                    onClick={(e) => { e.stopPropagation(); navigate(`/coaches?selected=${client.assigned_coach}`); }}
                  >
                    {client.assigned_coach || 'Unassigned'}
                  </TableCell>
                  <TableCell className="text-center">
                    {client.days_since_last_session !== null ? client.days_since_last_session : 'N/A'}
                  </TableCell>
                  <TableCell className="text-center">
                    {client.client_segment ? (
                      <Badge className={getPriorityBadgeColor(client.client_segment)}>
                        {client.client_segment}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                </TableRow>
              </ClientContextMenu>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, clients.length)} of {clients.length} clients
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <span className="text-sm">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
