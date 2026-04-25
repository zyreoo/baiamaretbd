import { NextResponse } from 'next/server'

const HACKCLUB_API = 'https://ai.hackclub.com/proxy/v1/chat/completions'
const MODEL = 'qwen/qwen3-32b'
const AI_TIMEOUT_MS = 25000

function compactProfile(profile) {
  return {
    learner_type: profile?.learner_type || 'Learner',
    learning_style: profile?.learning_style || 'mixed',
    pace: profile?.pace || 'mixed',
    support_style: profile?.support_style || 'mixed',
    motivation_type: profile?.motivation_type || 'mixed',
  }
}

function buildPrompt(profile, selectedClass, selectedSubject, selectedTopic) {
  return `Create a personalized interactive lesson.

Context:
- profile: ${JSON.stringify(compactProfile(profile))}
- class: ${selectedClass}
- subject: ${selectedSubject}
- topic: ${selectedTopic}

Return JSON only with keys:
title, intro, estimated_time, total_xp, steps, challenge_mode, final_message, study_tip.

Requirements:
- 3 steps exactly: concept, example, practice.
- Each step: id, type, title, content, question.
- question must include: text, options(3), correct_answer, xp, feedback_correct, feedback_wrong, hint, simpler_explanation.
- XP: 10, 15, 20. total_xp = 45.
- challenge_mode has exactly 2 questions, xp 30 each, total_bonus_xp = 60.
- Keep content short and demo-ready (2-3 sentences max).
- Match learning_style in tone and examples.
- Return valid JSON only, no markdown fences.`
}

function fallbackLesson(selectedTopic, selectedSubject, profile) {
  const style = profile?.learning_style || 'mixed'
  const introByStyle = {
    visual: `Let's explore ${selectedTopic} using simple visuals and clear patterns.`,
    practical: `Since you learn by doing, we'll work through ${selectedTopic} with hands-on questions.`,
    logical: `We'll break ${selectedTopic} down step by step so the reasoning is crystal clear.`,
    'story-based': `Let's understand ${selectedTopic} through a real-life story you can relate to.`,
    mixed: `Let's explore ${selectedTopic} with a balanced mix of ideas, examples, and practice.`,
  }

  return {
    title: selectedTopic,
    intro: introByStyle[style] || introByStyle.mixed,
    estimated_time: '3-5 min',
    total_xp: 45,
    steps: [
      {
        id: 1,
        type: 'concept',
        title: `What is ${selectedTopic}?`,
        content: `${selectedTopic} is one of the foundational ideas in ${selectedSubject}. Understanding it unlocks many related topics.`,
        question: {
          text: `Which of the following best describes ${selectedTopic}?`,
          options: [
            'A foundational concept in this subject',
            'An unrelated topic',
            'A historical figure',
          ],
          correct_answer: 'A foundational concept in this subject',
          xp: 10,
          feedback_correct: 'Exactly! Knowing this opens the door to deeper learning.',
          feedback_wrong: 'Not quite — think about how this topic fits inside the bigger subject.',
          hint: 'Look for the option that mentions a concept rather than a person or event.',
          simpler_explanation: `Think of ${selectedTopic} like a building block — it's a basic piece you'll use again and again.`,
        },
      },
      {
        id: 2,
        type: 'example',
        title: 'A simple example',
        content: `A clear example helps make ${selectedTopic} click. Picture a small everyday situation that shows the idea in action.`,
        question: {
          text: 'Why are simple, real-life examples useful when learning a new topic?',
          options: [
            'They make abstract ideas easier to remember',
            'They make things more confusing',
            'They are only for very young students',
          ],
          correct_answer: 'They make abstract ideas easier to remember',
          xp: 15,
          feedback_correct: 'Yes! Examples turn abstract ideas into something your brain can hold on to.',
          feedback_wrong: 'Examples actually help — they connect new ideas to things you already know.',
          hint: 'Think about how stories and visuals stay in your memory.',
          simpler_explanation: 'Imagine learning to ride a bike from a video versus actually trying it — the example is the bike ride.',
        },
      },
      {
        id: 3,
        type: 'practice',
        title: 'Quick practice',
        content: `The best way to lock in ${selectedTopic} is to try a question yourself. Don't worry about getting it perfect.`,
        question: {
          text: 'What is the best way to remember a new topic for the long term?',
          options: [
            'Practice it across several short sessions',
            'Read it once and never review it',
            'Memorize the entire chapter in one sitting',
          ],
          correct_answer: 'Practice it across several short sessions',
          xp: 20,
          feedback_correct: 'Correct! Spaced practice beats cramming every time.',
          feedback_wrong: 'Cramming feels productive but fades fast — short, repeated sessions stick.',
          hint: 'Think about how athletes train — short, repeated, deliberate.',
          simpler_explanation: 'Your brain is like a muscle. Many small workouts make it stronger than one giant one.',
        },
      },
    ],
    challenge_mode: {
      title: 'Challenge yourself',
      description: 'Two harder questions to earn bonus XP.',
      total_bonus_xp: 60,
      questions: [
        {
          text: `Which strategy would deepen your understanding of ${selectedTopic} the fastest?`,
          options: [
            'Teaching it to someone else in your own words',
            'Highlighting the textbook in many colors',
            'Reading the chapter title only',
          ],
          correct_answer: 'Teaching it to someone else in your own words',
          xp: 30,
          feedback_correct: 'Perfect! Teaching forces you to organize what you know.',
          feedback_wrong: 'Highlighting feels useful but teaching is far more powerful.',
          hint: 'Think about what action requires the deepest understanding.',
        },
        {
          text: `When stuck on ${selectedTopic}, what is the smartest first move?`,
          options: [
            'Look back at a related, simpler example',
            'Give up and switch topics',
            'Memorize the answer without understanding',
          ],
          correct_answer: 'Look back at a related, simpler example',
          xp: 30,
          feedback_correct: 'Yes! Building on a simpler example is a great recovery move.',
          feedback_wrong: 'Switching topics or memorizing without understanding leaves gaps.',
          hint: 'Think about how you can reuse what you already understand.',
        },
      ],
    },
    final_message: 'Great work! Every small step builds real mastery.',
    study_tip: 'Review this topic again tomorrow — even a 2-minute recap doubles long-term retention.',
  }
}

