import { NextResponse } from 'next/server'

const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL = 'llama-3.1-8b-instant'

const HACKCLUB_API = 'https://ai.hackclub.com/proxy/v1/chat/completions'
const HACKCLUB_MODEL = 'qwen/qwen3-32b'

const AI_TIMEOUT_MS = 10000

function buildSystemPrompt({ profile, selectedClass, selectedSubject, selectedTopic, lesson }) {
  const style = profile?.learning_style || 'mixed'
  const styleHint = {
    visual: 'Prefer short visual descriptions, patterns, and analogies the student can picture.',
    practical: 'Prefer concrete examples and small "try this" suggestions.',
    logical: 'Explain the reasoning step by step in 2-3 short steps.',
    'story-based': 'Use a brief real-life story or analogy.',
    mixed: 'Use a balanced explanation with one example.',
  }[style] || 'Use a balanced explanation with one example.'

  return `You are a friendly AI tutor helping a ${selectedClass} student.
The current topic is "${selectedTopic}" in ${selectedSubject}.
Lesson title: "${lesson?.title || selectedTopic}".

Rules:
- ONLY answer questions about the current topic ("${selectedTopic}") or directly related foundations.
- If the student asks about something unrelated, gently redirect them back to the current topic in 1 sentence.
- Keep your answer SHORT (2-4 sentences max). No markdown, no headings, no lists unless absolutely necessary.
- Personalize the explanation to the student's learning style: ${styleHint}
- Be warm and encouraging. Never condescending.`
}

export async function POST(request) {
  let parsedBody = {}
  let timeoutId = null
  try {
    parsedBody = await request.json()
    const { profile, selectedClass, selectedSubject, selectedTopic, lesson, question } = parsedBody

    if (!question || !selectedTopic) {
      return NextResponse.json({ error: 'Missing question or topic.' }, { status: 400 })
    }

    const groqKey = process.env.GROQ_API_KEY
    const hackclubKey = process.env.HACKCLUB_AI_API_KEY

    if (!groqKey && !hackclubKey) {
      return NextResponse.json({
        answer: `Great question about ${selectedTopic}! (Set GROQ_API_KEY or HACKCLUB_AI_API_KEY to get a real answer.)`,
      })
    }

    const useGroq = !!groqKey
    const apiKey = useGroq ? groqKey : hackclubKey
    const apiUrl = useGroq ? GROQ_API : HACKCLUB_API
    const model = useGroq ? GROQ_MODEL : HACKCLUB_MODEL

    const controller = new AbortController()
    timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS)

    const aiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: buildSystemPrompt({ profile, selectedClass, selectedSubject, selectedTopic, lesson }),
          },
          { role: 'user', content: question.trim().slice(0, 600) },
        ],
        temperature: 0.35,
        max_tokens: 220,
      }),
    })
    clearTimeout(timeoutId)

    if (!aiResponse.ok) {
      const errText = await aiResponse.text()
      console.error('ask-tutor AI error:', errText)
      return NextResponse.json({
        answer: `Hmm, I couldn't reach the tutor right now. Try again in a moment.`,
      })
    }

    const rawResponseText = await aiResponse.text()
    let raw = ''
    try {
      const aiData = JSON.parse(rawResponseText)
      raw = aiData?.choices?.[0]?.message?.content || ''
    } catch {
      console.warn('ask-tutor returned non-JSON payload. Raw head:', rawResponseText.slice(0, 120))
      return NextResponse.json({
        answer: `Let's keep it simple: ${selectedTopic} becomes easier when we break it into one tiny step at a time.`,
      })
    }
    const answer = raw.replace(/^```[\s\S]*?\n/, '').replace(/```$/, '').trim()

    return NextResponse.json({ answer: answer || `Let's stay focused on ${selectedTopic} — what part is unclear?` })
  } catch (err) {
    if (timeoutId) clearTimeout(timeoutId)
    if (err?.name === 'AbortError') {
      const selectedTopic = parsedBody?.selectedTopic || 'this topic'
      return NextResponse.json({
        answer: `Quick version: focus on one basic idea in ${selectedTopic}, then test yourself with one tiny question.`,
      })
    }
    console.error('ask-tutor route error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
