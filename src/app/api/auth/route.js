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

    const existingQuery = query(
      collection(db, 'users'),
      where('username', '==', username),
      limit(1),
    )
    const existingSnapshot = await getDocs(existingQuery)

    if (!existingSnapshot.empty) {
      const existingUser = existingSnapshot.docs[0].data()
      const isPasswordValid = await bcrypt.compare(
        password,
        existingUser.passwordHash,
      )

      if (!isPasswordValid) {
        return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
      }

      return NextResponse.json({ userExists: true })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    await addDoc(collection(db, 'users'), {
      username,
      passwordHash,
      createdAt: new Date(),
    })

    return NextResponse.json({ userExists: false })
  } catch (error) {
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 })
  }
}
