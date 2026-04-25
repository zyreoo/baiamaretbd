import { NextResponse } from 'next/server'

const HACKCLUB_API = 'https://ai.hackclub.com/proxy/v1/chat/completions'

// 🔥 model mai rapid
const MODEL = 'qwen/qwen3-7b'

// 🔥 prompt mult mai scurt (BIG WIN)
function buildPrompt(profile, selectedClass, selectedSubject, selectedTopic) {
  return `Create a short personalized lesson.

Student: ${JSON.stringify(profile)}
Class: ${selectedClass}
Subject: ${selectedSubject}
Topic: ${selectedTopic}

Return ONLY valid JSON with:
- title
- intro (personalized)
- estimated_time ("3-5 min")
- total_xp = 45
- steps (3): concept, example, practice
- each step has 1 MCQ with 3 options
- challenge_mode with 2 questions

Rules:
- short explanations (max 2 sentences)
- friendly tone
- adapt to learning_style
- no markdown, no extra text`
}

// fallback rămâne simplu și rapid
function fallbackLesson(topic, subject) {
  return {
    title: topic,
    intro: `Let's quickly explore ${topic} in ${subject}.`,
    estimated_time: '3-5 min',
    total_xp: 45,
    steps: [
      {
        id: 1,
        type: 'concept',
        title: `What is ${topic}?`,
        content: `${topic} is an important concept in ${subject}.`,
        question: {
          text: `What is ${topic}?`,
          options: ['A concept', 'A person', 'A place'],
          correct_answer: 'A concept',
          xp: 10,
          feedback_correct: 'Correct!',
          feedback_wrong: 'Not quite.',
          hint: 'Think subject-related.',
          simpler_explanation: 'It’s like a basic idea you use often.',
        },
      },
      {
        id: 2,
        type: 'example',
        title: 'Example',
        content: `Here’s a simple example of ${topic}.`,
        question: {
          text: 'Why are examples useful?',
          options: ['They help understanding', 'They confuse', 'No reason'],
          correct_answer: 'They help understanding',
          xp: 15,
          feedback_correct: 'Yes!',
          feedback_wrong: 'Try again.',
          hint: 'Think learning.',
          simpler_explanation: 'Examples make things easier.',
        },
      },
      {
        id: 3,
        type: 'practice',
        title: 'Practice',
        content: `Try applying ${topic}.`,
        question: {
          text: 'Best way to learn?',
          options: ['Practice', 'Ignore', 'Memorize once'],
          correct_answer: 'Practice',
          xp: 20,
          feedback_correct: 'Great!',
          feedback_wrong: 'Not ideal.',
          hint: 'Think repetition.',
          simpler_explanation: 'Practice makes you better.',
        },
      },
    ],
    challenge_mode: {
      title: 'Challenge',
      description: 'Harder questions',
      total_bonus_xp: 60,
      questions: [
        {
          text: 'Best deep learning method?',
          options: ['Teach it', 'Ignore', 'Skim'],
          correct_answer: 'Teach it',
          xp: 30,
          feedback_correct: 'Perfect!',
          feedback_wrong: 'Try deeper thinking.',
          hint: 'Think active.',
        },
        {
          text: 'When stuck?',
          options: ['Simplify', 'Quit', 'Guess'],
          correct_answer: 'Simplify',
          xp: 30,
          feedback_correct: 'Yes!',
          feedback_wrong: 'Not effective.',
          hint: 'Go simpler.',
        },
      ],
    },
    final_message: 'Nice work!',
    study_tip: 'Review tomorrow for better memory.',
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { profile, selectedClass, selectedSubject, selectedTopic } = body

    if (!selectedClass || !selectedSubject || !selectedTopic) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }

    const apiKey = process.env.HACKCLUB_AI_API_KEY
    if (!apiKey) {
      return NextResponse.json({
        lesson: fallbackLesson(selectedTopic, selectedSubject),
      })
    }

    // 🔥 timeout (important)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    const aiResponse = await fetch(HACKCLUB_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content:
              'You are a friendly AI tutor. Always return valid JSON only.',
          },
          {
            role: 'user',
            content: buildPrompt(
              profile,
              selectedClass,
              selectedSubject,
              selectedTopic
            ),
          },
        ],
        temperature: 0.7,
        max_tokens: 400, // 🔥 LIMITARE IMPORTANTĂ
      }),
    })

    clearTimeout(timeout)

    if (!aiResponse.ok) {
      return NextResponse.json({
        lesson: fallbackLesson(selectedTopic, selectedSubject),
      })
    }

    const aiData = await aiResponse.json()
    const rawContent = aiData?.choices?.[0]?.message?.content || ''

    // 🔥 curățare mai sigură
    const cleaned = rawContent
      .replace(/```json|```/g, '')
      .trim()

    let lesson
    try {
      lesson = JSON.parse(cleaned)
    } catch {
      lesson = fallbackLesson(selectedTopic, selectedSubject)
    }

    if (!lesson?.steps || lesson.steps.length < 3) {
      lesson = fallbackLesson(selectedTopic, selectedSubject)
    }

    return NextResponse.json({ lesson })
  } catch (err) {
    console.error(err)

    return NextResponse.json({
      lesson: fallbackLesson('Topic', 'Subject'),
    })
  }
}