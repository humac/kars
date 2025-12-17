import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  ClipboardCheck, 
  Plus, 
  Loader2, 
  PlayCircle, 
  XCircle, 
  Download,
  Eye,
  Calendar,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  Edit,
  Trash2,
  Search,
  Bell,
  RefreshCw,
  AlertTriangle,
  Mail
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DashboardContent } from '@/components/DashboardContent';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

export default function AttestationPage() {
  const { getAuthHeaders, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);
  
  // Dashboard modal state
  const [showDashboardModal, setShowDashboardModal] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  
  const [campaignStats, setCampaignStats] = useState({});
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    reminder_days: 7,
    escalation_days: 10,
    unregistered_reminder_days: 7,
    target_type: 'all',
    target_user_ids: [],
    target_company_ids: []
  });
  
  const [wizardStep, setWizardStep] = useState(1);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [availableCompanies, setAvailableCompanies] = useState([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [companySearchQuery, setCompanySearchQuery] = useState('');
  
  // Alert dialog states
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [campaignToStart, setCampaignToStart] = useState(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [campaignToCancel, setCampaignToCancel] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState(null);

  // Helper function to parse target_user_ids
  const parseTargetUserIds = (targetUserIds) => {
    if (!targetUserIds) return [];
    try {
      return typeof targetUserIds === 'string' ? JSON.parse(targetUserIds) : targetUserIds;
    } catch (error) {
      console.error('Error parsing target_user_ids:', error);
      return [];
    }
  };

  // Helper function to parse target_company_ids
  const parseTargetCompanyIds = (targetCompanyIds) => {
    if (!targetCompanyIds) return [];
    try {
      return typeof targetCompanyIds === 'string' ? JSON.parse(targetCompanyIds) : targetCompanyIds;
    } catch (error) {
      console.error('Error parsing target_company_ids:', error);
      return [];
    }
  };

  // Helper function to get user count message for campaign start
  const getStartCampaignMessage = (campaign) => {
    if (!campaign) return '';
    
    if (campaign.target_type === 'companies' && campaign.target_company_ids) {
      const companyIds = parseTargetCompanyIds(campaign.target_company_ids);
      const count = companyIds.length;
      return `Emails will be sent to employees with assets in ${count} selected compan${count !== 1 ? 'ies' : 'y'}.`;
    }
    
    if (campaign.target_type === 'selected' && campaign.target_user_ids) {
      const targetIds = parseTargetUserIds(campaign.target_user_ids);
      const count = targetIds.length;
      return `Emails will be sent to ${count} selected employee${count !== 1 ? 's' : ''}.`;
    }
    return 'Emails will be sent to all employees.';
  };

  // Helper function to format progress display with pending invites
  const getProgressDisplay = (campaign, stats) => {
    if (!stats) return '-';
    
    const { completed, total } = stats;
    const pending_invites_count = campaign.pending_invites_count || 0;
    
    if (total === 0 && pending_invites_count > 0) {
      return `0/0 (${pending_invites_count} pending invite${pending_invites_count !== 1 ? 's' : ''})`;
    }
    
    if (pending_invites_count > 0) {
      return `${completed}/${total} (${pending_invites_count} pending invite${pending_invites_count !== 1 ? 's' : ''})`;
    }
    
    return `${completed}/${total} - ${total > 0 ? Math.round((completed / total) * 100) : 0}% Complete`;
  };

  const loadCampaigns = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/attestation/campaigns', {
        headers: { ...getAuthHeaders() }
      });
      if (!res.ok) throw new Error('Failed to load campaigns');
      const data = await res.json();
      const campaignsData = data.campaigns || [];
      setCampaigns(campaignsData);
      
      // Load stats for active campaigns in parallel
      const activeCampaigns = campaignsData.filter(c => c.status === 'active');
      const statsPromises = activeCampaigns.map(async (campaign) => {
        try {
          const statsRes = await fetch(`/api/attestation/campaigns/${campaign.id}/dashboard`, {
            headers: { ...getAuthHeaders() }
          });
          if (statsRes.ok) {
            const statsData = await statsRes.json();
            const records = statsData.records || [];
            const completed = records.filter(r => r.status === 'completed').length;
            const total = records.length;
            const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
            return { id: campaign.id, stats: { completed, total, percentage } };
          }
        } catch (err) {
          console.error(`Error loading stats for campaign ${campaign.id}:`, err);
        }
        return null;
      });
      
      const statsResults = await Promise.all(statsPromises);
      const stats = {};
      statsResults.forEach(result => {
        if (result) {
          stats[result.id] = result.stats;
        }
      });
      setCampaignStats(stats);
    } catch (err) {
      console.error(err);
      toast({
        title: 'Error',
        description: 'Failed to load attestation campaigns',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const canManageCampaigns = user?.role === 'admin';

  useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'manager') {
      loadCampaigns();
    }
  }, [user]);

  const loadUsers = async () => {
    try {
      const res = await fetch('/api/auth/users', {
        headers: { ...getAuthHeaders() }
      });
      if (!res.ok) throw new Error('Failed to load users');
      const data = await res.json();
      setAvailableUsers(data || []);
    } catch (err) {
      console.error(err);
      toast({
        title: 'Error',
        description: 'Failed to load users',
        variant: 'destructive'
      });
    }
  };

  const loadCompanies = async () => {
    try {
      const res = await fetch('/api/companies/names', {
        headers: { ...getAuthHeaders() }
      });
      if (!res.ok) throw new Error('Failed to load companies');
      const data = await res.json();
      setAvailableCompanies(data || []);
    } catch (err) {
      console.error(err);
      toast({
        title: 'Error',
        description: 'Failed to load companies',
        variant: 'destructive'
      });
    }
  };

  // Helper function to filter companies by search query
  const filterCompaniesBySearch = (companies, searchQuery) => {
    return companies.filter(c => 
      searchQuery === '' ||
      c.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const handleCreateCampaign = async () => {
    try {
      const res = await fetch('/api/attestation/campaigns', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!res.ok) throw new Error('Failed to create campaign');

      toast({
        title: 'Success',
        description: 'Campaign created successfully'
      });

      setShowCreateModal(false);
      setWizardStep(1);
      setFormData({
        name: '',
        description: '',
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
        reminder_days: 7,
        escalation_days: 10,
        unregistered_reminder_days: 7,
        target_type: 'all',
        target_user_ids: [],
        target_company_ids: []
      });
      setUserSearchQuery('');
      setCompanySearchQuery('');
      loadCampaigns();
    } catch (err) {
      console.error(err);
      toast({
        title: 'Error',
        description: 'Failed to create campaign',
        variant: 'destructive'
      });
    }
  };

  const handleStartCampaignClick = (campaign) => {
    setCampaignToStart(campaign);
    setShowStartDialog(true);
  };

  const handleStartCampaign = async () => {
    if (!campaignToStart) return;

    try {
      const res = await fetch(`/api/attestation/campaigns/${campaignToStart.id}/start`, {
        method: 'POST',
        headers: { ...getAuthHeaders() }
      });

      if (!res.ok) throw new Error('Failed to start campaign');

      const data = await res.json();
      toast({
        title: 'Campaign Started',
        description: `Created ${data.recordsCreated} attestation records and sent ${data.emailsSent} emails`
      });

      loadCampaigns();
    } catch (err) {
      console.error(err);
      toast({
        title: 'Error',
        description: 'Failed to start campaign',
        variant: 'destructive'
      });
    } finally {
      setShowStartDialog(false);
      setCampaignToStart(null);
    }
  };

  const handleCancelCampaignClick = (campaign) => {
    setCampaignToCancel(campaign);
    setShowCancelDialog(true);
  };

  const handleCancelCampaign = async () => {
    if (!campaignToCancel) return;

    try {
      const res = await fetch(`/api/attestation/campaigns/${campaignToCancel.id}/cancel`, {
        method: 'POST',
        headers: { ...getAuthHeaders() }
      });

      if (!res.ok) throw new Error('Failed to cancel campaign');

      toast({
        title: 'Success',
        description: 'Campaign cancelled successfully'
      });

      loadCampaigns();
    } catch (err) {
      console.error(err);
      toast({
        title: 'Error',
        description: 'Failed to cancel campaign',
        variant: 'destructive'
      });
    } finally {
      setShowCancelDialog(false);
      setCampaignToCancel(null);
    }
  };

  const handleDeleteCampaignClick = (campaign) => {
    setCampaignToDelete(campaign);
    setShowDeleteDialog(true);
  };

  const handleDeleteCampaign = async () => {
    if (!campaignToDelete) return;

    try {
      const res = await fetch(`/api/attestation/campaigns/${campaignToDelete.id}`, {
        method: 'DELETE',
        headers: { ...getAuthHeaders() }
      });

      if (!res.ok) throw new Error('Failed to delete campaign');

      toast({
        title: 'Success',
        description: 'Campaign deleted successfully'
      });

      loadCampaigns();
    } catch (err) {
      console.error(err);
      toast({
        title: 'Error',
        description: 'Failed to delete campaign',
        variant: 'destructive'
      });
    } finally {
      setShowDeleteDialog(false);
      setCampaignToDelete(null);
    }
  };

  const handleEditCampaignClick = (campaign) => {
    // Parse target_user_ids and target_company_ids using helper functions
    const targetUserIds = parseTargetUserIds(campaign.target_user_ids);
    const targetCompanyIds = parseTargetCompanyIds(campaign.target_company_ids);

    setEditingCampaign(campaign);
    setFormData({
      name: campaign.name || '',
      description: campaign.description || '',
      start_date: campaign.start_date ? new Date(campaign.start_date).toISOString().split('T')[0] : '',
      end_date: campaign.end_date ? new Date(campaign.end_date).toISOString().split('T')[0] : '',
      reminder_days: campaign.reminder_days || 7,
      escalation_days: campaign.escalation_days || 10,
      unregistered_reminder_days: campaign.unregistered_reminder_days || 7,
      target_type: campaign.target_type || 'all',
      target_user_ids: targetUserIds,
      target_company_ids: targetCompanyIds
    });
    setWizardStep(1);
    setShowEditModal(true);
    
    // Load users if target type is selected
    if (campaign.target_type === 'selected' && availableUsers.length === 0) {
      loadUsers();
    }
    
    // Load companies if target type is companies
    if (campaign.target_type === 'companies' && availableCompanies.length === 0) {
      loadCompanies();
    }
  };

  const handleUpdateCampaign = async () => {
    try {
      const res = await fetch(`/api/attestation/campaigns/${editingCampaign.id}`, {
        method: 'PUT',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!res.ok) throw new Error('Failed to update campaign');

      toast({
        title: 'Success',
        description: 'Campaign updated successfully'
      });

      setShowEditModal(false);
      setWizardStep(1);
      setEditingCampaign(null);
      setFormData({
        name: '',
        description: '',
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
        reminder_days: 7,
        escalation_days: 10,
        unregistered_reminder_days: 7,
        target_type: 'all',
        target_user_ids: [],
        target_company_ids: []
      });
      setUserSearchQuery('');
      setCompanySearchQuery('');
      loadCampaigns();
    } catch (err) {
      console.error(err);
      toast({
        title: 'Error',
        description: 'Failed to update campaign',
        variant: 'destructive'
      });
    }
  };

  // Simple handler to open dashboard modal
  const handleViewDashboard = (campaign) => {
    setSelectedCampaign(campaign);
    setShowDashboardModal(true);
  };

  const handleExportCampaign = async (campaignId, campaignName) => {
    try {
      const res = await fetch(`/api/attestation/campaigns/${campaignId}/export`, {
        headers: { ...getAuthHeaders() }
      });

      if (!res.ok) throw new Error('Failed to export campaign');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attestation-${campaignName.replace(/[^a-z0-9]/gi, '-')}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'Success',
        description: 'Campaign exported successfully'
      });
    } catch (err) {
      console.error(err);
      toast({
        title: 'Error',
        description: 'Failed to export campaign',
        variant: 'destructive'
      });
    }
  };

  const getStatusBadge = (status) => {
    const variants = {
      draft: 'secondary',
      active: 'default',
      completed: 'outline',
      cancelled: 'destructive'
    };

    return (
      <Badge variant={variants[status] || 'secondary'}>
        {status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!canManageCampaigns && (
        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-100">Read-Only Access</h3>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                You have read-only access to attestation campaigns. Contact an admin to create or modify campaigns.
              </p>
            </div>
          </div>
        </div>
      )}
      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              <CardTitle>Attestation Campaigns ({campaigns.length})</CardTitle>
            </div>
            {canManageCampaigns && (
              <div className="flex gap-2 flex-wrap">
                <Button onClick={() => setShowCreateModal(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Campaign
                </Button>
              </div>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Manage asset attestation campaigns and track employee compliance
          </p>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <div className="text-center py-12">
              <ClipboardCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No campaigns yet</h3>
              <p className="text-muted-foreground mb-4">
                {canManageCampaigns 
                  ? 'Create your first attestation campaign to get started'
                  : 'No attestation campaigns have been created yet'}
              </p>
              {canManageCampaigns && (
                <Button onClick={() => setShowCreateModal(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Campaign
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Reminder</TableHead>
                  <TableHead>Escalation</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => {
                  const stats = campaignStats[campaign.id];
                  return (
                  <TableRow key={campaign.id}>
                    <TableCell className="font-medium">{campaign.name}</TableCell>
                    <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                    <TableCell>
                      {campaign.status === 'active' && stats ? (
                        <div className="space-y-1 w-44">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{getProgressDisplay(campaign, stats)}</span>
                          </div>
                          {stats.total > 0 && (
                            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                              <div 
                                className="bg-primary h-full transition-all duration-300 rounded-full"
                                style={{ width: `${stats.percentage}%` }}
                              />
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(campaign.start_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {campaign.end_date 
                        ? new Date(campaign.end_date).toLocaleDateString() 
                        : '-'}
                    </TableCell>
                    <TableCell>{campaign.reminder_days} days</TableCell>
                    <TableCell>{campaign.escalation_days} days</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {campaign.status === 'draft' && (
                          <>
                            {canManageCampaigns && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEditCampaignClick(campaign)}
                                >
                                  <Edit className="h-4 w-4 mr-1" />
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleStartCampaignClick(campaign)}
                                >
                                  <PlayCircle className="h-4 w-4 mr-1" />
                                  Start
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleDeleteCampaignClick(campaign)}
                                >
                                  <Trash2 className="h-4 w-4 mr-1" />
                                  Delete
                                </Button>
                              </>
                            )}
                          </>
                        )}
                        {campaign.status === 'active' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewDashboard(campaign)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View Dashboard
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleExportCampaign(campaign.id, campaign.name)}
                            >
                              <Download className="h-4 w-4 mr-1" />
                              Export
                            </Button>
                            {canManageCampaigns && (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleCancelCampaignClick(campaign)}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Cancel
                              </Button>
                            )}
                          </>
                        )}
                        {(campaign.status === 'completed' || campaign.status === 'cancelled') && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleExportCampaign(campaign.id, campaign.name)}
                            >
                              <Download className="h-4 w-4 mr-1" />
                              Export
                            </Button>
                            {canManageCampaigns && (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDeleteCampaignClick(campaign)}
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Delete
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Campaign Modal - Multi-Step Wizard */}
      <Dialog open={showCreateModal} onOpenChange={(open) => {
        setShowCreateModal(open);
        if (!open) {
          setWizardStep(1);
          setUserSearchQuery('');
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Attestation Campaign - Step {wizardStep} of 2</DialogTitle>
            <DialogDescription>
              {wizardStep === 1 ? 'Configure campaign details' : 'Select target employees'}
            </DialogDescription>
          </DialogHeader>
          
          {/* Step 1: Campaign Details */}
          {wizardStep === 1 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Campaign Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Q1 2025 Asset Attestation"
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Provide additional context for employees..."
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_date">Start Date *</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="end_date">End Date (Optional)</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="reminder_days">Reminder (days)</Label>
                  <Input
                    id="reminder_days"
                    type="number"
                    min="1"
                    value={formData.reminder_days}
                    onChange={(e) => setFormData({ ...formData, reminder_days: parseInt(e.target.value) || 7 })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Send reminder to registered users after X days
                  </p>
                </div>
                <div>
                  <Label htmlFor="escalation_days">Escalation (days)</Label>
                  <Input
                    id="escalation_days"
                    type="number"
                    min="1"
                    value={formData.escalation_days}
                    onChange={(e) => setFormData({ ...formData, escalation_days: parseInt(e.target.value) || 10 })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Notify manager after X days
                  </p>
                </div>
                <div className="col-span-2">
                  <Label htmlFor="unregistered_reminder_days">Unregistered Owner Reminder (days)</Label>
                  <Input
                    id="unregistered_reminder_days"
                    type="number"
                    min="1"
                    value={formData.unregistered_reminder_days}
                    onChange={(e) => setFormData({ ...formData, unregistered_reminder_days: parseInt(e.target.value) || 7 })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Send reminder to unregistered asset owners after X days
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Step 2: Target Selection */}
          {wizardStep === 2 && (
            <div className="space-y-4">
              <RadioGroup
                value={formData.target_type}
                onValueChange={(value) => {
                  setFormData({ ...formData, target_type: value, target_user_ids: [], target_company_ids: [] });
                  if (value === 'selected' && availableUsers.length === 0) {
                    loadUsers();
                  }
                  if (value === 'companies' && availableCompanies.length === 0) {
                    loadCompanies();
                  }
                }}
              >
                <div className="flex items-center space-x-2 p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
                  <RadioGroupItem value="all" id="target-all" />
                  <Label htmlFor="target-all" className="flex-1 cursor-pointer">
                    <div className="font-medium">All Employees (System-wide)</div>
                    <div className="text-sm text-muted-foreground">
                      Send attestation request to all registered users
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
                  <RadioGroupItem value="selected" id="target-selected" />
                  <Label htmlFor="target-selected" className="flex-1 cursor-pointer">
                    <div className="font-medium">Select Specific Employees</div>
                    <div className="text-sm text-muted-foreground">
                      Choose individual employees to receive the attestation request
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
                  <RadioGroupItem value="companies" id="target-companies" />
                  <Label htmlFor="target-companies" className="flex-1 cursor-pointer">
                    <div className="font-medium">By Company</div>
                    <div className="text-sm text-muted-foreground">
                      Send attestation to employees with assets in specific companies
                    </div>
                  </Label>
                </div>
              </RadioGroup>
              
              {formData.target_type === 'selected' && (
                <div className="space-y-3 mt-4">
                  <div>
                    <Label htmlFor="user-search">Search Employees</Label>
                    <Input
                      id="user-search"
                      type="text"
                      placeholder="Search by name or email..."
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                    />
                  </div>
                  
                  {availableUsers.length === 0 ? (
                    <div className="flex items-center justify-center py-8 text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin mr-2" />
                      Loading users...
                    </div>
                  ) : (
                    <div className="border rounded-lg max-h-64 overflow-y-auto">
                      <div className="p-2 space-y-1">
                        {availableUsers
                          .filter(u => 
                            userSearchQuery === '' ||
                            u.name?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                            u.email?.toLowerCase().includes(userSearchQuery.toLowerCase())
                          )
                          .map((u) => (
                            <div
                              key={u.id}
                              className="flex items-center space-x-2 p-2 hover:bg-muted/50 rounded cursor-pointer"
                              onClick={() => {
                                const isSelected = formData.target_user_ids.includes(u.id);
                                setFormData({
                                  ...formData,
                                  target_user_ids: isSelected
                                    ? formData.target_user_ids.filter(id => id !== u.id)
                                    : [...formData.target_user_ids, u.id]
                                });
                              }}
                            >
                              <Checkbox
                                checked={formData.target_user_ids.includes(u.id)}
                                readOnly
                              />
                              <div className="flex-1">
                                <div className="font-medium text-sm">{u.name}</div>
                                <div className="text-xs text-muted-foreground">{u.email}</div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                  
                  {formData.target_user_ids.length > 0 && (
                    <div className="text-sm text-muted-foreground">
                      Selected: {formData.target_user_ids.length} employee{formData.target_user_ids.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              )}
              
              {formData.target_type === 'companies' && (
                <div className="space-y-3 mt-4">
                  <div>
                    <Label htmlFor="company-search">Search Companies</Label>
                    <Input
                      id="company-search"
                      type="text"
                      placeholder="Search by company name..."
                      value={companySearchQuery}
                      onChange={(e) => setCompanySearchQuery(e.target.value)}
                    />
                  </div>
                  
                  {availableCompanies.length === 0 ? (
                    <div className="flex items-center justify-center py-8 text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin mr-2" />
                      Loading companies...
                    </div>
                  ) : (
                    <div className="border rounded-lg max-h-64 overflow-y-auto">
                      <div className="p-2 space-y-1">
                        {filterCompaniesBySearch(availableCompanies, companySearchQuery)
                          .map((c) => (
                            <div
                              key={c.id}
                              className="flex items-center space-x-2 p-2 hover:bg-muted/50 rounded cursor-pointer"
                              onClick={() => {
                                const isSelected = formData.target_company_ids.includes(c.id);
                                setFormData({
                                  ...formData,
                                  target_company_ids: isSelected
                                    ? formData.target_company_ids.filter(id => id !== c.id)
                                    : [...formData.target_company_ids, c.id]
                                });
                              }}
                            >
                              <Checkbox
                                checked={formData.target_company_ids.includes(c.id)}
                                readOnly
                              />
                              <div className="flex-1">
                                <div className="font-medium text-sm">{c.name}</div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                  
                  {formData.target_company_ids.length > 0 && (
                    <div className="text-sm text-muted-foreground">
                      Selected: {formData.target_company_ids.length} compan{formData.target_company_ids.length !== 1 ? 'ies' : 'y'}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            {wizardStep === 1 ? (
              <>
                <Button variant="outline" onClick={() => {
                  setShowCreateModal(false);
                  setWizardStep(1);
                }}>
                  Cancel
                </Button>
                <Button 
                  onClick={() => setWizardStep(2)} 
                  disabled={!formData.name || !formData.start_date}
                >
                  Next
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setWizardStep(1)}>
                  Back
                </Button>
                <Button 
                  onClick={handleCreateCampaign}
                  disabled={
                    (formData.target_type === 'selected' && formData.target_user_ids.length === 0) ||
                    (formData.target_type === 'companies' && formData.target_company_ids.length === 0)
                  }
                >
                  Create Campaign
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dashboard Modal */}
      <Dialog 
        open={showDashboardModal} 
        onOpenChange={(open) => {
          setShowDashboardModal(open);
          if (!open) {
            setSelectedCampaign(null);
          }
        }}
      >
        <DialogContent className="w-[95vw] max-w-7xl h-[92vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4">
            <DialogTitle className="text-2xl">
              Campaign Dashboard: {selectedCampaign?.name}
            </DialogTitle>
            <DialogDescription>
              View completion status and employee details
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            <DashboardContent 
              campaign={selectedCampaign} 
              compact={false}
              onClose={() => setShowDashboardModal(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Campaign Modal - Multi-Step Wizard */}
      <Dialog open={showEditModal} onOpenChange={(open) => {
        setShowEditModal(open);
        if (!open) {
          setWizardStep(1);
          setUserSearchQuery('');
          setCompanySearchQuery('');
          setEditingCampaign(null);
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Campaign - Step {wizardStep} of 2</DialogTitle>
            <DialogDescription>
              {wizardStep === 1 ? 'Update campaign details' : 'Update target employees'}
            </DialogDescription>
          </DialogHeader>
          
          {/* Step 1: Campaign Details */}
          {wizardStep === 1 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Campaign Name *</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Q1 2025 Asset Attestation"
                />
              </div>
              <div>
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Provide additional context for employees..."
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-start_date">Start Date *</Label>
                  <Input
                    id="edit-start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-end_date">End Date (Optional)</Label>
                  <Input
                    id="edit-end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-reminder_days">Reminder (days)</Label>
                  <Input
                    id="edit-reminder_days"
                    type="number"
                    min="1"
                    value={formData.reminder_days}
                    onChange={(e) => setFormData({ ...formData, reminder_days: parseInt(e.target.value) || 7 })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Send reminder to registered users after X days
                  </p>
                </div>
                <div>
                  <Label htmlFor="edit-escalation_days">Escalation (days)</Label>
                  <Input
                    id="edit-escalation_days"
                    type="number"
                    min="1"
                    value={formData.escalation_days}
                    onChange={(e) => setFormData({ ...formData, escalation_days: parseInt(e.target.value) || 10 })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Notify manager after X days
                  </p>
                </div>
                <div className="col-span-2">
                  <Label htmlFor="edit-unregistered_reminder_days">Unregistered Owner Reminder (days)</Label>
                  <Input
                    id="edit-unregistered_reminder_days"
                    type="number"
                    min="1"
                    value={formData.unregistered_reminder_days}
                    onChange={(e) => setFormData({ ...formData, unregistered_reminder_days: parseInt(e.target.value) || 7 })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Send reminder to unregistered asset owners after X days
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Step 2: Target Selection */}
          {wizardStep === 2 && (
            <div className="space-y-4">
              <RadioGroup
                value={formData.target_type}
                onValueChange={(value) => {
                  setFormData({ ...formData, target_type: value, target_user_ids: [], target_company_ids: [] });
                  if (value === 'selected' && availableUsers.length === 0) {
                    loadUsers();
                  }
                  if (value === 'companies' && availableCompanies.length === 0) {
                    loadCompanies();
                  }
                }}
              >
                <div className="flex items-center space-x-2 p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
                  <RadioGroupItem value="all" id="edit-target-all" />
                  <Label htmlFor="edit-target-all" className="flex-1 cursor-pointer">
                    <div className="font-medium">All Employees (System-wide)</div>
                    <div className="text-sm text-muted-foreground">
                      Send attestation request to all registered users
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
                  <RadioGroupItem value="selected" id="edit-target-selected" />
                  <Label htmlFor="edit-target-selected" className="flex-1 cursor-pointer">
                    <div className="font-medium">Select Specific Employees</div>
                    <div className="text-sm text-muted-foreground">
                      Choose individual employees to receive the attestation request
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
                  <RadioGroupItem value="companies" id="edit-target-companies" />
                  <Label htmlFor="edit-target-companies" className="flex-1 cursor-pointer">
                    <div className="font-medium">By Company</div>
                    <div className="text-sm text-muted-foreground">
                      Send attestation to employees with assets in specific companies
                    </div>
                  </Label>
                </div>
              </RadioGroup>
              
              {formData.target_type === 'selected' && (
                <div className="space-y-3 mt-4">
                  <div>
                    <Label htmlFor="edit-user-search">Search Employees</Label>
                    <Input
                      id="edit-user-search"
                      type="text"
                      placeholder="Search by name or email..."
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                    />
                  </div>
                  
                  {availableUsers.length === 0 ? (
                    <div className="flex items-center justify-center py-8 text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin mr-2" />
                      Loading users...
                    </div>
                  ) : (
                    <div className="border rounded-lg max-h-64 overflow-y-auto">
                      <div className="p-2 space-y-1">
                        {availableUsers
                          .filter(u => 
                            userSearchQuery === '' ||
                            u.name?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                            u.email?.toLowerCase().includes(userSearchQuery.toLowerCase())
                          )
                          .map((u) => (
                            <div
                              key={u.id}
                              className="flex items-center space-x-2 p-2 hover:bg-muted/50 rounded cursor-pointer"
                              onClick={() => {
                                const isSelected = formData.target_user_ids.includes(u.id);
                                setFormData({
                                  ...formData,
                                  target_user_ids: isSelected
                                    ? formData.target_user_ids.filter(id => id !== u.id)
                                    : [...formData.target_user_ids, u.id]
                                });
                              }}
                            >
                              <Checkbox
                                checked={formData.target_user_ids.includes(u.id)}
                                readOnly
                              />
                              <div className="flex-1">
                                <div className="font-medium text-sm">{u.name}</div>
                                <div className="text-xs text-muted-foreground">{u.email}</div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                  
                  {formData.target_user_ids.length > 0 && (
                    <div className="text-sm text-muted-foreground">
                      Selected: {formData.target_user_ids.length} employee{formData.target_user_ids.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              )}
              
              {formData.target_type === 'companies' && (
                <div className="space-y-3 mt-4">
                  <div>
                    <Label htmlFor="edit-company-search">Search Companies</Label>
                    <Input
                      id="edit-company-search"
                      type="text"
                      placeholder="Search by company name..."
                      value={companySearchQuery}
                      onChange={(e) => setCompanySearchQuery(e.target.value)}
                    />
                  </div>
                  
                  {availableCompanies.length === 0 ? (
                    <div className="flex items-center justify-center py-8 text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin mr-2" />
                      Loading companies...
                    </div>
                  ) : (
                    <div className="border rounded-lg max-h-64 overflow-y-auto">
                      <div className="p-2 space-y-1">
                        {filterCompaniesBySearch(availableCompanies, companySearchQuery)
                          .map((c) => (
                            <div
                              key={c.id}
                              className="flex items-center space-x-2 p-2 hover:bg-muted/50 rounded cursor-pointer"
                              onClick={() => {
                                const isSelected = formData.target_company_ids.includes(c.id);
                                setFormData({
                                  ...formData,
                                  target_company_ids: isSelected
                                    ? formData.target_company_ids.filter(id => id !== c.id)
                                    : [...formData.target_company_ids, c.id]
                                });
                              }}
                            >
                              <Checkbox
                                checked={formData.target_company_ids.includes(c.id)}
                                readOnly
                              />
                              <div className="flex-1">
                                <div className="font-medium text-sm">{c.name}</div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                  
                  {formData.target_company_ids.length > 0 && (
                    <div className="text-sm text-muted-foreground">
                      Selected: {formData.target_company_ids.length} compan{formData.target_company_ids.length !== 1 ? 'ies' : 'y'}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            {wizardStep === 1 ? (
              <>
                <Button variant="outline" onClick={() => {
                  setShowEditModal(false);
                  setWizardStep(1);
                  setEditingCampaign(null);
                }}>
                  Cancel
                </Button>
                <Button 
                  onClick={() => setWizardStep(2)} 
                  disabled={!formData.name || !formData.start_date}
                >
                  Next
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setWizardStep(1)}>
                  Back
                </Button>
                <Button 
                  onClick={handleUpdateCampaign}
                  disabled={
                    (formData.target_type === 'selected' && formData.target_user_ids.length === 0) ||
                    (formData.target_type === 'companies' && formData.target_company_ids.length === 0)
                  }
                >
                  Update Campaign
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Start Campaign Confirmation Dialog */}
      <AlertDialog open={showStartDialog} onOpenChange={setShowStartDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start Campaign</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to start the campaign "{campaignToStart?.name}"?
              {campaignToStart && (
                <div className="mt-2 text-sm font-medium">
                  {getStartCampaignMessage(campaignToStart)}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleStartCampaign}>
              Start Campaign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Campaign Confirmation Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Campaign</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel the campaign "{campaignToCancel?.name}"?
              <div className="mt-2 text-sm font-medium text-destructive">
                This action cannot be undone.
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Campaign</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelCampaign} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Cancel Campaign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Campaign Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete the campaign "{campaignToDelete?.name}"?
              <div className="mt-2 text-sm font-medium text-destructive">
                This will also remove all attestation records associated with this campaign from all employees. This action cannot be undone.
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCampaign} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Campaign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
