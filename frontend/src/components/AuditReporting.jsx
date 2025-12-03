import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  Typography,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  Grid,
  Chip,
  Tabs,
  Tab,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  FilterList,
  Clear,
  Download,
  Assessment,
  Description,
  BarChart,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

const AuditReporting = () => {
  const { getAuthHeaders } = useAuth();
  const [activeView, setActiveView] = useState('logs');
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [filters, setFilters] = useState({
    action: '',
    entityType: '',
    startDate: '',
    endDate: '',
    userEmail: '',
    limit: 100
  });

  useEffect(() => {
    if (activeView === 'logs') {
      fetchLogs();
    } else if (activeView === 'summary') {
      fetchSummary();
    } else if (activeView === 'stats') {
      fetchStats();
    }
  }, [activeView]);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filters.action) params.append('action', filters.action);
      if (filters.entityType) params.append('entityType', filters.entityType);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.userEmail) params.append('userEmail', filters.userEmail);
      if (filters.limit) params.append('limit', filters.limit);

      const response = await fetch(`/api/audit/logs?${params}`, {
        headers: {
          ...getAuthHeaders()
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch audit logs');
      }
      const data = await response.json();
      setLogs(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/reports/summary', {
        headers: {
          ...getAuthHeaders()
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch summary');
      }
      const data = await response.json();
      setSummary(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);

      const response = await fetch(`/api/audit/stats?${params}`, {
        headers: {
          ...getAuthHeaders()
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }
      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    setFilters({
      ...filters,
      [e.target.name]: e.target.value
    });
  };

  const handleApplyFilters = () => {
    if (activeView === 'logs') {
      fetchLogs();
    } else if (activeView === 'stats') {
      fetchStats();
    }
  };

  const handleClearFilters = () => {
    setFilters({
      action: '',
      entityType: '',
      startDate: '',
      endDate: '',
      userEmail: '',
      limit: 100
    });
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.action) params.append('action', filters.action);
      if (filters.entityType) params.append('entityType', filters.entityType);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.userEmail) params.append('userEmail', filters.userEmail);

      const response = await fetch(`/api/audit/export?${params}`, {
        headers: {
          ...getAuthHeaders()
        }
      });
      if (!response.ok) {
        throw new Error('Failed to export data');
      }

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
      setError('Error exporting data: ' + err.message);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'CREATE':
        return 'success';
      case 'STATUS_CHANGE':
        return 'info';
      case 'UPDATE':
        return 'warning';
      case 'DELETE':
        return 'error';
      default:
        return 'default';
    }
  };

  const handleTabChange = (event, newValue) => {
    setActiveView(newValue);
  };

  return (
    <Card sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <Assessment color="primary" />
        <Typography variant="h5" fontWeight={600}>
          Audit & Reporting
        </Typography>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeView} onChange={handleTabChange}>
          <Tab
            icon={<Description />}
            iconPosition="start"
            label="Audit Logs"
            value="logs"
          />
          <Tab
            icon={<BarChart />}
            iconPosition="start"
            label="Summary Report"
            value="summary"
          />
          <Tab
            icon={<Assessment />}
            iconPosition="start"
            label="Statistics"
            value="stats"
          />
        </Tabs>
      </Box>

      {/* Error Message */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>
      )}

      {/* Audit Logs View */}
      {activeView === 'logs' && (
        <>
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <FilterList sx={{ mr: 1 }} color="action" />
              <Typography variant="subtitle1" fontWeight={600}>
                Filters
              </Typography>
            </Box>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={4} lg={2}>
                <FormControl fullWidth size="small" sx={{ minWidth: 180 }}>
                  <InputLabel>Action</InputLabel>
                  <Select
                    name="action"
                    value={filters.action}
                    onChange={handleFilterChange}
                    label="Action"
                  >
                    <MenuItem value="">All Actions</MenuItem>
                    <MenuItem value="CREATE">Create</MenuItem>
                    <MenuItem value="STATUS_CHANGE">Status Change</MenuItem>
                    <MenuItem value="UPDATE">Update</MenuItem>
                    <MenuItem value="DELETE">Delete</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6} md={4} lg={2}>
                <FormControl fullWidth size="small" sx={{ minWidth: 180 }}>
                  <InputLabel>Entity Type</InputLabel>
                  <Select
                    name="entityType"
                    value={filters.entityType}
                    onChange={handleFilterChange}
                    label="Entity Type"
                  >
                    <MenuItem value="">All Types</MenuItem>
                    <MenuItem value="asset">Asset</MenuItem>
                    <MenuItem value="company">Company</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6} md={4} lg={2}>
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  name="startDate"
                  label="Start Date"
                  value={filters.startDate}
                  onChange={handleFilterChange}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={4} lg={2}>
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  name="endDate"
                  label="End Date"
                  value={filters.endDate}
                  onChange={handleFilterChange}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={4} lg={2}>
                <TextField
                  fullWidth
                  size="small"
                  type="email"
                  name="userEmail"
                  label="User Email"
                  placeholder="user@example.com"
                  value={filters.userEmail}
                  onChange={handleFilterChange}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={4} lg={2}>
                <FormControl fullWidth size="small" sx={{ minWidth: 180 }}>
                  <InputLabel>Limit</InputLabel>
                  <Select
                    name="limit"
                    value={filters.limit}
                    onChange={handleFilterChange}
                    label="Limit"
                  >
                    <MenuItem value="50">50 records</MenuItem>
                    <MenuItem value="100">100 records</MenuItem>
                    <MenuItem value="250">250 records</MenuItem>
                    <MenuItem value="500">500 records</MenuItem>
                    <MenuItem value="">All records</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Box>

          <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              onClick={handleApplyFilters}
              startIcon={<FilterList />}
            >
              Apply Filters
            </Button>
            <Button
              variant="outlined"
              onClick={handleClearFilters}
              startIcon={<Clear />}
            >
              Clear Filters
            </Button>
            <Button
              variant="outlined"
              onClick={handleExport}
              startIcon={<Download />}
              sx={{ ml: 'auto' }}
            >
              Export to CSV
            </Button>
          </Box>

          {loading ? (
            <Box display="flex" justifyContent="center" alignItems="center" py={5}>
              <CircularProgress />
              <Typography variant="body1" sx={{ ml: 2 }}>
                Loading audit logs...
              </Typography>
            </Box>
          ) : logs.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 5 }}>
              <Description sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
              <Typography variant="body1" color="text.secondary">
                No audit logs found matching your criteria.
              </Typography>
            </Box>
          ) : (
            <TableContainer component={Paper} variant="outlined" sx={{ maxWidth: '100%' }}>
              <Table size={isMobile ? 'small' : 'medium'}>
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Timestamp</strong></TableCell>
                    <TableCell><strong>Action</strong></TableCell>
                    {!isMobile && <TableCell><strong>Entity Type</strong></TableCell>}
                    <TableCell><strong>Entity Name</strong></TableCell>
                    {!isMobile && <TableCell><strong>Details</strong></TableCell>}
                    {!isMobile && <TableCell><strong>User</strong></TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id} hover>
                      <TableCell>{formatDate(log.timestamp)}</TableCell>
                      <TableCell>
                        <Chip
                          label={log.action}
                          color={getActionColor(log.action)}
                          size="small"
                        />
                      </TableCell>
                      {!isMobile && (
                        <TableCell sx={{ textTransform: 'capitalize' }}>
                          {log.entity_type}
                        </TableCell>
                      )}
                      <TableCell>{log.entity_name || '-'}</TableCell>
                      {!isMobile && (
                        <TableCell sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {log.details}
                        </TableCell>
                      )}
                      {!isMobile && <TableCell>{log.user_email || '-'}</TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      )}

      {/* Summary Report View */}
      {activeView === 'summary' && (
        <>
          {loading ? (
            <Box display="flex" justifyContent="center" alignItems="center" py={5}>
              <CircularProgress />
              <Typography variant="body1" sx={{ ml: 2 }}>
                Loading summary...
              </Typography>
            </Box>
          ) : summary ? (
            <Grid container spacing={3}>
              {/* Total Assets */}
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ p: 3, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
                  <Typography variant="h6" gutterBottom>
                    Total Assets
                  </Typography>
                  <Typography variant="h3" fontWeight={700}>
                    {summary.total}
                  </Typography>
                </Card>
              </Grid>

              {/* By Status */}
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ p: 3, bgcolor: 'background.default' }}>
                  <Typography variant="h6" gutterBottom>
                    By Status
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {Object.entries(summary.by_status).map(([status, count]) => (
                      <Box key={status} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography sx={{ textTransform: 'capitalize' }} variant="body2">
                          {status}
                        </Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {count}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Card>
              </Grid>

              {/* By Company */}
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ p: 3, bgcolor: 'background.default' }}>
                  <Typography variant="h6" gutterBottom>
                    By Company
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {Object.entries(summary.by_company).map(([company, count]) => (
                      <Box key={company} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" noWrap sx={{ maxWidth: '70%' }}>
                          {company}
                        </Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {count}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Card>
              </Grid>

              {/* By Manager */}
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ p: 3, bgcolor: 'background.default' }}>
                  <Typography variant="h6" gutterBottom>
                    By Manager
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {Object.entries(summary.by_manager).slice(0, 10).map(([manager, count]) => (
                      <Box key={manager} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" noWrap sx={{ maxWidth: '70%' }}>
                          {manager}
                        </Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {count}
                        </Typography>
                      </Box>
                    ))}
                    {Object.keys(summary.by_manager).length > 10 && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        ...and {Object.keys(summary.by_manager).length - 10} more
                      </Typography>
                    )}
                  </Box>
                </Card>
              </Grid>
            </Grid>
          ) : null}
        </>
      )}

      {/* Statistics View */}
      {activeView === 'stats' && (
        <>
          <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
            <TextField
              size="small"
              type="date"
              name="startDate"
              label="Start Date"
              value={filters.startDate}
              onChange={handleFilterChange}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              size="small"
              type="date"
              name="endDate"
              label="End Date"
              value={filters.endDate}
              onChange={handleFilterChange}
              InputLabelProps={{ shrink: true }}
            />
            <Button
              variant="contained"
              onClick={handleApplyFilters}
              startIcon={<FilterList />}
            >
              Apply Filters
            </Button>
          </Box>

          {loading ? (
            <Box display="flex" justifyContent="center" alignItems="center" py={5}>
              <CircularProgress />
              <Typography variant="body1" sx={{ ml: 2 }}>
                Loading statistics...
              </Typography>
            </Box>
          ) : stats.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 5 }}>
              <BarChart sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
              <Typography variant="body1" color="text.secondary">
                No statistics available for the selected period.
              </Typography>
            </Box>
          ) : (
            <TableContainer component={Paper} variant="outlined" sx={{ maxWidth: '100%' }}>
              <Table size={isMobile ? 'small' : 'medium'}>
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Action</strong></TableCell>
                    <TableCell><strong>Entity Type</strong></TableCell>
                    <TableCell><strong>Count</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stats.map((stat, index) => (
                    <TableRow key={index} hover>
                      <TableCell>
                        <Chip
                          label={stat.action}
                          color={getActionColor(stat.action)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell sx={{ textTransform: 'capitalize' }}>
                        {stat.entity_type}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body1" fontWeight={600}>
                          {stat.count}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      )}
    </Card>
  );
};

export default AuditReporting;
