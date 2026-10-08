import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://czcptgunvyxdajotbyfb.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_DFV3zUaZQea2oBF0_fb-lA_VBnIl4F5';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
