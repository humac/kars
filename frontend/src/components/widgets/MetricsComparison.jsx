import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function MetricsComparison({ current, previous, title = 'Metrics Comparison' }) {
  if (!current || !previous) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No comparison data available
          </div>
        </CardContent>
      </Card>
    );
  }

  const metrics = Object.keys(current).map(key => {
    const currentValue = current[key];
    const previousValue = previous[key];
    
    // Calculate change
    let change = 0;
    let changePercent = 0;
    let trend = 'unchanged';
    
    if (typeof currentValue === 'number' && typeof previousValue === 'number') {
      change = currentValue - previousValue;
      if (previousValue !== 0) {
        changePercent = ((change / previousValue) * 100);
      }
      if (change > 0) trend = 'up';
      else if (change < 0) trend = 'down';
    }

    return {
      name: key
        .replace(/([A-Z])/g, ' $1') // Add space before capital letters
        .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
        .trim(),
      current: currentValue,
      previous: previousValue,
      change,
      changePercent,
      trend
    };
  });

  const getTrendIcon = (trend) => {
    if (trend === 'up') return ArrowUp;
    if (trend === 'down') return ArrowDown;
    return Minus;
  };

  const getTrendColor = (trend) => {
    if (trend === 'up') return 'text-green-600 dark:text-green-400';
    if (trend === 'down') return 'text-red-600 dark:text-red-400';
    return 'text-muted-foreground';
  };

  const formatValue = (value) => {
    if (typeof value === 'number') {
      // If it's a rate/percentage (between 0 and 1), format as percentage
      if (value > 0 && value < 1) {
        return `${(value * 100).toFixed(1)}%`;
      }
      return value.toLocaleString();
    }
    return value;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Metric</TableHead>
              <TableHead className="text-right">Current</TableHead>
              <TableHead className="text-right">Previous</TableHead>
              <TableHead className="text-right">Change</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {metrics.map((metric, index) => {
              const TrendIcon = getTrendIcon(metric.trend);
              return (
                <TableRow key={index}>
                  <TableCell className="font-medium">{metric.name}</TableCell>
                  <TableCell className="text-right">{formatValue(metric.current)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatValue(metric.previous)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className={cn('flex items-center justify-end gap-1', getTrendColor(metric.trend))}>
                      <TrendIcon className="h-4 w-4" />
                      {metric.trend !== 'unchanged' && (
                        <span className="text-sm font-medium">
                          {Math.abs(metric.changePercent).toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
