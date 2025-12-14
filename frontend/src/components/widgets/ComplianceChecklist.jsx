import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_CONFIG = {
  pass: {
    icon: CheckCircle2,
    color: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-50 dark:bg-green-950'
  },
  warn: {
    icon: AlertTriangle,
    color: 'text-yellow-600 dark:text-yellow-400',
    bg: 'bg-yellow-50 dark:bg-yellow-950'
  },
  fail: {
    icon: XCircle,
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-950'
  }
};

export default function ComplianceChecklist({ items, title = 'SOC2 Compliance Checklist' }) {
  if (!items || items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <AlertTriangle className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No checklist items available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Compliance thresholds
  const COMPLIANCE_THRESHOLDS = {
    EXCELLENT: 80,
    GOOD: 60
  };

  // Calculate completion stats
  const passCount = items.filter(item => item.status === 'pass').length;
  const warnCount = items.filter(item => item.status === 'warn').length;
  const failCount = items.filter(item => item.status === 'fail').length;
  const total = items.length;
  const completionRate = Math.round((passCount / total) * 100);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{title}</CardTitle>
          <div className="text-sm font-medium">
            <span className="text-muted-foreground">Completion: </span>
            <span className={cn(
              completionRate >= COMPLIANCE_THRESHOLDS.EXCELLENT ? 'text-green-600' : 
              completionRate >= COMPLIANCE_THRESHOLDS.GOOD ? 'text-yellow-600' : 
              'text-red-600'
            )}>
              {completionRate}%
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {items.map((item, index) => {
            const config = STATUS_CONFIG[item.status] || STATUS_CONFIG.warn;
            const Icon = config.icon;

            return (
              <div
                key={index}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-lg border',
                  config.bg
                )}
              >
                <Icon className={cn('h-5 w-5 flex-shrink-0 mt-0.5', config.color)} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{item.item}</p>
                  {item.description && (
                    <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="mt-4 pt-4 border-t flex items-center justify-around text-center">
          <div>
            <div className="text-2xl font-bold text-green-600">{passCount}</div>
            <div className="text-xs text-muted-foreground">Passing</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-yellow-600">{warnCount}</div>
            <div className="text-xs text-muted-foreground">Warnings</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-600">{failCount}</div>
            <div className="text-xs text-muted-foreground">Failing</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
