import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ScrollText, Loader2 } from 'lucide-react';

interface AuditEntry {
  id: string;
  action_type: string;
  details: Record<string, any> | null;
  created_at: string;
}

export default function AuditLog() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        setEntries((data as AuditEntry[]) || []);
        setLoading(false);
      });
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[40vh]">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-slide-in">
      <h1 className="text-xl font-semibold text-foreground">Audit Log</h1>
      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[40vh] text-center">
          <div className="bg-surface-2 rounded-full p-4 mb-4">
            <ScrollText className="h-8 w-8 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
        </div>
      ) : (
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Time</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Action</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Details</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(entry => (
                <tr key={entry.id} className="border-b border-border/50">
                  <td className="px-4 py-3 text-xs font-mono text-muted-foreground whitespace-nowrap">
                    {new Date(entry.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-foreground">{entry.action_type}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground font-mono max-w-xs truncate">
                    {entry.details ? JSON.stringify(entry.details) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
