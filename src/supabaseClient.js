import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://mmfsesanudlzgfbjlpzk.supabase.co';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tZnNlc2FudWRsemdmYmpscHprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyNTE4NDMsImV4cCI6MjA3NjgyNzg0M30.o8piHPU3oeDRIaKUWQ5oXePhbxSxQRVrVNa56Po6Eog';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
