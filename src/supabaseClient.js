import { createClient } from '@supabase/supabase-js';

// Validar que as variáveis de ambiente estão definidas
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error(
    'REACT_APP_SUPABASE_URL não está definida. ' +
    'Por favor, configure o arquivo .env com as credenciais do Supabase.'
  );
}

if (!supabaseAnonKey) {
  throw new Error(
    'REACT_APP_SUPABASE_ANON_KEY não está definida. ' +
    'Por favor, configure o arquivo .env com as credenciais do Supabase.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