export async function POST(request) {
  let parsedBody = {}
  let timeoutId = null
  try {
    parsedBody = await request.json()
    const { profile, selectedClass, selectedSubject, selectedTopic } = parsedBody

    if (!selectedClass || !selectedSubject || !selectedTopic) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }

    const apiKey = process.env.HACKCLUB_AI_API_KEY
    if (!apiKey) {
      console.warn('HACKCLUB_AI_API_KEY not set — returning fallback lesson.')
      return NextResponse.json({ lesson: fallbackLesson(selectedTopic, selectedSubject, profile) })
    }

    const controller = new AbortController()
    timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS)

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
              'You are a friendly AI tutor for students. Create short, clear, personalized, gamified lessons. Keep language simple, encouraging, and age-appropriate. Always return valid JSON only — no markdown, no commentary.',
          },
          {
            role: 'user',
            content: buildPrompt(profile, selectedClass, selectedSubject, selectedTopic),
          },
        ],
        temperature: 0.35,
        max_tokens: 1400,
      }),
    })
    clearTimeout(timeoutId)

    if (!aiResponse.ok) {
      const errText = await aiResponse.text()
      console.error('Hack Club AI error:', errText)
      return NextResponse.json({ lesson: fallbackLesson(selectedTopic, selectedSubject, profile) })
    }

    const rawResponseText = await aiResponse.text()
    let rawContent = ''

    try {
      const aiData = JSON.parse(rawResponseText)
      rawContent = aiData?.choices?.[0]?.message?.content || ''
    } catch {
      // If provider returns non-JSON text, we still fall back gracefully.
      console.warn('AI returned non-JSON payload. Raw head:', rawResponseText.slice(0, 120))
      return NextResponse.json({ lesson: fallbackLesson(selectedTopic, selectedSubject, profile) })
    }

    const cleaned = rawContent
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim()

    let lesson
    try {
      lesson = JSON.parse(cleaned)
    } catch {
      // Try to salvage JSON object if the model wrapped it with extra text.
      try {
        const jsonStart = cleaned.indexOf('{')
        const jsonEnd = cleaned.lastIndexOf('}')
        if (jsonStart >= 0 && jsonEnd > jsonStart) {
          lesson = JSON.parse(cleaned.slice(jsonStart, jsonEnd + 1))
        } else {
          throw new Error('No JSON object bounds found')
        }
      } catch {
        console.warn('Could not parse AI JSON response — using fallback. Raw:', rawContent.slice(0, 300))
        lesson = fallbackLesson(selectedTopic, selectedSubject, profile)
      }
    }

    // Light sanity check — if the model omitted the new structure, fall back
    if (!Array.isArray(lesson?.steps) || lesson.steps.length < 1) {
      console.warn('AI lesson missing steps — using fallback.')
      lesson = fallbackLesson(selectedTopic, selectedSubject, profile)
    }

    return NextResponse.json({ lesson })
  } catch (err) {
    if (timeoutId) clearTimeout(timeoutId)
    if (err?.name === 'AbortError') {
      console.warn('generate-lesson timed out — using fallback lesson.')
      return NextResponse.json({
        lesson: fallbackLesson(
          parsedBody?.selectedTopic || 'Topic',
          parsedBody?.selectedSubject || 'Subject',
          parsedBody?.profile || {},
        ),
      })
    }
    console.error('generate-lesson route error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
