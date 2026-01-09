export default async function handler(req, res) {
  // Handle OPTIONS request for CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  try {
    const body = req.body;
    
    console.log('📥 Received data:', JSON.stringify(body, null, 2));
    
    // Extract fields
    const firstname = body.firstname || body.Firstname;
    const lastname = body.lastname || body.Lastname;
    const email = body.email || body.Email;
    const postalcode = body.postalcode || body.Postcode || body.postalCode;
    const countrycode = body.countrycode || body.Country || body.country;
    
    // Get captcha token
    const captchaToken = body.captchaToken || 
                        body['g-recaptcha-response'] || 
                        body.recaptcha_token;

    console.log('📋 Extracted fields:', {
      firstname,
      lastname,
      email,
      postalcode,
      countrycode,
      hasCaptchaToken: !!captchaToken
    });

    // Validate required fields
    if (!email) {
      console.error('❌ Missing email');
      return res.status(400).json({ 
        error: 'Email is required',
        received: body
      });
    }
    
    if (!countrycode) {
      console.error('❌ Missing countrycode');
      return res.status(400).json({ 
        error: 'Country code is required',
        received: body
      });
    }
    
    if (!captchaToken) {
      console.error('❌ Missing captcha token');
      return res.status(400).json({ 
        error: 'Captcha token is required',
        fieldChecked: ['captchaToken', 'g-recaptcha-response', 'recaptcha_token'],
        received: Object.keys(body)
      });
    }

    console.log('✅ All required fields present');

    // Verify reCAPTCHA
    console.log('🔐 Verifying captcha...');
    const captchaResponse = await fetch(
      'https://www.google.com/recaptcha/api/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${captchaToken}`
      }
    );

    const captchaData = await captchaResponse.json();
    console.log('🔐 Captcha result:', captchaData);

    if (!captchaData.success) {
      console.error('❌ Captcha verification failed:', captchaData['error-codes']);
      return res.status(400).json({ 
        error: 'Captcha verification failed',
        details: captchaData['error-codes'],
        captchaResponse: captchaData
      });
    }

    console.log('✅ Captcha verified successfully');

    // Prepare data for ViceVersa
    const viceVersaData = new URLSearchParams({
      email: email,
      countrycode: countrycode.toUpperCase(),
      ...(firstname && { firstname }),
      ...(lastname && { lastname }),
      ...(postalcode && { postalcode }),
      dm_this: '1',
      dm_format: '2'
    });
    
    console.log('📤 Sending to ViceVersa:', viceVersaData.toString());

    // Submit to ViceVersa
    const viceVersaUrl = process.env.VICEVERSA_URL;
    
    if (!viceVersaUrl) {
      console.error('❌ VICEVERSA_URL not set');
      return res.status(500).json({ error: 'ViceVersa URL not configured' });
    }

    console.log('🌐 Posting to:', viceVersaUrl);
    
    const vvResponse = await fetch(viceVersaUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: viceVersaData.toString()
    });

    const vvText = await vvResponse.text();
    console.log('📥 ViceVersa response status:', vvResponse.status);
    console.log('📥 ViceVersa response:', vvText);

    if (!vvResponse.ok) {
      console.error('❌ ViceVersa rejected submission');
      return res.status(500).json({ 
        error: 'Failed to submit to ViceVersa',
        status: vvResponse.status,
        response: vvText
      });
    }

    console.log('✅ Successfully submitted to ViceVersa');

    return res.status(200).json({ 
      success: true,
      message: 'Form submitted successfully. Please check your email to confirm.'
    });

  } catch (error) {
    console.error('💥 Server error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message,
      stack: error.stack
    });
  }
}
