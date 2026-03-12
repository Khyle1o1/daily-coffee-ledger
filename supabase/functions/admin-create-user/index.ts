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

  // These are automatically injected by Supabase for every deployed function.
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
    // -----------------------------------------------------------------------
    // 1. Validate the calling user's JWT using the RECOMMENDED Supabase pattern.
    //    Create a user-scoped client (anon key + caller's Authorization header)
    //    and call getUser() with no args — Supabase verifies the token internally.
    //    Using adminClient.auth.getUser(token) is NOT the correct pattern and
    //    is what causes "Invalid JWT" errors.
    // -----------------------------------------------------------------------
    const authorizationHeader = req.headers.get('Authorization') ?? '';

    if (!authorizationHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized: missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorizationHeader } },
      auth: { persistSession: false },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();

    if (userError || !user) {
      console.error('Failed to validate caller JWT:', userError);
      return new Response(
        JSON.stringify({ error: userError?.message ?? 'Unauthorized: invalid or expired session' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // -----------------------------------------------------------------------
    // 2. Use the service-role admin client for all privileged operations.
    // -----------------------------------------------------------------------
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // -----------------------------------------------------------------------
    // 3. Confirm the calling user is an admin via user_profiles.
    // -----------------------------------------------------------------------
    const { data: callerProfile, error: profileError } = await adminClient
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

    if (!callerProfile || callerProfile.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden: admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // -----------------------------------------------------------------------
    // 4. Parse and validate the request body.
    // -----------------------------------------------------------------------
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

    // -----------------------------------------------------------------------
    // 5. Create the auth user and profile row.
    // -----------------------------------------------------------------------
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
      return new Response(
        JSON.stringify({ error: 'Failed to create auth user: No user returned' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

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

    return new Response(
      JSON.stringify({
        profile: {
          id: profileData.id,
          user_id: profileData.user_id,
          email: profileData.email,
          role: profileData.role as UserRole,
          created_by: profileData.created_by,
          created_at: profileData.created_at,
          updated_at: profileData.updated_at,
        },
      }),
      {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (err) {
    console.error('Unhandled error in admin-create-user function:', err);
    return new Response(JSON.stringify({ error: 'Unexpected server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
