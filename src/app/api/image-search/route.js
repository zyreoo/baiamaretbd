import { NextResponse } from 'next/server'

const WIKI_API = 'https://en.wikipedia.org/w/api.php'

function normalizeTitle(title = '') {
  return String(title).replace(/\s+/g, ' ').trim()
}

export async function POST(request) {
  try {
    const body = await request.json()
    const queryText = String(body?.query || '').trim().slice(0, 220)

    if (!queryText) {
      return NextResponse.json({ images: [] })
    }

    // 1) Search Wikipedia pages relevant to the visual query.
    const searchUrl = `${WIKI_API}?action=query&list=search&format=json&utf8=1&origin=*&srlimit=8&srsearch=${encodeURIComponent(queryText)}`
    const searchRes = await fetch(searchUrl)
    const searchJson = await searchRes.json()
    const titles = (searchJson?.query?.search || [])
      .map((s) => normalizeTitle(s.title))
      .filter(Boolean)
      .slice(0, 6)

    if (titles.length === 0) {
      return NextResponse.json({ images: [] })
    }

    // 2) Fetch thumbnails + source URLs for those pages.
    const detailUrl = `${WIKI_API}?action=query&format=json&origin=*&prop=pageimages|info&inprop=url&pithumbsize=700&titles=${encodeURIComponent(titles.join('|'))}`
    const detailRes = await fetch(detailUrl)
    const detailJson = await detailRes.json()
    const pages = Object.values(detailJson?.query?.pages || {})

    const images = pages
      .map((p) => ({
        title: normalizeTitle(p?.title),
        url: p?.thumbnail?.source || null,
        sourceUrl: p?.fullurl || null,
      }))
      .filter((p) => p.url && p.sourceUrl)
      .slice(0, 5)

    return NextResponse.json({ images })
  } catch (err) {
    console.warn('image-search failed:', err?.message)
    return NextResponse.json({ images: [] })
  }
}
