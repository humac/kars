import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, Edit, RotateCcw, Eye, Copy } from 'lucide-react';

const EmailTemplates = () => {
  const { getAuthHeaders } = useAuth();
  const { toast } = useToast();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState(null);
  
  const [editForm, setEditForm] = useState({
    subject: '',
    html_body: '',
    text_body: ''
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/admin/email-templates', {
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
      }
    } catch (err) {
      toast({ title: "Error", description: 'Failed to load email templates', variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (template) => {
    setSelectedTemplate(template);
    setEditForm({
      subject: template.subject,
      html_body: template.html_body,
      text_body: template.text_body
    });
    setEditDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editForm.subject || !editForm.html_body || !editForm.text_body) {
      toast({
        title: "Validation Error",
        description: 'All fields are required',
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/admin/email-templates/${selectedTemplate.template_key}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(editForm)
      });

      if (response.ok) {
        toast({ title: "Success", description: 'Email template updated successfully!' });
        setEditDialogOpen(false);
        fetchTemplates();
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update template');
      }
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/email-templates/${selectedTemplate.template_key}/reset`, {
        method: 'POST',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        toast({ title: "Success", description: 'Email template reset to default!' });
        setResetDialogOpen(false);
        setEditDialogOpen(false);
        fetchTemplates();
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to reset template');
      }
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    setPreviewing(true);
    try {
      const response = await fetch(`/api/admin/email-templates/${selectedTemplate.template_key}/preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(editForm)
      });

      if (response.ok) {
        const data = await response.json();
        setPreview(data.preview);
        setPreviewDialogOpen(true);
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate preview');
      }
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setPreviewing(false);
    }
  };

  const insertVariable = (variable, field) => {
    const varText = `{{${variable}}}`;
    setEditForm(prev => ({
      ...prev,
      [field]: prev[field] + varText
    }));
  };

  const getVariablesForTemplate = (templateKey) => {
    const variableMap = {
      test_email: ['siteName', 'smtpHost', 'smtpPort', 'timestamp'],
      password_reset: ['siteName', 'resetUrl', 'expiryTime'],
      attestation_launch: ['siteName', 'campaignName', 'campaignDescription', 'attestationUrl'],
      attestation_reminder: ['siteName', 'campaignName', 'attestationUrl'],
      attestation_escalation: ['siteName', 'campaignName', 'employeeName', 'employeeEmail', 'escalationDays'],
      attestation_complete: ['siteName', 'campaignName', 'employeeName', 'employeeEmail', 'completedAt']
    };
    return variableMap[templateKey] || [];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold mb-1">Email Templates</h3>
        <p className="text-sm text-muted-foreground">Customize email templates sent by the system</p>
      </div>

      <div className="grid gap-3">
        {templates.map((template) => (
          <div key={template.id} className="rounded-lg border p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-sm font-medium">{template.name}</h4>
                  {template.is_custom ? (
                    <Badge variant="secondary" className="text-xs">Custom</Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">Default</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{template.description}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  <strong>Subject:</strong> {template.subject}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleEdit(template)}
              >
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Email Template: {selectedTemplate?.name}</DialogTitle>
            <DialogDescription>
              Customize the email template. Use variables like {'{'}{'{'} variableName {'}'}{'}'}  for dynamic content.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Subject */}
            <div className="space-y-2">
              <Label htmlFor="subject">Subject Line</Label>
              <Input
                id="subject"
                value={editForm.subject}
                onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })}
                disabled={saving}
              />
            </div>

            {/* Available Variables */}
            {selectedTemplate && (
              <div className="rounded-lg border p-3 bg-muted/50">
                <Label className="text-xs font-medium mb-2 block">Available Variables</Label>
                <div className="flex flex-wrap gap-1">
                  {getVariablesForTemplate(selectedTemplate.template_key).map((variable) => (
                    <Button
                      key={variable}
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => insertVariable(variable, 'html_body')}
                      disabled={saving}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      {'{'}{'{'}{variable}{'}'}{'}'} 
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Click a variable to insert it into the HTML body field
                </p>
              </div>
            )}

            {/* Tabs for HTML and Text */}
            <Tabs defaultValue="html" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="html">HTML Body</TabsTrigger>
                <TabsTrigger value="text">Plain Text Body</TabsTrigger>
              </TabsList>
              <TabsContent value="html" className="space-y-2">
                <Label htmlFor="html_body">HTML Body</Label>
                <Textarea
                  id="html_body"
                  value={editForm.html_body}
                  onChange={(e) => setEditForm({ ...editForm, html_body: e.target.value })}
                  rows={15}
                  className="font-mono text-xs"
                  disabled={saving}
                />
              </TabsContent>
              <TabsContent value="text" className="space-y-2">
                <Label htmlFor="text_body">Plain Text Body</Label>
                <Textarea
                  id="text_body"
                  value={editForm.text_body}
                  onChange={(e) => setEditForm({ ...editForm, text_body: e.target.value })}
                  rows={15}
                  className="font-mono text-xs"
                  disabled={saving}
                />
              </TabsContent>
            </Tabs>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={handlePreview}
              disabled={saving || previewing}
            >
              {previewing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedTemplate(selectedTemplate);
                setResetDialogOpen(true);
              }}
              disabled={saving}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset to Default
            </Button>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
            <DialogDescription>
              Preview of how the email will appear with sample data
            </DialogDescription>
          </DialogHeader>

          {preview && (
            <Tabs defaultValue="html" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="html">HTML Preview</TabsTrigger>
                <TabsTrigger value="text">Plain Text</TabsTrigger>
              </TabsList>
              <TabsContent value="html" className="space-y-2">
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs">Subject:</Label>
                    <p className="text-sm font-medium mt-1">{preview.subject}</p>
                  </div>
                  <div>
                    <Label className="text-xs">HTML Content:</Label>
                    <div
                      className="mt-1 rounded-lg border p-4 bg-white text-black"
                      dangerouslySetInnerHTML={{ __html: preview.html }}
                    />
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="text" className="space-y-2">
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs">Subject:</Label>
                    <p className="text-sm font-medium mt-1">{preview.subject}</p>
                  </div>
                  <div>
                    <Label className="text-xs">Plain Text Content:</Label>
                    <pre className="mt-1 rounded-lg border p-4 bg-muted text-sm whitespace-pre-wrap font-mono">
                      {preview.text}
                    </pre>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}

          <DialogFooter>
            <Button onClick={() => setPreviewDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Confirmation Dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Template to Default</DialogTitle>
            <DialogDescription>
              Are you sure you want to reset this email template to its default content? 
              This action will discard your customizations.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResetDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReset}
              disabled={saving}
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Reset to Default
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmailTemplates;
