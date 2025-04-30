import { db } from '@/db';
import { status } from '@/db/schema';
import { NextResponse } from 'next/server';

// GET all statuses
export async function GET() {
  try {
    const allStatuses = await db.select().from(status);
    return NextResponse.json(allStatuses);
  } catch (error) {
    console.error('Error fetching statuses:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch statuses';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST new status
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const newStatus = await db.insert(status).values(body).returning();
    return NextResponse.json(newStatus[0], { status: 201 });
  } catch (error) {
    console.error('Error creating status:', error);
    const message = error instanceof Error ? error.message : 'Failed to create status';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
