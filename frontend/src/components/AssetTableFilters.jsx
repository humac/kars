import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * Filter controls for the AssetTable component.
 * Renders search input and dropdown filters for status, asset type, company, employee, and manager.
 */
export default function AssetTableFilters({
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
  assetTypeFilter,
  setAssetTypeFilter,
  companyFilter,
  setCompanyFilter,
  employeeFilter,
  setEmployeeFilter,
  managerFilter,
  setManagerFilter,
  companies = [],
  assetTypes = [],
  uniqueEmployees = [],
  uniqueManagers = [],
  onClearFilters,
}) {
  return (
    <div className="space-y-4">
      {/* Search and Clear Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
          <Input
            placeholder="Search assets by name, manager, company, serial, tag, make, model..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button
          variant="outline"
          onClick={onClearFilters}
          className="sm:w-auto"
        >
          Clear Filters
        </Button>
      </div>

      {/* Filter Dropdowns Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {/* Status Filter */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="returned">Returned</SelectItem>
              <SelectItem value="lost">Lost</SelectItem>
              <SelectItem value="damaged">Damaged</SelectItem>
              <SelectItem value="retired">Retired</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Asset Type Filter */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Asset Type</Label>
          <Select value={assetTypeFilter} onValueChange={setAssetTypeFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {assetTypes.map((type) => (
                <SelectItem key={type.id} value={type.name}>
                  {type.display_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Company Filter */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Company</Label>
          <Select value={companyFilter} onValueChange={setCompanyFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All companies" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Companies</SelectItem>
              {companies.map((company) => (
                <SelectItem key={company.id} value={company.name}>
                  {company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Employee Filter */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Employee</Label>
          <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All employees" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employees</SelectItem>
              {uniqueEmployees.map((employee) => (
                <SelectItem key={employee.email} value={employee.name}>
                  {employee.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Manager Filter */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Manager</Label>
          <Select value={managerFilter} onValueChange={setManagerFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All managers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Managers</SelectItem>
              {uniqueManagers.map((manager) => (
                <SelectItem key={`${manager.email}-${manager.name}`} value={manager.name}>
                  {manager.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
