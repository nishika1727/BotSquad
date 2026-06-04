/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Recursive Proxy to mock supabase client and prevent crashes when env vars are missing
const makeMock = (path: string = 'supabase'): any => {
  return new Proxy(() => {}, {
    get: (_target, prop) => {
      if (prop === 'then') {
        return (resolve: any) => {
          console.warn(`[Supabase Warning] Accessing "${path}" but Supabase is not configured.`);
          resolve({
            data: { user: null },
            error: new Error('Supabase client is not initialized. Please verify your environment variables VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
          });
        };
      }
      return makeMock(`${path}.${String(prop)}`);
    },
    apply: (_target, _thisArg, _argumentsList) => {
      return makeMock(`${path}(...)`);
    }
  });
};

let client: SupabaseClient;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '❌ SUPABASE CONFIGURATION ERROR:\n' +
    'VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing in your environment variables.\n' +
    'Please configure them in your local .env or Vercel Environment Variables.'
  );
  client = makeMock();
} else {
  try {
    client = createClient(supabaseUrl, supabaseAnonKey);
  } catch (error) {
    console.error('❌ Failed to initialize Supabase client:', error);
    client = makeMock();
  }
}

export const supabase = client;
