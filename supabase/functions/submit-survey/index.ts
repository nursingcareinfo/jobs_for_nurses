import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const { applicantName, applicantEmail, applicantPhone, surveyData } = body;

    if (!surveyData) {
      return new Response(JSON.stringify({ error: 'Survey data is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data, error } = await supabase
      .from('survey_responses')
      .insert({
        applicant_name: applicantName || null,
        applicant_email: applicantEmail || null,
        applicant_phone: applicantPhone || null,
        survey_data: surveyData
      })
      .select()
      .single();

    if (error) {
      console.error('DB insert error:', error);
      return new Response(JSON.stringify({ error: 'Failed to save survey', details: error }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true, response: data }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('submit-survey error:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
