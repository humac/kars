import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const ROLE_ALLOWED_FIELDS = {
  admin: ['employee_name', 'employee_email', 'company_name', 'laptop_make', 'laptop_model', 'laptop_serial_number', 'laptop_asset_tag', 'status', 'notes'],
  editor: ['employee_name', 'company_name', 'laptop_make', 'laptop_model', 'notes', 'status'],
  user: ['notes'],
};

function getAllowedFieldsForUser(user) {
  const roles = user?.roles || [];
  const allowed = new Set();
  roles.forEach(r => {
    (ROLE_ALLOWED_FIELDS[r] || []).forEach(f => allowed.add(f));
  });
  return Array.from(allowed);
}

export default function AssetEditModal({ asset, currentUser, onClose, onSaved }) {
  const { getAuthHeaders } = useAuth();
  const allowedFields = getAllowedFieldsForUser(currentUser);
  const [form, setForm] = useState({ 
    ...asset, 
    notes: asset.notes || '',
    laptop_make: asset.laptop_make || '',
    laptop_model: asset.laptop_model || ''
  });
  const [saving, setSaving] = useState(false);

  function onChange(e) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/assets/${asset.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || 'Save failed');
      }
      const updated = await res.json();
      // The API returns { message, asset }, extract the asset
      onSaved(updated.asset || updated);
    } catch (err) {
      console.error(err);
      alert('Unable to save asset.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-6">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="bg-white rounded-md shadow-lg z-10 w-full max-w-2xl overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-medium">Edit Asset</h2>
        </div>
        <div className="p-6 space-y-4">
          {allowedFields.includes('employee_name') && (
            <div>
              <label htmlFor="employee_name" className="block text-sm text-gray-600">Employee Name</label>
              <input id="employee_name" name="employee_name" value={form.employee_name || ''} onChange={onChange} className="mt-1 block w-full border rounded px-3 py-2" />
            </div>
          )}
          {allowedFields.includes('employee_email') && (
            <div>
              <label htmlFor="employee_email" className="block text-sm text-gray-600">Employee Email</label>
              <input id="employee_email" name="employee_email" value={form.employee_email || ''} onChange={onChange} className="mt-1 block w-full border rounded px-3 py-2" />
            </div>
          )}
          {allowedFields.includes('company_name') && (
            <div>
              <label htmlFor="company_name" className="block text-sm text-gray-600">Company</label>
              <input id="company_name" name="company_name" value={form.company_name || ''} onChange={onChange} className="mt-1 block w-full border rounded px-3 py-2" />
            </div>
          )}
          {allowedFields.includes('laptop_make') && (
            <div>
              <label htmlFor="laptop_make" className="block text-sm text-gray-600">Laptop Make</label>
              <input id="laptop_make" name="laptop_make" value={form.laptop_make || ''} onChange={onChange} className="mt-1 block w-full border rounded px-3 py-2" />
            </div>
          )}
          {allowedFields.includes('laptop_model') && (
            <div>
              <label htmlFor="laptop_model" className="block text-sm text-gray-600">Laptop Model</label>
              <input id="laptop_model" name="laptop_model" value={form.laptop_model || ''} onChange={onChange} className="mt-1 block w-full border rounded px-3 py-2" />
            </div>
          )}
          {allowedFields.includes('laptop_serial_number') && (
            <div>
              <label htmlFor="laptop_serial_number" className="block text-sm text-gray-600">Serial Number</label>
              <input id="laptop_serial_number" name="laptop_serial_number" value={form.laptop_serial_number || ''} onChange={onChange} className="mt-1 block w-full border rounded px-3 py-2" />
            </div>
          )}
          {allowedFields.includes('laptop_asset_tag') && (
            <div>
              <label htmlFor="laptop_asset_tag" className="block text-sm text-gray-600">Asset Tag</label>
              <input id="laptop_asset_tag" name="laptop_asset_tag" value={form.laptop_asset_tag || ''} onChange={onChange} className="mt-1 block w-full border rounded px-3 py-2" />
            </div>
          )}
          {allowedFields.includes('status') && (
            <div>
              <label htmlFor="status" className="block text-sm text-gray-600">Status</label>
              <select id="status" name="status" value={form.status || ''} onChange={onChange} className="mt-1 block w-full border rounded px-3 py-2">
                <option value="">Select</option>
                <option value="active">Active</option>
                <option value="returned">Returned</option>
                <option value="lost">Lost</option>
                <option value="damaged">Damaged</option>
                <option value="retired">Retired</option>
              </select>
            </div>
          )}
          {allowedFields.includes('notes') && (
            <div>
              <label htmlFor="notes" className="block text-sm text-gray-600">Notes</label>
              <textarea id="notes" name="notes" value={form.notes || ''} onChange={onChange} className="mt-1 block w-full border rounded px-3 py-2" rows={4} />
            </div>
          )}

          {allowedFields.length === 0 && (
            <div className="text-sm text-gray-500">You do not have permissions to edit any fields for this asset.</div>
          )}
        </div>

        <div className="px-6 py-4 border-t flex justify-end space-x-2">
          <button onClick={onClose} className="px-3 py-1 rounded border">Cancel</button>
          <button
            onClick={save}
            disabled={saving || allowedFields.length === 0}
            className="px-3 py-1 rounded bg-sky-600 text-white disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
