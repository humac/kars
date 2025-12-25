import { useState } from 'react';
import { Search, Filter, ChevronDown, ChevronUp, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

/**
 * Consolidated filter controls for the AssetTable component.
 * Features a collapsible filter panel with active filter count badge.
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
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  // Count active filters (excluding search)
  const activeFilterCount = [
    statusFilter !== 'all',
    assetTypeFilter !== 'all',
    companyFilter !== 'all',
    employeeFilter !== 'all',
    managerFilter !== 'all',
  ].filter(Boolean).length;

  const hasActiveFilters = activeFilterCount > 0 || searchTerm !== '';

  const handleClearFilters = () => {
    onClearFilters();
    setFiltersExpanded(false);
  };

  return (
    <div className="space-y-3">
      {/* Search Bar and Filter Toggle */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
          <Input
            placeholder="Search by name, serial, tag, make, model..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setFiltersExpanded(!filtersExpanded)}
            className={cn(
              "gap-2",
              activeFilterCount > 0 && "border-primary/50"
            )}
          >
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Filters</span>
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                {activeFilterCount}
              </Badge>
            )}
            {filtersExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClearFilters}
              className="text-muted-foreground hover:text-foreground"
              title="Clear all filters"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Collapsible Filter Panel */}
      <div
        className={cn(
          "grid gap-3 overflow-hidden transition-all duration-200",
          filtersExpanded
            ? "grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="min-h-0">
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
              {/* Status Filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9">
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
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Asset Type</label>
                <Select value={assetTypeFilter} onValueChange={setAssetTypeFilter}>
                  <SelectTrigger className="h-9">
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
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Company</label>
                <Select value={companyFilter} onValueChange={setCompanyFilter}>
                  <SelectTrigger className="h-9">
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
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Employee</label>
                <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
                  <SelectTrigger className="h-9">
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
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Manager</label>
                <Select value={managerFilter} onValueChange={setManagerFilter}>
                  <SelectTrigger className="h-9">
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
        </div>
      </div>
    </div>
  );
}
