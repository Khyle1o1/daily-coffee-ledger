// Supabase Edge Function: admin-create-user
// Creates a new auth user + user_profile using the service role key.
// Only callable by authenticated admins.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type UserRole = 'admin' | 'user';

function decodeJwtPayload(token: string): { iss?: string; aud?: string | string[]; exp?: number } | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const b64url = parts[1];
    const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(b64url.length / 4) * 4, '=');
    const json = atob(b64);
    return JSON.parse(json) as { iss?: string; aud?: string | string[]; exp?: number };
  } catch {
    return null;
  }
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    console.error('Missing Supabase env vars for Edge Function');
    return new Response(JSON.stringify({ error: 'Server not configured correctly' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    // Be defensive: in some environments duplicate headers may get concatenated with commas.
    // Also ensure we strip "Bearer " case-insensitively and only use the first token-ish value.
    const token = authHeader
      .split(',')[0]
      .replace(/^bearer\s+/i, '')
      .trim();

    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized: missing Bearer token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Permanent diagnosis: "Invalid JWT" almost always means the function is validating
    // a token issued by a DIFFERENT Supabase project (mismatched SUPABASE_URL/SERVICE_ROLE_KEY),
    // or an expired token. Decode (without verifying) to detect those cases early.
    const tokenParts = token.split('.').length;
    const payload = decodeJwtPayload(token);
    const host = (() => {
      try {
        return new URL(supabaseUrl).host;
      } catch {
        return '';
      }
    })();

    if (tokenParts !== 3) {
      return new Response(JSON.stringify({ error: 'Unauthorized: malformed JWT', tokenParts }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (payload?.exp && payload.exp * 1000 < Date.now()) {
      return new Response(JSON.stringify({ error: 'Unauthorized: access token expired' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (payload?.iss && host && !payload.iss.includes(host)) {
      return new Response(
        JSON.stringify({
          error:
            'Unauthorized: JWT issuer does not match this Supabase project. Redeploy the function with matching SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.',
          expectedHost: host,
          tokenIssuer: payload.iss,
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // Single admin client (service role) used both to validate the token
    // and perform privileged operations. The service role key never leaves
    // the Edge Function environment.
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Validate the access token and get the calling user
    const {
      data: { user },
      error: userError,
    } = await adminClient.auth.getUser(token);

    if (userError || !user) {
      console.error('auth.getUser(token) error:', userError);
      return new Response(
        JSON.stringify({
          error: userError?.message || 'Unauthorized: invalid or expired access token',
          tokenParts,
        }),
        {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // Verify caller is admin via user_profiles
    const { data: profile, error: profileError } = await adminClient
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('Error checking admin role:', profileError);
      return new Response(JSON.stringify({ error: 'Failed to verify permissions' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!profile || profile.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden: admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json().catch(() => ({}))) as {
      email?: string;
      password?: string;
      role?: UserRole;
    };

    const email = (body.email ?? '').trim();
    const password = body.password ?? '';
    const role: UserRole = body.role === 'admin' ? 'admin' : 'user';

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!password || password.length < 6) {
      return new Response(JSON.stringify({ error: 'Password must be at least 6 characters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create auth user using Admin API
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      console.error('auth.admin.createUser error:', authError);
      return new Response(
        JSON.stringify({ error: `Failed to create auth user: ${authError.message}` }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    if (!authData.user) {
      return new Response(JSON.stringify({ error: 'Failed to create auth user: No user returned' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create corresponding user_profiles row
    const { data: profileData, error: insertError } = await adminClient
      .from('user_profiles')
      .insert({
        user_id: authData.user.id,
        email,
        role,
        created_by: user.id,
      })
      .select('*')
      .single();

    if (insertError) {
      console.error('Failed to insert user_profile, rolling back auth user:', insertError);
      try {
        await adminClient.auth.admin.deleteUser(authData.user.id);
      } catch (cleanupError) {
        console.error('Failed to clean up auth user after profile insert failure:', cleanupError);
      }

      return new Response(
        JSON.stringify({ error: `Failed to create user profile: ${insertError.message}` }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const responseProfile = {
      id: profileData.id,
      user_id: profileData.user_id,
      email: profileData.email,
      role: profileData.role as UserRole,
      created_by: profileData.created_by,
      created_at: profileData.created_at,
      updated_at: profileData.updated_at,
    };

    return new Response(JSON.stringify({ profile: responseProfile }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Unhandled error in admin-create-user function:', err);
    return new Response(JSON.stringify({ error: 'Unexpected server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

