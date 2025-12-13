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
  AlertCircle
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function AttestationPage() {
  const { getAuthHeaders, user } = useAuth();
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDashboardModal, setShowDashboardModal] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    reminder_days: 7,
    escalation_days: 10
  });

  const loadCampaigns = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/attestation/campaigns', {
        headers: { ...getAuthHeaders() }
      });
      if (!res.ok) throw new Error('Failed to load campaigns');
      const data = await res.json();
      setCampaigns(data.campaigns || []);
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
      setFormData({
        name: '',
        description: '',
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
        reminder_days: 7,
        escalation_days: 10
      });
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

  const handleStartCampaign = async (campaignId) => {
    if (!confirm('Are you sure you want to start this campaign? Emails will be sent to all employees.')) {
      return;
    }

    try {
      const res = await fetch(`/api/attestation/campaigns/${campaignId}/start`, {
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
    }
  };

  const handleCancelCampaign = async (campaignId) => {
    if (!confirm('Are you sure you want to cancel this campaign?')) {
      return;
    }

    try {
      const res = await fetch(`/api/attestation/campaigns/${campaignId}/cancel`, {
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ClipboardCheck className="h-8 w-8" />
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
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Reminder</TableHead>
                  <TableHead>Escalation</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => (
                  <TableRow key={campaign.id}>
                    <TableCell className="font-medium">{campaign.name}</TableCell>
                    <TableCell>{getStatusBadge(campaign.status)}</TableCell>
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
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStartCampaign(campaign.id)}
                          >
                            <PlayCircle className="h-4 w-4 mr-1" />
                            Start
                          </Button>
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
                              onClick={() => handleCancelCampaign(campaign.id)}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Cancel
                            </Button>
                          </>
                        )}
                        {(campaign.status === 'completed' || campaign.status === 'cancelled') && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleExportCampaign(campaign.id, campaign.name)}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            Export
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Campaign Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Attestation Campaign</DialogTitle>
            <DialogDescription>
              Create a new campaign to request employees attest to their assets
            </DialogDescription>
          </DialogHeader>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateCampaign} disabled={!formData.name || !formData.start_date}>
              Create Campaign
            </Button>
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
    </div>
  );
}
