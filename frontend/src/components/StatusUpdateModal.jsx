import { useState } from 'react';

const StatusUpdateModal = ({ asset, onClose, onUpdate }) => {
  const [status, setStatus] = useState(asset.status);
  const [notes, setNotes] = useState(asset.notes || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/assets/${asset.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status, notes }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update status');
      }

      onUpdate();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Update Asset Status</h3>

        <div style={{ marginBottom: '20px', padding: '15px', background: '#f7fafc', borderRadius: '6px' }}>
          <p><strong>Employee:</strong> {asset.employee_name}</p>
          <p><strong>Serial Number:</strong> {asset.laptop_serial_number}</p>
          <p><strong>Asset Tag:</strong> {asset.laptop_asset_tag}</p>
        </div>

        {error && (
          <div className="alert alert-error">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="status">New Status *</label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              required
            >
              <option value="active">Active</option>
              <option value="returned">Returned</option>
              <option value="lost">Lost</option>
              <option value="damaged">Damaged</option>
              <option value="retired">Retired</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="notes">Notes</label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this status change..."
            />
          </div>

          <div className="modal-actions">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Updating...' : 'Update Status'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StatusUpdateModal;
