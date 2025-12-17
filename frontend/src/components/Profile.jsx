import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { User, Shield, Key, Loader2, Check, X, Trash2 } from 'lucide-react';
import MFASetupModal from './MFASetupModal';
import { prepareCreationOptions, uint8ArrayToBase64Url } from '@/utils/webauthn';

const ProfileNew = () => {
  const { user, getAuthHeaders, updateUser } = useAuth();
  const { toast } = useToast();
  const [formData, setFormData] = useState({ first_name: '', last_name: '', manager_first_name: '', manager_last_name: '', manager_email: '' });
  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('account');
  const [profileImage, setProfileImage] = useState(null);
  const [profileImageName, setProfileImageName] = useState('');

  // MFA state
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [showMFASetup, setShowMFASetup] = useState(false);
  const [showDisableMFA, setShowDisableMFA] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);

  // Passkeys state
  const [passkeys, setPasskeys] = useState([]);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [newPasskeyName, setNewPasskeyName] = useState('');

  useEffect(() => {
    if (user) {
      setFormData({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        manager_first_name: user.manager_first_name || '',
        manager_last_name: user.manager_last_name || '',
        manager_email: user.manager_email || ''
      });
      setProfileImage(user.profile_image || null);
      setProfileImageName(user.profile_image ? 'Current profile image' : '');
    }
  }, [user]);

  useEffect(() => {
    const fetchMFAStatus = async () => {
      try {
        const response = await fetch('/api/auth/mfa/status', { headers: getAuthHeaders() });
        const data = await response.json();
        if (response.ok) setMfaEnabled(data.enabled);
      } catch (err) { console.error('Failed to fetch MFA status:', err); }
    };
    fetchMFAStatus();
  }, [getAuthHeaders]);

  useEffect(() => {
    if (activeTab === 'security') fetchPasskeys();
  }, [activeTab]);

  const fetchPasskeys = async () => {
    setPasskeyLoading(true);
    try {
      const response = await fetch('/api/auth/passkeys', { headers: { ...getAuthHeaders() } });
      const data = await response.json();
      if (response.ok) setPasskeys(data.passkeys || []);
    } catch (err) {
      toast({ title: "Error", description: "Failed to load passkeys", variant: "destructive" });
    } finally { setPasskeyLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const submitData = {
        ...formData,
        profile_image: profileImage ?? null
      };
      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(submitData),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update profile');
      toast({ title: "Success", description: "Profile updated successfully", variant: "success" });
      updateUser(data.user);
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({ title: "Error", description: "Passwords do not match", variant: "destructive" });
      return;
    }
    if (passwordData.newPassword.length < 6) {
      toast({ title: "Error", description: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    setPasswordLoading(true);
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(passwordData),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to change password');
      toast({ title: "Success", description: "Password changed successfully", variant: "success" });
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setPasswordLoading(false); }
  };

  const handleMFASetupComplete = () => {
    setMfaEnabled(true);
    setShowMFASetup(false);
    toast({ title: "Success", description: "Two-factor authentication enabled", variant: "success" });
  };

  const handleDisableMFA = async () => {
    if (!disablePassword) {
      toast({ title: "Error", description: "Password is required", variant: "destructive" });
      return;
    }
    setMfaLoading(true);
    try {
      const response = await fetch('/api/auth/mfa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ password: disablePassword }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to disable MFA');
      setMfaEnabled(false);
      setShowDisableMFA(false);
      setDisablePassword('');
      toast({ title: "Success", description: "Two-factor authentication disabled", variant: "success" });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setMfaLoading(false); }
  };

  const handlePasskeyRegistration = async () => {
    if (!window.PublicKeyCredential) {
      toast({ title: "Error", description: "Passkeys not supported in this browser", variant: "destructive" });
      return;
    }
    setPasskeyLoading(true);
    try {
      const optionsResponse = await fetch('/api/auth/passkeys/registration-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      });
      const optionsData = await optionsResponse.json();
      if (!optionsResponse.ok) throw new Error(optionsData.error || 'Unable to start passkey setup');
      const creationOptions = prepareCreationOptions(optionsData.options);
      const credential = await navigator.credentials.create({ publicKey: creationOptions });
      if (!credential) throw new Error('No credential was returned');
      const verificationPayload = {
        name: newPasskeyName.trim() || 'Passkey',
        credential: {
          id: credential.id,
          rawId: uint8ArrayToBase64Url(credential.rawId),
          type: credential.type,
          response: {
            clientDataJSON: uint8ArrayToBase64Url(credential.response.clientDataJSON),
            attestationObject: uint8ArrayToBase64Url(credential.response.attestationObject),
            transports: typeof credential.response.getTransports === 'function' ? credential.response.getTransports() : [],
          },
        },
      };
      const verifyResponse = await fetch('/api/auth/passkeys/verify-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(verificationPayload),
      });
      const verifyData = await verifyResponse.json();
      if (!verifyResponse.ok) throw new Error(verifyData.error || 'Unable to save passkey');
      setPasskeys((prev) => [verifyData.passkey, ...prev.filter((pk) => pk.id !== verifyData.passkey.id)]);
      toast({ title: "Success", description: "Passkey added successfully", variant: "success" });
      setNewPasskeyName('');
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setPasskeyLoading(false); }
  };

  const handleDeletePasskey = async (passkeyId) => {
    setPasskeyLoading(true);
    try {
      const response = await fetch(`/api/auth/passkeys/${passkeyId}`, {
        method: 'DELETE', headers: { ...getAuthHeaders() },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to delete passkey');
      setPasskeys((prev) => prev.filter((pk) => pk.id !== passkeyId));
      toast({ title: "Success", description: "Passkey removed", variant: "success" });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setPasskeyLoading(false); }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleString() : 'Never';
  const getRoleColor = (role) => ({ admin: 'destructive', manager: 'success', employee: 'default' }[role] || 'secondary');

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file type', description: 'Please upload an image file.', variant: 'destructive' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Profile images must be 5MB or smaller.', variant: 'destructive' });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => setProfileImage(reader.result);
    reader.readAsDataURL(file);
    setProfileImageName(file.name);
  };

  const handleRemoveImage = () => {
    setProfileImage(null);
    setProfileImageName('');
  };

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2 px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg sm:text-xl">Profile Settings</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-2 pb-4 px-4 sm:px-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-3">
              <TabsTrigger value="account" className="gap-2"><User className="h-4 w-4" />Account</TabsTrigger>
              <TabsTrigger value="update" className="gap-2"><User className="h-4 w-4" />Update Info</TabsTrigger>
              <TabsTrigger value="security" className="gap-2"><Shield className="h-4 w-4" />Security</TabsTrigger>
            </TabsList>

            <TabsContent value="account" className="space-y-0 mt-3">
              <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                <div className="flex items-center justify-between p-3 rounded-md border bg-card">
                  <span className="text-sm text-muted-foreground">Email</span>
                  <span className="font-medium text-sm">{user?.email}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-md border bg-card">
                  <span className="text-sm text-muted-foreground">Role</span>
                  <Badge variant={getRoleColor(user?.role)} className="text-xs">{user?.role?.toUpperCase()}</Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-md border bg-card">
                  <span className="text-sm text-muted-foreground">Name</span>
                  <span className="font-medium text-sm">{user?.name}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-md border bg-card">
                  <span className="text-sm text-muted-foreground">Manager</span>
                  <span className="font-medium text-sm">
                    {user?.manager_first_name && user?.manager_last_name 
                      ? `${user.manager_first_name} ${user.manager_last_name}` 
                      : 'Not set'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-md border bg-card lg:col-span-2">
                  <span className="text-sm text-muted-foreground">Manager Email</span>
                  <span className="font-medium text-sm">{user?.manager_email || 'Not set'}</span>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="update" className="space-y-0 mt-3">
              <form onSubmit={handleSubmit} className="space-y-3 max-w-2xl">
                <div className="flex items-center gap-3 pb-2 border-b">
                  <Avatar className="h-14 w-14">
                    {profileImage && <AvatarImage src={profileImage} alt="Profile" />}
                    <AvatarFallback className="bg-primary text-primary-foreground text-base">
                      {user?.first_name?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="profile-image" className="text-sm">Profile Picture</Label>
                    <Input id="profile-image" type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button type="button" size="sm" variant="secondary" onClick={() => document.getElementById('profile-image')?.click()}>
                        Choose Image
                      </Button>
                      {profileImage && (
                        <Button type="button" size="sm" variant="outline" onClick={handleRemoveImage}>
                          Remove
                        </Button>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {profileImageName || 'No file selected'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">JPG, PNG, or SVG up to 5MB.</p>
                  </div>
                </div>
                <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
                  <div className="space-y-1.5"><Label className="text-sm">First Name</Label><Input value={formData.first_name} onChange={(e) => setFormData({ ...formData, first_name: e.target.value })} required className="text-base" /></div>
                  <div className="space-y-1.5"><Label className="text-sm">Last Name</Label><Input value={formData.last_name} onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} required className="text-base" /></div>
                </div>
                <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 pt-1">
                  <div className="space-y-1.5"><Label className="text-sm">Manager First Name</Label><Input value={formData.manager_first_name} onChange={(e) => setFormData({ ...formData, manager_first_name: e.target.value })} className="text-base" /></div>
                  <div className="space-y-1.5"><Label className="text-sm">Manager Last Name</Label><Input value={formData.manager_last_name} onChange={(e) => setFormData({ ...formData, manager_last_name: e.target.value })} className="text-base" /></div>
                </div>
                <div className="space-y-1.5"><Label className="text-sm">Manager Email</Label><Input type="email" value={formData.manager_email} onChange={(e) => setFormData({ ...formData, manager_email: e.target.value })} className="text-base" /></div>
                <Button type="submit" size="sm" disabled={loading} className="w-full sm:w-auto">{loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Update Profile</Button>
              </form>
            </TabsContent>

            <TabsContent value="security" className="space-y-3 mt-3">
              <div className="rounded-lg border bg-card">
                <div className="p-3 pb-2 border-b">
                  <h4 className="text-sm font-semibold">Change Password</h4>
                </div>
                <div className="p-3">
                  <form onSubmit={handlePasswordSubmit} className="space-y-2 max-w-md">
                    <div className="space-y-1.5"><Label className="text-sm">Current Password</Label><Input type="password" value={passwordData.currentPassword} onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })} required className="text-base" /></div>
                    <div className="space-y-1.5"><Label className="text-sm">New Password</Label><Input type="password" value={passwordData.newPassword} onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })} minLength={6} required className="text-base" /></div>
                    <div className="space-y-1.5"><Label className="text-sm">Confirm New Password</Label><Input type="password" value={passwordData.confirmPassword} onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })} minLength={6} required className="text-base" /></div>
                    <Button type="submit" size="sm" disabled={passwordLoading} className="w-full sm:w-auto">{passwordLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Change Password</Button>
                  </form>
                </div>
              </div>

              <div className="rounded-lg border bg-card">
                <div className="p-3 pb-2 border-b">
                  <h4 className="text-sm font-semibold">Two-Factor Authentication</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">Add extra security with a verification code.</p>
                </div>
                <div className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {mfaEnabled ? <><Check className="h-4 w-4 text-green-500" /><span className="text-sm text-green-600 font-medium">Enabled</span></> : <><X className="h-4 w-4 text-red-500" /><span className="text-sm text-red-600">Disabled</span></>}
                    </div>
                    {mfaEnabled ? <Button size="sm" variant="outline" onClick={() => setShowDisableMFA(true)}>Disable MFA</Button> : <Button size="sm" onClick={() => setShowMFASetup(true)}>Enable MFA</Button>}
                  </div>
                </div>
              </div>

              <div className="rounded-lg border bg-card">
                <div className="p-3 pb-2 border-b">
                  <div className="flex items-center gap-2">
                    <Key className="h-4 w-4 text-primary" />
                    <h4 className="text-sm font-semibold">Passkeys</h4>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">Use passkeys for passwordless sign-in.</p>
                </div>
                <div className="p-3 space-y-2">
                  <div className="flex gap-2 flex-wrap">
                    <Input placeholder="Passkey name (e.g., MacBook Touch ID)" value={newPasskeyName} onChange={(e) => setNewPasskeyName(e.target.value)} className="flex-1 min-w-[200px]" />
                    <Button size="sm" onClick={handlePasskeyRegistration} disabled={passkeyLoading}>{passkeyLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}<Key className="h-4 w-4 mr-2" />Create Passkey</Button>
                  </div>
                  {passkeys.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No passkeys registered yet.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {passkeys.map((pk) => (
                        <div key={pk.id} className="flex items-center justify-between p-2 rounded-md border">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm">{pk.name}</p>
                            <p className="text-xs text-muted-foreground truncate">Created {formatDate(pk.created_at)} | Last used {formatDate(pk.last_used_at)}</p>
                          </div>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => handleDeletePasskey(pk.id)} disabled={passkeyLoading}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <MFASetupModal open={showMFASetup} onClose={() => setShowMFASetup(false)} onComplete={handleMFASetupComplete} getAuthHeaders={getAuthHeaders} />

      <Dialog open={showDisableMFA} onOpenChange={(open) => { setShowDisableMFA(open); if (!open) { setDisablePassword(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disable Two-Factor Authentication</DialogTitle>
            <DialogDescription>This will make your account less secure. Enter your password to confirm.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input type="password" placeholder="Enter your password" value={disablePassword} onChange={(e) => setDisablePassword(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDisableMFA(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDisableMFA} disabled={mfaLoading || !disablePassword}>{mfaLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Disable MFA</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProfileNew;
