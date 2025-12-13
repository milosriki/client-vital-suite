-- Create notifications table for in-app notification center
CREATE TABLE public.notifications (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('critical', 'important', 'info')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    category TEXT DEFAULT 'system',
    metadata JSONB DEFAULT '{}',
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create system_preferences table for user settings
CREATE TABLE public.system_preferences (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    preference_key TEXT NOT NULL UNIQUE,
    preference_value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_preferences ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (internal business tool)
CREATE POLICY "Allow all access to notifications" ON public.notifications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to system_preferences" ON public.system_preferences FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Create indexes
CREATE INDEX idx_notifications_read ON public.notifications(read);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX idx_notifications_type ON public.notifications(type);

-- Insert default currency preference
INSERT INTO public.system_preferences (preference_key, preference_value)
VALUES ('base_currency', '"AED"')
ON CONFLICT (preference_key) DO NOTHING;

-- Insert default sound preference
INSERT INTO public.system_preferences (preference_key, preference_value)
VALUES ('sound_alerts', 'true')
ON CONFLICT (preference_key) DO NOTHING;