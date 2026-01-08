export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  try {
    const {
      firstname,
      lastname,
      email,
      postalcode,
      countrycode,
      captchaToken
    } = req.body;

    if (!email || !countrycode || !captchaToken) {
      return res.status(400).json({ 
        error: 'Missing required fields: email, countrycode, or captcha token' 
      });
    }

    const captchaResponse = await fetch(
      'https://www.google.com/recaptcha/api/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${captchaToken}`
      }
    );

    const captchaData = await captchaResponse.json();

    if (!captchaData.success) {
      return res.status(400).json({ 
        error: 'Captcha verification failed',
        details: captchaData['error-codes']
      });
    }

    const viceVersaData = new URLSearchParams({
      email: email,
      countrycode: countrycode.toUpperCase(),
      ...(firstname && { firstname }),
      ...(lastname && { lastname }),
      ...(postalcode && { postalcode }),
      dm_this: '1',
      dm_format: '2'
    });

    const viceVersaUrl = process.env.VICEVERSA_URL;
    
    const vvResponse = await fetch(viceVersaUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: viceVersaData.toString()
    });

    if (!vvResponse.ok) {
      console.error('ViceVersa error:', await vvResponse.text());
      return res.status(500).json({ 
        error: 'Failed to submit to ViceVersa',
        status: vvResponse.status
      });
    }

    return res.status(200).json({ 
      success: true,
      message: 'Form submitted successfully. Please check your email to confirm.'
    });

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message
    });
  }
}
