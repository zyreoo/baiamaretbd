import { NextResponse } from 'next/server'

const HACKCLUB_API = 'https://ai.hackclub.com/proxy/v1/chat/completions'
const MODEL = 'qwen/qwen3-32b'

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
  try {
    const body = await request.json()
    const { profile, selectedClass, selectedSubject, selectedTopic, lesson, question } = body

    if (!question || !selectedTopic) {
      return NextResponse.json({ error: 'Missing question or topic.' }, { status: 400 })
    }

    const apiKey = process.env.HACKCLUB_AI_API_KEY
    if (!apiKey) {
      return NextResponse.json({
        answer: `Great question about ${selectedTopic}! (AI is not configured yet — set HACKCLUB_AI_API_KEY to get a real answer.)`,
      })
    }

    const aiResponse = await fetch(HACKCLUB_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        stream: true,
        messages: [
          {
            role: 'system',
            content: buildSystemPrompt({ profile, selectedClass, selectedSubject, selectedTopic, lesson }),
          },
          { role: 'user', content: question.trim().slice(0, 600) },
        ],
        temperature: 0.5,
      }),
    })

    if (!aiResponse.ok) {
      const errText = await aiResponse.text()
      console.error('ask-tutor AI error:', errText)
      return NextResponse.json({
        answer: `Hmm, I couldn't reach the tutor right now. Try again in a moment.`,
      })
    }

    const aiData = await aiResponse.json()
    const raw = aiData?.choices?.[0]?.message?.content || ''
    const answer = raw.replace(/^```[\s\S]*?\n/, '').replace(/```$/, '').trim()

    return NextResponse.json({ answer: answer || `Let's stay focused on ${selectedTopic} — what part is unclear?` })
  } catch (err) {
    console.error('ask-tutor route error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
