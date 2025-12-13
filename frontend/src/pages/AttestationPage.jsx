import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
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
  Trash2
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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

export default function AttestationPage() {
  const { getAuthHeaders, user } = useAuth();
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [showDashboardModal, setShowDashboardModal] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [campaignStats, setCampaignStats] = useState({});
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    reminder_days: 7,
    escalation_days: 10,
    target_type: 'all',
    target_user_ids: []
  });
  
  const [wizardStep, setWizardStep] = useState(1);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  
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

  // Helper function to get user count message for campaign start
  const getStartCampaignMessage = (campaign) => {
    if (!campaign) return '';
    
    if (campaign.target_type === 'selected' && campaign.target_user_ids) {
      const targetIds = parseTargetUserIds(campaign.target_user_ids);
      const count = targetIds.length;
      return `Emails will be sent to ${count} selected employee${count !== 1 ? 's' : ''}.`;
    }
    return 'Emails will be sent to all employees.';
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

  useEffect(() => {
    if (user?.role === 'admin') {
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
        target_type: 'all',
        target_user_ids: []
      });
      setUserSearchQuery('');
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
    // Parse target_user_ids using helper function
    const targetUserIds = parseTargetUserIds(campaign.target_user_ids);

    setEditingCampaign(campaign);
    setFormData({
      name: campaign.name || '',
      description: campaign.description || '',
      start_date: campaign.start_date ? new Date(campaign.start_date).toISOString().split('T')[0] : '',
      end_date: campaign.end_date ? new Date(campaign.end_date).toISOString().split('T')[0] : '',
      reminder_days: campaign.reminder_days || 7,
      escalation_days: campaign.escalation_days || 10,
      target_type: campaign.target_type || 'all',
      target_user_ids: targetUserIds
    });
    setWizardStep(1);
    setShowEditModal(true);
    
    // Load users if target type is selected
    if (campaign.target_type === 'selected' && availableUsers.length === 0) {
      loadUsers();
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
        target_type: 'all',
        target_user_ids: []
      });
      setUserSearchQuery('');
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

  const handleViewDashboard = async (campaign) => {
    setSelectedCampaign(campaign);
    setShowDashboardModal(true);
    setLoadingDashboard(true);

    try {
      const res = await fetch(`/api/attestation/campaigns/${campaign.id}/dashboard`, {
        headers: { ...getAuthHeaders() }
      });

      if (!res.ok) throw new Error('Failed to load dashboard');

      const data = await res.json();
      setDashboardData(data);
    } catch (err) {
      console.error(err);
      toast({
        title: 'Error',
        description: 'Failed to load campaign dashboard',
        variant: 'destructive'
      });
    } finally {
      setLoadingDashboard(false);
    }
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
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6" />
            Attestation Campaigns
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage asset attestation campaigns and track employee compliance
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Campaign
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <div className="text-center py-12">
              <ClipboardCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No campaigns yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first attestation campaign to get started
              </p>
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Campaign
              </Button>
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
                            <span>{stats.completed}/{stats.total} - {stats.percentage}% Complete</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                            <div 
                              className="bg-primary h-full transition-all duration-300 rounded-full"
                              style={{ width: `${stats.percentage}%` }}
                            />
                          </div>
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
                        {campaign.status === 'active' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewDashboard(campaign)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Dashboard
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleExportCampaign(campaign.id, campaign.name)}
                            >
                              <Download className="h-4 w-4 mr-1" />
                              Export
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleCancelCampaignClick(campaign)}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Cancel
                            </Button>
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
                    Send reminder after X days
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
              </div>
            </div>
          )}
          
          {/* Step 2: Target Selection */}
          {wizardStep === 2 && (
            <div className="space-y-4">
              <RadioGroup
                value={formData.target_type}
                onValueChange={(value) => {
                  setFormData({ ...formData, target_type: value, target_user_ids: [] });
                  if (value === 'selected' && availableUsers.length === 0) {
                    loadUsers();
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
                  disabled={formData.target_type === 'selected' && formData.target_user_ids.length === 0}
                >
                  Create Campaign
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dashboard Modal */}
      <Dialog open={showDashboardModal} onOpenChange={setShowDashboardModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Campaign Dashboard: {selectedCampaign?.name}</DialogTitle>
            <DialogDescription>
              View completion status and employee details
            </DialogDescription>
          </DialogHeader>
          {loadingDashboard ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : dashboardData ? (
            <div className="space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total Employees
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-muted-foreground" />
                      <span className="text-2xl font-bold">
                        {dashboardData.records?.length || 0}
                      </span>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Completed
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <span className="text-2xl font-bold">
                        {dashboardData.records?.filter(r => r.status === 'completed').length || 0}
                      </span>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Pending
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-orange-600" />
                      <span className="text-2xl font-bold">
                        {dashboardData.records?.filter(r => r.status === 'pending').length || 0}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Employee Records Table */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Employee Records</h3>
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Completed</TableHead>
                        <TableHead>Reminder</TableHead>
                        <TableHead>Escalation</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dashboardData.records?.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell className="font-medium">{record.user_name}</TableCell>
                          <TableCell>{record.user_email}</TableCell>
                          <TableCell>{getStatusBadge(record.status)}</TableCell>
                          <TableCell>
                            {record.completed_at 
                              ? new Date(record.completed_at).toLocaleString()
                              : '-'}
                          </TableCell>
                          <TableCell>
                            {record.reminder_sent_at ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell>
                            {record.escalation_sent_at ? (
                              <AlertCircle className="h-4 w-4 text-orange-600" />
                            ) : (
                              '-'
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Edit Campaign Modal - Multi-Step Wizard */}
      <Dialog open={showEditModal} onOpenChange={(open) => {
        setShowEditModal(open);
        if (!open) {
          setWizardStep(1);
          setUserSearchQuery('');
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
                    Send reminder after X days
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
              </div>
            </div>
          )}
          
          {/* Step 2: Target Selection */}
          {wizardStep === 2 && (
            <div className="space-y-4">
              <RadioGroup
                value={formData.target_type}
                onValueChange={(value) => {
                  setFormData({ ...formData, target_type: value, target_user_ids: [] });
                  if (value === 'selected' && availableUsers.length === 0) {
                    loadUsers();
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
                  disabled={formData.target_type === 'selected' && formData.target_user_ids.length === 0}
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
