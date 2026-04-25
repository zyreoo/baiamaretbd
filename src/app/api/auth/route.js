import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { addDoc, collection, getDocs, limit, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export async function POST(request) {
  try {
    const body = await request.json()
    const username = body?.username?.trim()
    const password = body?.password

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 },
      )
    }

    const existingUserQuery = query(
      collection(db, 'users'),
      where('username', '==', username),
      limit(1),
    )
    const existingUserSnapshot = await getDocs(existingUserQuery)

    if (!existingUserSnapshot.empty) {
      const existingUserDoc = existingUserSnapshot.docs[0]
      const existingUser = existingUserDoc.data()
      const isValidPassword = await bcrypt.compare(password, existingUser.passwordHash)

      if (!isValidPassword) {
        return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })
      }

      return NextResponse.json({ ok: true, userExists: true, username, userId: existingUserDoc.id })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const createdUserRef = await addDoc(collection(db, 'users'), {
      username,
      passwordHash,
      createdAt: new Date(),
    })

    return NextResponse.json({
      ok: true,
      userExists: false,
      username,
      userId: createdUserRef.id,
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Unable to authenticate user' },
      { status: 500 },
    )
  }
}
