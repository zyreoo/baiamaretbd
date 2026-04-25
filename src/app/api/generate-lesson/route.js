import { NextResponse } from 'next/server'

const HACKCLUB_API = 'https://ai.hackclub.com/proxy/v1/chat/completions'
const MODEL = 'qwen/qwen3-32b'

function buildPrompt(profile, selectedClass, selectedSubject, selectedTopic) {
  return `Create a personalized interactive lesson for this student.

Student profile:
${JSON.stringify(profile, null, 2)}

Class:
${selectedClass}

Subject:
${selectedSubject}

Topic:
${selectedTopic}

Return the lesson in this exact JSON format:
{
  "title": "string",
  "intro": "personalized intro based on learner profile",
  "estimated_time": "3-5 min",
  "total_xp": 45,
  "steps": [
    {
      "id": 1,
      "type": "concept",
      "title": "string",
      "content": "short explanation personalized to student profile",
      "question": {
        "text": "quick question to continue",
        "options": ["option 1", "option 2", "option 3"],
        "correct_answer": "option 1",
        "xp": 10,
        "feedback_correct": "short encouraging feedback",
        "feedback_wrong": "short helpful explanation",
        "hint": "short hint without giving answer",
        "simpler_explanation": "explain this like I am 10 using an analogy"
      }
    },
    {
      "id": 2,
      "type": "example",
      "title": "string",
      "content": "simple example",
      "question": {
        "text": "question about the example",
        "options": ["option 1", "option 2", "option 3"],
        "correct_answer": "option 1",
        "xp": 15,
        "feedback_correct": "string",
        "feedback_wrong": "string",
        "hint": "string",
        "simpler_explanation": "string"
      }
    },
    {
      "id": 3,
      "type": "practice",
      "title": "string",
      "content": "practice explanation",
      "question": {
        "text": "practice question",
        "options": ["option 1", "option 2", "option 3"],
        "correct_answer": "option 1",
        "xp": 20,
        "feedback_correct": "string",
        "feedback_wrong": "string",
        "hint": "string",
        "simpler_explanation": "string"
      }
    }
  ],
  "challenge_mode": {
    "title": "Challenge yourself",
    "description": "Two harder questions to earn bonus XP.",
    "total_bonus_xp": 60,
    "questions": [
      {
        "text": "harder question 1",
        "options": ["option 1", "option 2", "option 3"],
        "correct_answer": "option 1",
        "xp": 30,
        "feedback_correct": "string",
        "feedback_wrong": "string",
        "hint": "string"
      },
      {
        "text": "harder question 2",
        "options": ["option 1", "option 2", "option 3"],
        "correct_answer": "option 1",
        "xp": 30,
        "feedback_correct": "string",
        "feedback_wrong": "string",
        "hint": "string"
      }
    ]
  },
  "final_message": "short motivational message",
  "study_tip": "personalized study tip"
}

Rules:
- Create exactly 3 main lesson steps with types: concept, example, practice (in that order).
- Each step must have one multiple-choice question with exactly 3 options.
- The correct_answer field MUST exactly match one of the strings in options.
- XP: step 1 = 10, step 2 = 15, step 3 = 20. total_xp = 45.
- Challenge mode must have exactly 2 harder questions, each worth 30 XP. total_bonus_xp = 60.
- Personalize the intro using the learner's style. Example: "Since you learn best with examples, let's explore Fractions through real-life situations."
- Match content to the learner's learning_style:
  visual → mention patterns, diagrams, colors, visual memory
  practical → exercises and doing-based learning
  logical → step-by-step reasoning
  story-based → real-life analogies
  mixed → balanced explanation
- Match the student's pace and support_style.
- Keep every step short and demo-friendly (2-3 sentences max for content).
- Hints should guide without revealing the answer.
- simpler_explanation should explain "like I'm 10" with an analogy.
- Return ONLY valid JSON. No markdown fences. No prose before or after.`
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
  try {
    const body = await request.json()
    const { profile, selectedClass, selectedSubject, selectedTopic } = body

    if (!selectedClass || !selectedSubject || !selectedTopic) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }

    const apiKey = process.env.HACKCLUB_AI_API_KEY
    if (!apiKey) {
      console.warn('HACKCLUB_AI_API_KEY not set — returning fallback lesson.')
      return NextResponse.json({ lesson: fallbackLesson(selectedTopic, selectedSubject, profile) })
    }

    const aiResponse = await fetch(HACKCLUB_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
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
        temperature: 0.7,
      }),
    })

    if (!aiResponse.ok) {
      const errText = await aiResponse.text()
      console.error('Hack Club AI error:', errText)
      return NextResponse.json({ lesson: fallbackLesson(selectedTopic, selectedSubject, profile) })
    }

    const aiData = await aiResponse.json()
    const rawContent = aiData?.choices?.[0]?.message?.content || ''

    const cleaned = rawContent
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim()

    let lesson
    try {
      lesson = JSON.parse(cleaned)
    } catch {
      console.warn('Could not parse AI JSON response — using fallback. Raw:', rawContent.slice(0, 300))
      lesson = fallbackLesson(selectedTopic, selectedSubject, profile)
    }

    // Light sanity check — if the model omitted the new structure, fall back
    if (!Array.isArray(lesson?.steps) || lesson.steps.length < 1) {
      console.warn('AI lesson missing steps — using fallback.')
      lesson = fallbackLesson(selectedTopic, selectedSubject, profile)
    }

    return NextResponse.json({ lesson })
  } catch (err) {
    console.error('generate-lesson route error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
