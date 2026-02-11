-- Add telegram_chat_id to profiles for linking Telegram accounts
ALTER TABLE public.profiles ADD COLUMN telegram_chat_id text DEFAULT null;