function hasAny(text, words) {
  const lower = String(text || '').toLowerCase()
  return words.some((word) => lower.includes(word))
}

function getInterests(state) {
  return String(state?.interests || '').toLowerCase()
}

function getEducationStage(state) {
  return String(state?.education_stage || '').toLowerCase()
}

function getFirstName(state) {
  const raw = String(state?.username || '').trim()
  if (!raw) return ''
  return raw.split(/\s+/)[0]
}

function getRecentAnswer(state, questionId) {
  const responses = Array.isArray(state?.responses) ? state.responses : []
  const hit = [...responses].reverse().find((item) => item?.questionId === questionId)
  return String(hit?.answer || '').trim()
}

const QUESTION_BANK = {
  stage: {
    id: 'stage',
    prompt: 'Are you in school, university, or already working?',
    key: 'education_stage',
  },
  schoolClass: {
    id: 'schoolClass',
    prompt: 'What class are you in right now?',
    key: 'school_class',
  },
  universityYear: {
    id: 'universityYear',
    prompt: 'Nice. What year are you currently in?',
    key: 'university_year',
  },
  age: {
    id: 'age',
    prompt: 'How old are you?',
    key: 'age',
  },
  interests: {
    id: 'interests',
    prompt: 'What are your main interests right now (gaming, school, sports, coding, music, etc.)?',
    key: 'interests',
  },
  gamingFocus: {
    id: 'gamingFocus',
    prompt: 'Great. In gaming, what drives you most: competition, strategy, teamwork, or creativity?',
    key: 'gaming_focus',
  },
  studyFocus: {
    id: 'studyFocus',
    prompt: 'Got it. Which subjects do you want to improve most right now?',
    key: 'study_focus',
  },
  codingFocus: {
    id: 'codingFocus',
    prompt: 'Nice. For coding, do you prefer web apps, games, automation, or problem-solving?',
    key: 'coding_focus',
  },
  sportsFocus: {
    id: 'sportsFocus',
    prompt: 'Nice. Do you prefer individual sports, team sports, or fitness goals?',
    key: 'sports_focus',
  },
  goals: {
    id: 'goals',
    prompt: 'What is your main goal here: better grades, learning for fun, productivity, or building projects?',
    key: 'goals',
  },
  goalClarifier: {
    id: 'goalClarifier',
    prompt: 'If you had to pick one priority for the next month, what would it be?',
    key: 'goal_priority',
  },
  learningStyle: {
    id: 'learningStyle',
    prompt: 'When learning something new, what helps most: visuals, examples, practice, short explanations, or stories?',
    key: 'learning_style_signal',
  },
  supportStyle: {
    id: 'supportStyle',
    prompt: 'When something gets hard, do you prefer hints, full explanations, examples, or trying again yourself?',
    key: 'support_style_signal',
  },
}

function getQuestionOrder(state) {
  const education = getEducationStage(state)
  const interests = getInterests(state)

  const order = ['stage']

  if (hasAny(education, ['school', 'high school', 'liceu', 'scoala', 'școal'])) {
    order.push('schoolClass')
  }
  if (hasAny(education, ['university', 'college', 'facult', 'univers'])) {
    order.push('universityYear')
  }

  order.push('age', 'interests')

  if (hasAny(interests, ['game', 'gaming', 'joc'])) order.push('gamingFocus')
  if (hasAny(interests, ['school', 'study', 'exam', 'invat', 'învăț', 'bac'])) order.push('studyFocus')
  if (hasAny(interests, ['coding', 'code', 'program', 'dev'])) order.push('codingFocus')
  if (hasAny(interests, ['sport', 'fitness', 'gym'])) order.push('sportsFocus')

  order.push('goals')

  const goals = String(state?.goals || '').trim()
  if (goals.length < 12) {
    order.push('goalClarifier')
  }

  order.push('learningStyle', 'supportStyle')

  return order
}

function isAnswered(state, questionId) {
  const q = QUESTION_BANK[questionId]
  if (!q) return true
  return Boolean(String(state?.[q.key] || '').trim())
}

function getAskedQuestionIds(state) {
  const responses = Array.isArray(state?.responses) ? state.responses : []
  return new Set(responses.map((item) => item.questionId).filter(Boolean))
}

function selectNextQuestionId(state) {
  const asked = getAskedQuestionIds(state)
  const order = getQuestionOrder(state)

  for (const questionId of order) {
    if (asked.has(questionId)) continue
    if (isAnswered(state, questionId)) continue
    return questionId
  }

  return null
}

const WARM_REPLIES = [
  'Nice, that helps me personalize your path.',
  'Great, I am adjusting based on that.',
  'Perfect, that gives me better context.',
]

export function getQuestionById(id) {
  return QUESTION_BANK[id] || null
}

export function getQuestionPrompt(questionId, state) {
  const name = getFirstName(state)
  const prefix = name ? `${name}, ` : ''
  const stageAnswer = getRecentAnswer(state, 'stage') || state?.education_stage || ''
  const interestsAnswer = getRecentAnswer(state, 'interests') || state?.interests || ''
  const goalsAnswer = getRecentAnswer(state, 'goals') || state?.goals || ''

  switch (questionId) {
    case 'stage':
      return `${prefix}to personalize this well, are you in school, university, or already working?`
    case 'schoolClass':
      return `Super${name ? `, ${name}` : ''}. In school you said "${stageAnswer}". What class are you in right now?`
    case 'universityYear':
      return `Great${name ? `, ${name}` : ''}. You mentioned "${stageAnswer}". What year are you currently in?`
    case 'age':
      return `${prefix}how old are you? It helps me calibrate examples and pacing.`
    case 'interests':
      return `${prefix}what are your top interests now (gaming, school, sports, coding, music, etc.)?`
    case 'gamingFocus':
      return `Nice, based on "${interestsAnswer}", what attracts you most in gaming: competition, strategy, teamwork, or creativity?`
    case 'studyFocus':
      return `Since you mentioned "${interestsAnswer}", which subjects do you want to improve first?`
    case 'codingFocus':
      return `Love that. From "${interestsAnswer}", which coding direction fits you best now: web apps, games, automation, or algorithms?`
    case 'sportsFocus':
      return `Great. You said "${interestsAnswer}". Do you focus more on team sports, individual performance, or fitness progression?`
    case 'goals':
      return `${prefix}what is your main goal in the next few months: better grades, learning for fun, productivity, or building projects?`
    case 'goalClarifier':
      return `You wrote "${goalsAnswer}". If we choose one concrete target for the next 30 days, what should it be exactly?`
    case 'learningStyle':
      return `To match your goals better, what helps you learn fastest: visuals, examples, practice, short explanations, or stories?`
    case 'supportStyle':
      return `Last one${name ? `, ${name}` : ''}: when something is hard, what support do you prefer first: hints, full explanations, examples, or retry on your own?`
    default:
      return QUESTION_BANK[questionId]?.prompt || ''
  }
}

export function getInitialQuestionId() {
  return selectNextQuestionId({ responses: [] }) || 'stage'
}

export function getNextQuestionId(currentId, state, answer) {
  void currentId
  void answer
  return selectNextQuestionId(state)
}

export function getWarmReply(turnIndex) {
  return WARM_REPLIES[turnIndex % WARM_REPLIES.length]
}

export function estimateRemainingQuestions(currentId, state, maxDepth = 10) {
  void currentId
  void maxDepth
  const order = getQuestionOrder(state)
  const asked = getAskedQuestionIds(state)
  return order.filter((id) => !asked.has(id) && !isAnswered(state, id)).length
}
