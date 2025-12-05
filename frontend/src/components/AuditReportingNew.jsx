import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { FileText, BarChart3, Filter, Download, Loader2, X } from 'lucide-react';
import TablePaginationControls from '@/components/TablePaginationControls';

const AuditReportingNew = () => {
  const { getAuthHeaders } = useAuth();
  const [activeView, setActiveView] = useState('logs');
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [logsPage, setLogsPage] = useState(1);
  const [logsPageSize, setLogsPageSize] = useState(10);
  const [filters, setFilters] = useState({
    action: '', entityType: '', startDate: '', endDate: '', userEmail: '', limit: '100'
  });

  useEffect(() => {
    if (activeView === 'logs') fetchLogs();
    else if (activeView === 'summary') fetchSummary();
    else if (activeView === 'stats') fetchStats();
  }, [activeView]);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => {
        if (v && v !== 'all') params.append(k, v);
      });
      const response = await fetch(`/api/audit/logs?${params}`, { headers: { ...getAuthHeaders() } });
      if (!response.ok) throw new Error('Failed to fetch audit logs');
      setLogs(await response.json());
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  const fetchSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/reports/summary', { headers: { ...getAuthHeaders() } });
      if (!response.ok) throw new Error('Failed to fetch summary');
      setSummary(await response.json());
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      const response = await fetch(`/api/audit/stats?${params}`, { headers: { ...getAuthHeaders() } });
      if (!response.ok) throw new Error('Failed to fetch stats');
      setStats(await response.json());
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => v && k !== 'limit' && params.append(k, v));
      const response = await fetch(`/api/audit/export?${params}`, { headers: { ...getAuthHeaders() } });
      if (!response.ok) throw new Error('Failed to export');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err.message);
    }
  };

  const clearFilters = () => setFilters({ action: '', entityType: '', startDate: '', endDate: '', userEmail: '', limit: '100' });
  const formatDate = (d) => new Date(d).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const getActionColor = (action) => ({ CREATE: 'default', STATUS_CHANGE: 'secondary', UPDATE: 'outline', DELETE: 'destructive' }[action] || 'secondary');

  useEffect(() => {
    setLogsPage(1);
  }, [logsPageSize, logs.length]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(logs.length / logsPageSize) || 1);
    if (logsPage > totalPages) {
      setLogsPage(totalPages);
    }
  }, [logsPage, logsPageSize, logs.length]);

  const paginatedLogs = useMemo(() => {
    const start = (logsPage - 1) * logsPageSize;
    return logs.slice(start, start + logsPageSize);
  }, [logs, logsPage, logsPageSize]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <CardTitle>Audit & Reporting</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeView} onValueChange={setActiveView}>
            <TabsList className="mb-6">
              <TabsTrigger value="logs" className="gap-2"><FileText className="h-4 w-4" />Audit Logs</TabsTrigger>
              <TabsTrigger value="summary" className="gap-2"><BarChart3 className="h-4 w-4" />Summary</TabsTrigger>
              <TabsTrigger value="stats" className="gap-2"><BarChart3 className="h-4 w-4" />Statistics</TabsTrigger>
            </TabsList>

            {error && <div className="mb-4 p-4 rounded-md bg-destructive/10 text-destructive text-sm">{error}</div>}

            <TabsContent value="logs" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-6">
                <Select value={filters.action} onValueChange={(v) => setFilters({ ...filters, action: v })}>
                  <SelectTrigger><SelectValue placeholder="Action" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    <SelectItem value="CREATE">Create</SelectItem>
                    <SelectItem value="STATUS_CHANGE">Status Change</SelectItem>
                    <SelectItem value="UPDATE">Update</SelectItem>
                    <SelectItem value="DELETE">Delete</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filters.entityType} onValueChange={(v) => setFilters({ ...filters, entityType: v })}>
                  <SelectTrigger><SelectValue placeholder="Entity Type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="asset">Asset</SelectItem>
                    <SelectItem value="company">Company</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} placeholder="Start Date" />
                <Input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} placeholder="End Date" />
                <Input type="email" value={filters.userEmail} onChange={(e) => setFilters({ ...filters, userEmail: e.target.value })} placeholder="User Email" />
                <Select value={filters.limit} onValueChange={(v) => setFilters({ ...filters, limit: v })}>
                  <SelectTrigger><SelectValue placeholder="Limit" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="50">50 records</SelectItem>
                    <SelectItem value="100">100 records</SelectItem>
                    <SelectItem value="250">250 records</SelectItem>
                    <SelectItem value="all">All records</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button onClick={fetchLogs}><Filter className="h-4 w-4 mr-2" />Apply Filters</Button>
                <Button variant="outline" onClick={clearFilters}><X className="h-4 w-4 mr-2" />Clear</Button>
                <Button variant="outline" onClick={handleExport} className="ml-auto"><Download className="h-4 w-4 mr-2" />Export CSV</Button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /><span className="ml-2 text-muted-foreground">Loading...</span></div>
              ) : logs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground"><FileText className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No audit logs found.</p></div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead className="hidden md:table-cell">Entity Type</TableHead>
                        <TableHead>Entity Name</TableHead>
                        <TableHead className="hidden lg:table-cell">Details</TableHead>
                        <TableHead className="hidden md:table-cell">User</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-sm">{formatDate(log.timestamp)}</TableCell>
                          <TableCell><Badge variant={getActionColor(log.action)}>{log.action}</Badge></TableCell>
                          <TableCell className="hidden md:table-cell capitalize">{log.entity_type}</TableCell>
                          <TableCell>{log.entity_name || '-'}</TableCell>
                          <TableCell className="hidden lg:table-cell max-w-xs truncate text-sm text-muted-foreground">{log.details}</TableCell>
                          <TableCell className="hidden md:table-cell">{log.user_email || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="mt-4">
                    <TablePaginationControls
                      page={logsPage}
                      pageSize={logsPageSize}
                      totalItems={logs.length}
                      onPageChange={setLogsPage}
                      onPageSizeChange={setLogsPageSize}
                    />
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="summary">
              {loading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : summary ? (
                <div className="grid gap-4 md:grid-cols-4">
                  <Card className="bg-primary text-primary-foreground">
                    <CardContent className="pt-6">
                      <div className="text-3xl font-bold">{summary.total}</div>
                      <p className="text-sm opacity-80">Total Assets</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">By Status</CardTitle></CardHeader>
                    <CardContent className="space-y-1">
                      {Object.entries(summary.by_status || {}).map(([status, count]) => (
                        <div key={status} className="flex justify-between text-sm"><span className="capitalize">{status}</span><span className="font-semibold">{count}</span></div>
                      ))}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">By Company</CardTitle></CardHeader>
                    <CardContent className="space-y-1">
                      {Object.entries(summary.by_company || {}).map(([company, count]) => (
                        <div key={company} className="flex justify-between text-sm"><span className="truncate max-w-[70%]">{company}</span><span className="font-semibold">{count}</span></div>
                      ))}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">By Manager</CardTitle></CardHeader>
                    <CardContent className="space-y-1">
                      {Object.entries(summary.by_manager || {}).slice(0, 5).map(([manager, count]) => (
                        <div key={manager} className="flex justify-between text-sm"><span className="truncate max-w-[70%]">{manager}</span><span className="font-semibold">{count}</span></div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              ) : null}
            </TabsContent>

            <TabsContent value="stats" className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                <Input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} className="w-auto" />
                <Input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} className="w-auto" />
                <Button onClick={fetchStats}><Filter className="h-4 w-4 mr-2" />Apply</Button>
              </div>
              {loading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : stats.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground"><BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No statistics available.</p></div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Action</TableHead>
                        <TableHead>Entity Type</TableHead>
                        <TableHead>Count</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.map((stat, i) => (
                        <TableRow key={i}>
                          <TableCell><Badge variant={getActionColor(stat.action)}>{stat.action}</Badge></TableCell>
                          <TableCell className="capitalize">{stat.entity_type}</TableCell>
                          <TableCell className="font-semibold">{stat.count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuditReportingNew;
