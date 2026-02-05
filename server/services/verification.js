import axios from 'axios';
import twilio from 'twilio';

const ZEPTOMAIL_API_KEY = process.env.ZEPTOMAIL_API_KEY;
const ZEPTOMAIL_FROM_EMAIL = process.env.ZEPTOMAIL_FROM_EMAIL || 'noreply@laterbox.app';
const ZEPTOMAIL_FROM_NAME = process.env.ZEPTOMAIL_FROM_NAME || 'LaterBox';

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

// Initialize Twilio client
let twilioClient = null;
if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
  twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
}

/**
 * Send verification code via email using ZeptoMail
 */
export async function sendEmailVerification(email, code) {
  if (!ZEPTOMAIL_API_KEY) {
    throw new Error('ZeptoMail API key not configured');
  }

  const response = await axios.post(
    'https://api.zeptomail.com/v1.1/email',
    {
      from: {
        address: ZEPTOMAIL_FROM_EMAIL,
        name: ZEPTOMAIL_FROM_NAME,
      },
      to: [
        {
          email_address: {
            address: email,
          },
        },
      ],
      subject: 'Your LaterBox verification code',
      htmlbody: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333; margin-bottom: 20px;">Verify your email</h2>
          <p style="color: #666; margin-bottom: 20px;">Use this code to verify your email address in LaterBox:</p>
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 20px;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #333;">${code}</span>
          </div>
          <p style="color: #999; font-size: 14px;">This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
    },
    {
      headers: {
        'Authorization': `Zoho-enczapikey ${ZEPTOMAIL_API_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data;
}

/**
 * Send verification code via SMS using Twilio
 */
export async function sendSmsVerification(phone, code) {
  if (!twilioClient) {
    throw new Error('Twilio not configured');
  }

  const message = await twilioClient.messages.create({
    body: `Your LaterBox verification code is: ${code}. It expires in 10 minutes.`,
    from: TWILIO_PHONE_NUMBER,
    to: phone,
  });

  return message;
}
