import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export const sendOTPEmail = async (email: string, otp: string) => {
  const mailOptions = {
    from: process.env.GMAIL_USER,
    to: email,
    subject: 'Your Vasoli Verification Code',
    html: `
      <div style="font-family: inherit; max-width: 600px; margin: 0 auto; padding: 20px; border: 2px solid #000; background-color: #f7f3ec;">
        <h2 style="color: #000; text-transform: uppercase; border-bottom: 2px solid #000; padding-bottom: 10px;">Vasoli Login</h2>
        <p style="font-size: 16px; font-weight: 500;">Hello!</p>
        <p style="font-size: 16px;">Here is your one-time password (OTP) to access your Vasoli account:</p>
        <div style="margin: 30px 0; padding: 15px; background-color: #ffd84d; border: 2px solid #000; text-align: center;">
          <h1 style="margin: 0; font-size: 32px; letter-spacing: 5px;">${otp}</h1>
        </div>
        <p style="font-size: 14px; color: #555;">This code will expire in 10 minutes. If you didn't request this, please ignore this email.</p>
        <p style="font-size: 14px; font-weight: bold; margin-top: 30px;">Keep it safe. Keep it simple.</p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
};
