import { NextResponse } from 'next/server';
import { sendOTPEmail } from '@/lib/mailer';

export async function POST(req: Request) {
  try {
    const { email, otp } = await req.json();

    if (!email || !otp) {
      return NextResponse.json(
        { error: 'Email and OTP are required' },
        { status: 400 }
      );
    }

    const success = await sendOTPEmail(email, otp);

    if (success) {
      return NextResponse.json(
        { message: 'OTP sent successfully' },
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        { error: 'Failed to send OTP' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Send OTP error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
