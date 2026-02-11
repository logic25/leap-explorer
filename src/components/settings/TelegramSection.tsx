import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Send, CheckCircle, Loader2, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface TelegramSectionProps {
  userId: string;
  telegramChatId: string;
  setTelegramChatId: (id: string) => void;
  telegramLinked: boolean;
  setTelegramLinked: (linked: boolean) => void;
}

export default function TelegramSection({ userId, telegramChatId, setTelegramChatId, telegramLinked, setTelegramLinked }: TelegramSectionProps) {
  const { toast } = useToast();
  const [linkingTelegram, setLinkingTelegram] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  const linkTelegram = async () => {
    if (!userId || !telegramChatId.trim()) return;
    setLinkingTelegram(true);
    try {
      const { error } = await supabase.functions.invoke('telegram', {
        body: { action: 'link', user_id: userId, chat_id: telegramChatId.trim() },
      });
      if (error) throw error;

      // Also register webhook
      await supabase.functions.invoke('telegram', {
        body: { action: 'setup_webhook' },
      });

      setTelegramLinked(true);
      toast({ title: 'Telegram linked!', description: 'Check your Telegram for a confirmation message.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Failed to link', description: err.message });
    }
    setLinkingTelegram(false);
  };

  const sendTestAlert = async () => {
    setSendingTest(true);
    try {
      const { error } = await supabase.functions.invoke('telegram', {
        body: {
          action: 'send_test',
          user_id: userId,
        },
      });
      if (error) throw error;
      toast({
        title: 'Test message sent!',
        description: 'Check your Telegram for the test notification.',
      });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Test failed', description: err.message });
    }
    setSendingTest(false);
  };

  return (
    <section className="bg-card rounded-lg border border-border p-5 space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Send className="h-4 w-4 text-primary" />
        Telegram Alerts
      </div>
      <p className="text-xs text-muted-foreground">
        Link your Telegram to receive daily scan alerts and approve trades via reply.
      </p>
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Telegram Chat ID</Label>
        <p className="text-xs text-muted-foreground">
          Message <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">@userinfobot</a> on Telegram to get your Chat ID.
        </p>
        <div className="flex gap-2">
          <Input
            value={telegramChatId}
            onChange={e => setTelegramChatId(e.target.value)}
            placeholder="e.g. 123456789"
            className="bg-surface-2 border-border"
            disabled={telegramLinked}
          />
          {telegramLinked ? (
            <Button variant="outline" disabled className="gap-2 shrink-0">
              <CheckCircle className="h-4 w-4 text-bullish" />
              Linked
            </Button>
          ) : (
            <Button onClick={linkTelegram} disabled={linkingTelegram || !telegramChatId.trim()} className="gap-2 shrink-0">
              {linkingTelegram ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Link
            </Button>
          )}
        </div>
        {telegramLinked && (
          <div className="flex gap-2 items-center">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={() => {
                setTelegramLinked(false);
                setTelegramChatId('');
              }}
            >
              Unlink & change
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={sendTestAlert}
              disabled={sendingTest}
              className="gap-1 text-xs"
            >
              {sendingTest ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
              Send Test Notification
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
