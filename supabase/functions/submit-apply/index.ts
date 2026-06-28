import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const { fullName, phone, email, pncNumber, pncExpiry, cnic, aiExtractedData } = body;

    if (!fullName || !pncNumber) {
      return new Response(JSON.stringify({ error: 'Full name and PNC license number are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data, error } = await supabase
      .from('nurse_applications')
      .insert({
        full_name: fullName,
        phone: phone || null,
        email: email || null,
        pnc_license_number: pncNumber,
        pnc_expiry_date: pncExpiry || null,
        cnic_number: cnic || null,
        ai_extracted_data: aiExtractedData || null,
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      console.error('DB insert error:', error);
      return new Response(JSON.stringify({ error: 'Failed to save application', details: error }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true, applicant: data }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('submit-apply error:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
