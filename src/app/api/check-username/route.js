import { NextResponse } from 'next/server'
import { collection, getDocs, limit, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const username = searchParams.get('username')?.trim()

  if (!username) {
    return NextResponse.json({ exists: false })
  }

  try {
    const existingQuery = query(
      collection(db, 'users'),
      where('username', '==', username),
      limit(1),
    )
    const snapshot = await getDocs(existingQuery)
    return NextResponse.json({ exists: !snapshot.empty })
  } catch (error) {
    return NextResponse.json(
      { error: 'Unable to check username availability' },
      { status: 500 },
    )
  }
}
