function detectKeywords(text, keywords) {
  const lower = String(text || '').toLowerCase()
  return keywords.some((kw) => lower.includes(kw))
}

function detectLearningStyle(answers) {
  const allText = answers.join(' ')

  if (detectKeywords(allText, ['image', 'visual', 'diagram', 'color', 'video', 'chart', 'picture', 'see', 'watch'])) {
    return { style: 'visual', type: 'Visual Explorer' }
  }
  if (detectKeywords(allText, ['logic', 'why', 'reason', 'explain', 'understand', 'think', 'analysis', 'proof', 'math'])) {
    return { style: 'logical', type: 'Logical Thinker' }
  }
  if (detectKeywords(allText, ['practice', 'exercise', 'do', 'project', 'build', 'hands', 'try', 'experiment', 'create', 'make'])) {
    return { style: 'practical', type: 'Hands-on Learner' }
  }
  if (detectKeywords(allText, ['story', 'example', 'analogy', 'real', 'life', 'narrative', 'context', 'scenario'])) {
    return { style: 'story-based', type: 'Story Learner' }
  }
  if (detectKeywords(allText, ['goal', 'exam', 'grade', 'result', 'target', 'achieve', 'score'])) {
    return { style: 'mixed', type: 'Goal-Oriented Student' }
  }
  if (detectKeywords(allText, ['curious', 'discover', 'explore', 'interesting', 'wonder', 'question', 'learn'])) {
    return { style: 'mixed', type: 'Curious Discoverer' }
  }
  return { style: 'mixed', type: 'Balanced Learner' }
}

function detectMotivation(answers) {
  const allText = answers.join(' ')
  if (detectKeywords(allText, ['goal', 'target', 'exam', 'grade', 'deadline', 'achieve', 'result', 'progress'])) return 'goal-based'
  if (detectKeywords(allText, ['curious', 'discover', 'interesting', 'wonder', 'explore', 'fascinate'])) return 'curiosity'
  if (detectKeywords(allText, ['reward', 'point', 'badge', 'prize', 'earn', 'win'])) return 'reward-based'
  if (detectKeywords(allText, ['competition', 'compete', 'leaderboard', 'rank', 'beat', 'challenge', 'vs'])) return 'competitive'
  if (detectKeywords(allText, ['help', 'others', 'team', 'share', 'together', 'impact', 'community'])) return 'social impact'
  return 'mixed'
}

function detectPace(answer) {
  const text = String(answer || '').toLowerCase()
  if (detectKeywords(text, ['slow', 'careful', 'thorough', 'detail', 'review', 'check'])) return 'slow and careful'
  if (detectKeywords(text, ['fast', 'quick', 'speed', 'rapid', 'hurry'])) return 'fast'
  if (detectKeywords(text, ['last minute', 'deadline', 'procrastinat', 'before due', 'rush'])) return 'last-minute'
  if (detectKeywords(text, ['consistent', 'steady', 'regular', 'routine', 'daily', 'habit', 'schedule'])) return 'consistent'
  return 'mixed'
}

function detectSupport(answer) {
  const text = String(answer || '').toLowerCase()
  if (detectKeywords(text, ['hint', 'clue', 'nudge', 'tip'])) return 'hints'
  if (detectKeywords(text, ['explanation', 'explain', 'full', 'detail', 'understand why'])) return 'full explanations'
  if (detectKeywords(text, ['example', 'show me', 'demonstration', 'sample'])) return 'examples'
  if (detectKeywords(text, ['try again', 'retry', 'myself', 'figure out', 'alone', 'attempt'])) return 'retry-based'
  return 'mixed'
}

function deriveStrengths(type, style, motivation) {
  const map = {
    'Visual Explorer': ['Spatial thinking', 'Creative visualization', 'Pattern recognition'],
    'Logical Thinker': ['Analytical reasoning', 'Structured problem-solving', 'Deep understanding'],
    'Hands-on Learner': ['Applied learning', 'Experimentation', 'Practical skills'],
    'Story Learner': ['Contextual memory', 'Empathy', 'Narrative thinking'],
    'Goal-Oriented Student': ['Focus and drive', 'Task completion', 'Strategic planning'],
    'Curious Discoverer': ['Open-mindedness', 'Self-motivation', 'Love of learning'],
    'Balanced Learner': ['Adaptability', 'Versatile thinking', 'Steady growth'],
  }
  return map[type] || ['Adaptability', 'Steady growth']
}

function deriveChallenges(type, pace, support) {
  const map = {
    'Visual Explorer': ['Text-heavy material', 'Abstract concepts without visuals'],
    'Logical Thinker': ['Memorization tasks', 'Ambiguous instructions'],
    'Hands-on Learner': ['Passive lectures', 'Theory without application'],
    'Story Learner': ['Dry, factual content', 'Context-free tasks'],
    'Goal-Oriented Student': ['Open-ended exploration', 'No clear milestones'],
    'Curious Discoverer': ['Rigid structures', 'Repetitive drills'],
    'Balanced Learner': ['Finding a go-to style', 'Staying consistent'],
  }
  return map[type] || ['Staying focused', 'Managing time']
}

function generateSummary(type, style, motivation, pace) {
  const templates = {
    'Visual Explorer': `You learn best when ideas are shown visually — diagrams, videos, and colorful examples spark your understanding. Pair visuals with short explanations to stay engaged and retain more.`,
    'Logical Thinker': `You thrive when you understand the "why" behind every concept. Step-by-step reasoning and structured breakdowns will help you build strong, lasting knowledge.`,
    'Hands-on Learner': `Learning clicks for you when you can dive in and try things yourself. Exercises, real projects, and active practice are your best tools for growth.`,
    'Story Learner': `You connect with ideas through context and narrative. Real-life scenarios and relatable examples turn abstract concepts into something you can actually remember.`,
    'Goal-Oriented Student': `Clear targets keep you moving forward. Breaking learning into milestones and tracking your progress will help you stay focused and motivated.`,
    'Curious Discoverer': `Your natural curiosity is your biggest strength. Following your questions and exploring topics that genuinely interest you will accelerate your learning journey.`,
    'Balanced Learner': `You adapt well to different learning formats. Mixing methods — videos, practice, reading — keeps things fresh and helps you absorb material from every angle.`,
  }
  return templates[type] || `You have a unique way of learning that blends multiple styles. Stay open to trying different approaches and notice what makes ideas stick for you.`
}

export function generateProfile(username, answers) {
  const { style, type } = detectLearningStyle(answers)
  const motivation = detectMotivation(answers)
  const pace = detectPace(answers[4] || answers.join(' '))
  const support = detectSupport(answers[5] || answers.join(' '))
  const strengths = deriveStrengths(type, style, motivation)
  const challenges = deriveChallenges(type, pace, support)
  const summary = generateSummary(type, style, motivation, pace)

  return {
    username,
    learner_type: type,
    learning_style: style,
    motivation_type: motivation,
    pace,
    support_style: support,
    strengths,
    challenges,
    summary,
    createdAt: new Date(),
  }
}
