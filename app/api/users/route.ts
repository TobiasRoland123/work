import { db } from '@/db';
import { users } from '@/db/schema';
import { NextResponse } from 'next/server';

// GET all users
export async function GET() {
  try {
    const allUsers = await db.select().from(users);
    return NextResponse.json(allUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch users';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST new user
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const newUser = await db.insert(users).values(body).returning();
    return NextResponse.json(newUser[0], { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    const message = error instanceof Error ? error.message : 'Failed to create user';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
