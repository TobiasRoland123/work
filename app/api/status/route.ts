import { statusService } from '@/lib/services/statusService';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { manualStatus } from '@/lib/status/manual';

export async function GET() {
  const session = await auth();
  if (session?.provider !== 'slack' || !session.userId)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await statusService.getAllStatuses());
}
export async function POST(request: Request) {
  const session = await auth();
  if (session?.provider !== 'slack' || !session.userId)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let value;
  try {
    value = manualStatus(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }
  return NextResponse.json(
    await statusService.createNewStatus({ ...value, userID: session.userId }),
    { status: 201 }
  );
}
