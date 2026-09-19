import { NextRequest, NextResponse } from 'next/server';
import { calculateBookingPrice, type ServiceLevelName } from '@/lib/pricing';

const LEVELS = ['Basic', 'Standard', 'Professional'] as const;

export async function GET(request: NextRequest) {
  const level = request.nextUrl.searchParams.get('level') as ServiceLevelName | null;
  const duration = Number(request.nextUrl.searchParams.get('duration'));

  if (!level || !LEVELS.includes(level) || ![30, 60, 120].includes(duration)) {
    return NextResponse.json(
      { error: 'level must be Basic, Standard or Professional and duration must be 30, 60 or 120.' },
      { status: 400 },
    );
  }

  const pricing = calculateBookingPrice({
    level,
    durationMinutes: duration as 30 | 60 | 120,
  });

  return NextResponse.json(pricing);
}
