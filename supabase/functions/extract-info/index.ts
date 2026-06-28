Deno.serve(async (req) => {
  try {
    const { image, mimeType } = await req.json();
    
    if (!image) {
      return new Response(JSON.stringify({ error: 'No image provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) {
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const prompt = `Extract the following information from this Pakistan Nursing Council (PNC) license document or CV:\n\n1. Full name of the nurse\n2. PNC license number\n3. PNC license expiry date\n4. Phone number\n5. Email address\n6. CNIC number (Computerized National Identity Card number)\n\nReturn ONLY valid JSON (no markdown, no code blocks) with these exact keys:\n{\n  "extractedName": "",\n  "extractedPncNumber": "",\n  "extractedPncExpiry": "",\n  "extractedPhone": "",\n  "extractedEmail": "",\n  "extractedCnic": ""\n}\n\nIf a field cannot be found, use null as the value.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inlineData: { mimeType: mimeType || 'image/jpeg', data: image } },
              { text: prompt }
            ]
          }]
        })
      }
    );

    const result = await response.json();
    
    if (!response.ok) {
      console.error('Gemini API error:', JSON.stringify(result));
      return new Response(JSON.stringify({ error: 'AI extraction failed', details: result }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const text = result?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    
    let parsed;
    try {
      parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
    } catch {
      parsed = { rawText: text };
    }

    return new Response(JSON.stringify({ success: true, data: parsed }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('extract-info error:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
