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
  const { getAuthHeaders } = useAuth();
  const { toast } = useToast();
  
  // Initialize form with required fields
  const [form, setForm] = useState({ 
    employee_name: '',
    employee_email: '',
    company_name: '',
    laptop_make: '',
    laptop_model: '',
    laptop_serial_number: '',
    laptop_asset_tag: '',
    status: 'active',
    notes: '',
  });
  
  const [saving, setSaving] = useState(false);
  const [emailError, setEmailError] = useState('');

  function onChange(e) {
    const { name, value } = e.target;
    
    // Apply max length constraints
    let finalValue = value;
    if (name === 'employee_name' && value.length > 255) {
      finalValue = value.slice(0, 255);
    } else if (name === 'company_name' && value.length > 255) {
      finalValue = value.slice(0, 255);
    } else if (name === 'laptop_make' && value.length > 100) {
      finalValue = value.slice(0, 100);
    } else if (name === 'laptop_model' && value.length > 100) {
      finalValue = value.slice(0, 100);
    } else if (name === 'laptop_serial_number' && value.length > 100) {
      finalValue = value.slice(0, 100);
    } else if (name === 'laptop_asset_tag' && value.length > 100) {
      finalValue = value.slice(0, 100);
    } else if (name === 'notes' && value.length > 1000) {
      finalValue = value.slice(0, 1000);
    }
    
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
    if (!form.employee_name || !form.employee_email || !form.company_name || 
        !form.laptop_serial_number || !form.laptop_asset_tag) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/assets', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(form),
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
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Register New Asset</DialogTitle>
          <DialogDescription>
            Add a new asset to the system. All fields marked with * are required.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={save} className="space-y-4 py-2">
          {/* Employee Information */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-muted-foreground">Employee Information</h4>
            
            <div className="space-y-2">
              <Label htmlFor="employee_name">Employee Name *</Label>
              <Input 
                id="employee_name" 
                name="employee_name" 
                value={form.employee_name} 
                onChange={onChange}
                maxLength={255}
                placeholder="John Doe"
                required
              />
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
                className={emailError ? 'border-destructive' : ''}
                required
              />
              {emailError && (
                <div className="flex items-center gap-1 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span>{emailError}</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="company_name">Company Name *</Label>
              <Input 
                id="company_name" 
                name="company_name" 
                value={form.company_name} 
                onChange={onChange}
                maxLength={255}
                placeholder="Acme Corporation"
                required
              />
            </div>
          </div>

          {/* Asset Information */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-muted-foreground">Asset Information</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="laptop_make">Laptop Make</Label>
                <Input 
                  id="laptop_make" 
                  name="laptop_make" 
                  value={form.laptop_make} 
                  onChange={onChange}
                  maxLength={100}
                  placeholder="Dell, Apple, Lenovo"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="laptop_model">Laptop Model</Label>
                <Input 
                  id="laptop_model" 
                  name="laptop_model" 
                  value={form.laptop_model} 
                  onChange={onChange}
                  maxLength={100}
                  placeholder="XPS 15, MacBook Pro"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="laptop_serial_number">Serial Number *</Label>
              <Input 
                id="laptop_serial_number" 
                name="laptop_serial_number" 
                value={form.laptop_serial_number} 
                onChange={onChange}
                maxLength={100}
                placeholder="ABC123456789"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="laptop_asset_tag">Asset Tag *</Label>
              <Input 
                id="laptop_asset_tag" 
                name="laptop_asset_tag" 
                value={form.laptop_asset_tag} 
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

          <DialogFooter>
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
