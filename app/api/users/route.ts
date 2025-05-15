import { userService } from '@/lib/services/userService';
import { NextResponse } from 'next/server';

// GET all users
export async function GET() {
  try {
    const allUsers = userService.getAllUsers();
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
    const newUser = await userService.createUser(body);
    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'DUPLICATE_USER') {
      return NextResponse.json({ error: 'User already exists' }, { status: 409 });
    }
    console.error('Error creating user:', error);
    const message = error instanceof Error ? error.message : 'Failed to create user';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
