import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, AlertCircle } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'returned', label: 'Returned' },
  { value: 'lost', label: 'Lost' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'retired', label: 'Retired' },
];

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AssetRegisterModal({ onClose, onRegistered }) {
  const { getAuthHeaders, user } = useAuth();
  const { toast } = useToast();
  
  // Check user role
  const isEmployee = user && user.role === 'employee';
  const isAdmin = user && user.role === 'admin';
  const isManager = user && user.role === 'manager';
  
  // Parse manager name into first and last if available
  const getManagerNames = () => {
    if (user?.manager_name) {
      const parts = user.manager_name.split(' ');
      return {
        first: parts[0] || '',
        last: parts.slice(1).join(' ') || ''
      };
    }
    return { first: '', last: '' };
  };
  
  const managerNames = getManagerNames();
  
  // Initialize form with required fields
  // For employees, prepopulate their information and manager information
  const [form, setForm] = useState({ 
    employee_first_name: isEmployee ? (user.first_name || '') : '',
    employee_last_name: isEmployee ? (user.last_name || '') : '',
    employee_email: isEmployee ? user.email : '',
    manager_first_name: isEmployee ? managerNames.first : '',
    manager_last_name: isEmployee ? managerNames.last : '',
    manager_email: isEmployee ? (user.manager_email || '') : '',
    company_name: '',
    asset_type: 'laptop',
    make: '',
    model: '',
    serial_number: '',
    asset_tag: '',
    status: 'active',
    notes: '',
  });
  
  const [saving, setSaving] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [companies, setCompanies] = useState([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [assetTypes, setAssetTypes] = useState([]);
  const [loadingAssetTypes, setLoadingAssetTypes] = useState(true);

  // Fetch companies and asset types on mount
  React.useEffect(() => {
    async function fetchCompanies() {
      try {
        const response = await fetch('/api/companies/names', {
          headers: getAuthHeaders(),
        });
        if (response.ok) {
          const data = await response.json();
          setCompanies(data);
        } else {
          console.error('Failed to fetch companies');
          setCompanies([]);
        }
      } catch (error) {
        console.error('Error fetching companies:', error);
        setCompanies([]);
      } finally {
        setLoadingCompanies(false);
      }
    }
    
    async function fetchAssetTypes() {
      try {
        const response = await fetch('/api/asset-types', {
          headers: getAuthHeaders(),
        });
        if (response.ok) {
          const data = await response.json();
          setAssetTypes(data);
          // Set default asset type if available
          if (data.length > 0 && !form.asset_type) {
            setForm(prev => ({ ...prev, asset_type: data[0].name }));
          }
        } else {
          console.error('Failed to fetch asset types');
          setAssetTypes([]);
        }
      } catch (error) {
        console.error('Error fetching asset types:', error);
        setAssetTypes([]);
      } finally {
        setLoadingAssetTypes(false);
      }
    }
    
    fetchCompanies();
    fetchAssetTypes();
  }, [getAuthHeaders]);

  // Field max length configuration
  const MAX_LENGTHS = {
    employee_first_name: 100,
    employee_last_name: 100,
    manager_first_name: 100,
    manager_last_name: 100,
    company_name: 255,
    make: 100,
    model: 100,
    serial_number: 100,
    asset_tag: 100,
    notes: 1000,
  };

  function onChange(e) {
    const { name, value } = e.target;
    
    // Apply max length constraints
    const maxLength = MAX_LENGTHS[name];
    const finalValue = maxLength && value.length > maxLength ? value.slice(0, maxLength) : value;
    
    setForm(prev => ({ ...prev, [name]: finalValue }));
    
    // Validate email on change
    if (name === 'employee_email') {
      if (finalValue && !EMAIL_REGEX.test(finalValue)) {
        setEmailError('Please enter a valid email address');
      } else {
        setEmailError('');
      }
    }
  }

  async function save(e) {
    e.preventDefault();
    
    // Validate email before saving
    if (form.employee_email && !EMAIL_REGEX.test(form.employee_email)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    // Validate required fields
    if (!form.employee_first_name || !form.employee_last_name || !form.employee_email || !form.company_name || 
        !form.asset_type || !form.serial_number || !form.asset_tag) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        employee_first_name: form.employee_first_name,
        employee_last_name: form.employee_last_name,
        employee_email: form.employee_email,
        manager_first_name: form.manager_first_name || null,
        manager_last_name: form.manager_last_name || null,
        manager_email: form.manager_email || null,
        company_name: form.company_name,
        asset_type: form.asset_type,
        make: form.make,
        model: form.model,
        serial_number: form.serial_number,
        asset_tag: form.asset_tag,
        status: form.status,
        notes: form.notes,
      };
      
      const res = await fetch('/api/assets', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(payload),
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Registration failed');
      }
      
      const result = await res.json();
      toast({
        title: "Success",
        description: "Asset registered successfully",
        variant: "success",
      });
      
      onRegistered(result.asset);
      onClose();
    } catch (err) {
      console.error(err);
      toast({
        title: "Error",
        description: err.message || 'Unable to register asset.',
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>Register New Asset</DialogTitle>
          <DialogDescription>
            Add a new asset to the system. All fields marked with * are required.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={save} className="flex flex-col flex-1 min-h-0">
          <div className="overflow-y-auto px-6 space-y-3 flex-1">
            {/* Employee Information */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground">Employee Information</h4>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                <Label htmlFor="employee_first_name">First Name *</Label>
                <Input 
                  id="employee_first_name" 
                  name="employee_first_name" 
                  value={form.employee_first_name} 
                  onChange={onChange}
                  maxLength={100}
                  placeholder="John"
                  required
                  readOnly={isEmployee}
                  disabled={isEmployee}
                  className={isEmployee ? 'bg-muted cursor-not-allowed' : ''}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="employee_last_name">Last Name *</Label>
                <Input 
                  id="employee_last_name" 
                  name="employee_last_name" 
                  value={form.employee_last_name} 
                  onChange={onChange}
                  maxLength={100}
                  placeholder="Doe"
                  required
                  readOnly={isEmployee}
                  disabled={isEmployee}
                  className={isEmployee ? 'bg-muted cursor-not-allowed' : ''}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="employee_email">Employee Email *</Label>
              <Input 
                id="employee_email" 
                name="employee_email" 
                type="email"
                value={form.employee_email} 
                onChange={onChange}
                placeholder="john.doe@company.com"
                className={`${emailError ? 'border-destructive' : ''} ${isEmployee ? 'bg-muted cursor-not-allowed' : ''}`}
                required
                readOnly={isEmployee}
                disabled={isEmployee}
              />
              {emailError && (
                <div className="flex items-center gap-1 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span>{emailError}</span>
                </div>
              )}
              {isEmployee && (
                <p className="text-xs text-muted-foreground">
                  As an employee, you can only register assets for yourself
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="company_name">Company Name *</Label>
              {loadingCompanies ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading companies...
                </div>
              ) : companies.length > 0 ? (
                <Select
                  value={form.company_name}
                  onValueChange={(value) => setForm(prev => ({ ...prev, company_name: value }))}
                  required
                >
                  <SelectTrigger id="company_name">
                    <SelectValue placeholder="Select a company" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.name}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="text-sm text-muted-foreground">
                  No companies available. Please contact an administrator to add companies.
                </div>
              )}
            </div>
          </div>

            {/* Manager Information */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground">Manager Information</h4>
              
              <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="manager_first_name">Manager First Name</Label>
                <Input 
                  id="manager_first_name" 
                  name="manager_first_name" 
                  value={form.manager_first_name} 
                  onChange={onChange}
                  maxLength={100}
                  placeholder="Sarah"
                  readOnly={isEmployee}
                  disabled={isEmployee}
                  className={isEmployee ? 'bg-muted cursor-not-allowed' : ''}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="manager_last_name">Manager Last Name</Label>
                <Input 
                  id="manager_last_name" 
                  name="manager_last_name" 
                  value={form.manager_last_name} 
                  onChange={onChange}
                  maxLength={100}
                  placeholder="Manager"
                  readOnly={isEmployee}
                  disabled={isEmployee}
                  className={isEmployee ? 'bg-muted cursor-not-allowed' : ''}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="manager_email">Manager Email</Label>
              <Input 
                id="manager_email" 
                name="manager_email" 
                type="email"
                value={form.manager_email} 
                onChange={onChange}
                placeholder="manager@example.com"
                className={isEmployee ? 'bg-muted cursor-not-allowed' : ''}
                readOnly={isEmployee}
                disabled={isEmployee}
              />
              {isEmployee && form.manager_email && (
                <p className="text-xs text-muted-foreground">
                  Manager information from your profile
                </p>
              )}
            </div>
          </div>

            {/* Asset Information */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground">Asset Information</h4>
              
              <div className="space-y-2">
                <Label htmlFor="asset_type">Asset Type *</Label>
                {loadingAssetTypes ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading asset types...
                  </div>
                ) : assetTypes.length > 0 ? (
                  <Select 
                    value={form.asset_type} 
                    onValueChange={(value) => setForm(prev => ({ ...prev, asset_type: value }))}
                    required
                  >
                    <SelectTrigger id="asset_type">
                      <SelectValue placeholder="Select asset type" />
                    </SelectTrigger>
                    <SelectContent>
                      {assetTypes.map((type) => (
                        <SelectItem key={type.id} value={type.name}>
                          {type.display_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    No asset types available. Please contact an administrator.
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="make">Make</Label>
                <Input 
                  id="make" 
                  name="make" 
                  value={form.make} 
                  onChange={onChange}
                  maxLength={100}
                  placeholder="Dell, Apple, Samsung"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Input 
                  id="model" 
                  name="model" 
                  value={form.model} 
                  onChange={onChange}
                  maxLength={100}
                  placeholder="XPS 15, iPhone 15"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="serial_number">Serial Number *</Label>
              <Input 
                id="serial_number" 
                name="serial_number" 
                value={form.serial_number} 
                onChange={onChange}
                maxLength={100}
                placeholder="ABC123456789"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="asset_tag">Asset Tag *</Label>
              <Input 
                id="asset_tag" 
                name="asset_tag" 
                value={form.asset_tag} 
                onChange={onChange}
                maxLength={100}
                placeholder="AT-1001"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select 
                value={form.status} 
                onValueChange={(value) => setForm(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger id="status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea 
                id="notes" 
                name="notes" 
                value={form.notes} 
                onChange={onChange}
                rows={3}
                maxLength={1000}
                placeholder="Add any additional notes..."
              />
              <div className="text-xs text-muted-foreground text-right">
                {form.notes.length}/1000
              </div>
            </div>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t mt-auto">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving || !!emailError}
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {saving ? 'Registering...' : 'Register Asset'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
