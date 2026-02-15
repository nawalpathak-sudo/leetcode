export function calculateLeetCodeScore(data) {
  if (!data || !data.matchedUser) return 0

  const user = data.matchedUser
  const contest = data.userContestRanking

  const solvedStats = {}
  for (const item of user.submitStats.acSubmissionNum) {
    solvedStats[item.difficulty] = item.count
  }

  const easy = solvedStats.Easy || 0
  const medium = solvedStats.Medium || 0
  const hard = solvedStats.Hard || 0

  // Problem solving score (max 400)
  const problemScore = (easy * 1) + (medium * 3) + (hard * 5)
  const normalizedProblemScore = Math.min(problemScore / 10, 400)

  // Contest rating score (max 300)
  let contestScore = 0
  if (contest?.rating) {
    contestScore = Math.min(contest.rating / 10, 300)
  }

  // Consistency score (max 200)
  const contestsAttended = contest?.attendedContestsCount || 0
  const consistencyScore = Math.min(contestsAttended * 2, 200)

  // Ranking bonus (max 100)
  let rankingScore = 0
  const ranking = user.profile?.ranking
  if (ranking) {
    if (ranking <= 1000) rankingScore = 100
    else if (ranking <= 10000) rankingScore = 80
    else if (ranking <= 50000) rankingScore = 60
    else if (ranking <= 100000) rankingScore = 40
    else rankingScore = 20
  }

  return Math.round((normalizedProblemScore + contestScore + consistencyScore + rankingScore) * 100) / 100
}

export function calculateCodeforcesScore(data) {
  if (!data || !data.user) return 0

  const user = data.user
  const ratingHistory = data.ratingHistory || []
  const submissions = data.submissions || []

  // Rating score (max 400)
  const maxRating = user.maxRating || user.rating || 0
  const ratingScore = Math.min(maxRating / 7.5, 400)

  // Contest participation (max 300)
  const contestScore = Math.min(ratingHistory.length * 3, 300)

  // Problem solving (max 200)
  const solvedProblems = new Set()
  for (const sub of submissions) {
    if (sub.verdict === 'OK') {
      const problem = sub.problem || {}
      if (problem.contestId && problem.index) {
        solvedProblems.add(`${problem.contestId}-${problem.index}`)
      }
    }
  }
  const problemScore = Math.min(solvedProblems.size * 2, 200)

  // Rank bonus (max 100)
  const rankScores = {
    'legendary grandmaster': 100,
    'international grandmaster': 95,
    grandmaster: 90,
    'international master': 80,
    master: 70,
    'candidate master': 60,
    expert: 50,
    specialist: 40,
    pupil: 30,
    newbie: 20,
  }
  const rank = (user.rank || '').toLowerCase()
  const rankScore = rankScores[rank] || 10

  return Math.round((ratingScore + contestScore + problemScore + rankScore) * 100) / 100
}
