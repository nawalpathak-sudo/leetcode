import streamlit as st
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import pandas as pd
from datetime import datetime
import plotly.graph_objects as go
import plotly.express as px
import sqlite3
import json
import os
import time

st.set_page_config(page_title="Coding Profile Viewer", page_icon="💻", layout="wide")

# ---- SQLite helpers ----
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "leetcode_cache.db")

def _get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS leetcode_profiles (
            username TEXT PRIMARY KEY,
            college TEXT DEFAULT '',
            batch TEXT DEFAULT '',
            easy INTEGER DEFAULT 0,
            medium INTEGER DEFAULT 0,
            hard INTEGER DEFAULT 0,
            total_solved INTEGER DEFAULT 0,
            contest_rating REAL DEFAULT 0,
            contests_attended INTEGER DEFAULT 0,
            global_ranking INTEGER DEFAULT 0,
            score REAL DEFAULT 0,
            raw_json TEXT,
            fetched_at TEXT
        )
    """)
    # migrate: add college/batch columns if missing
    cursor = conn.execute("PRAGMA table_info(leetcode_profiles)")
    existing_cols = {row[1] for row in cursor.fetchall()}
    if 'college' not in existing_cols:
        conn.execute("ALTER TABLE leetcode_profiles ADD COLUMN college TEXT DEFAULT ''")
    if 'batch' not in existing_cols:
        conn.execute("ALTER TABLE leetcode_profiles ADD COLUMN batch TEXT DEFAULT ''")
    if 'student_name' not in existing_cols:
        conn.execute("ALTER TABLE leetcode_profiles ADD COLUMN student_name TEXT DEFAULT ''")
    conn.commit()
    return conn

def save_profile_to_db(username, data, college='', batch='', student_name=''):
    """Extract stats from API data and upsert into SQLite."""
    if not data or not data.get('matchedUser'):
        return

    user = data['matchedUser']
    contest = data.get('userContestRanking')
    solved_stats = {item['difficulty']: item['count']
                    for item in user['submitStats']['acSubmissionNum']}

    easy = solved_stats.get('Easy', 0)
    medium = solved_stats.get('Medium', 0)
    hard = solved_stats.get('Hard', 0)
    total = easy + medium + hard
    contest_rating = round(contest['rating'], 2) if contest and contest.get('rating') else 0
    contests_attended = contest.get('attendedContestsCount', 0) if contest else 0
    ranking = user['profile'].get('ranking', 0) or 0
    score = calculate_leetcode_score(data)

    conn = _get_db()
    conn.execute("""
        INSERT INTO leetcode_profiles
            (username, college, batch, student_name, easy, medium, hard, total_solved, contest_rating,
             contests_attended, global_ranking, score, raw_json, fetched_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(username) DO UPDATE SET
            college=excluded.college, batch=excluded.batch, student_name=excluded.student_name,
            easy=excluded.easy, medium=excluded.medium, hard=excluded.hard,
            total_solved=excluded.total_solved, contest_rating=excluded.contest_rating,
            contests_attended=excluded.contests_attended, global_ranking=excluded.global_ranking,
            score=excluded.score, raw_json=excluded.raw_json, fetched_at=excluded.fetched_at
    """, (username, college, batch, student_name, easy, medium, hard, total, contest_rating,
          contests_attended, ranking, score, json.dumps(data),
          datetime.now().isoformat()))
    conn.commit()
    conn.close()

def load_all_profiles():
    """Load all cached profiles from SQLite as a DataFrame."""
    conn = _get_db()
    df = pd.read_sql_query(
        "SELECT username, student_name, college, batch, easy, medium, hard, total_solved, contest_rating, "
        "contests_attended, global_ranking, score, fetched_at FROM leetcode_profiles "
        "ORDER BY score DESC", conn)
    conn.close()
    return df

def delete_profile_from_db(username):
    conn = _get_db()
    cursor = conn.execute("DELETE FROM leetcode_profiles WHERE LOWER(username) = LOWER(?)", (username,))
    deleted = cursor.rowcount
    conn.commit()
    conn.close()
    return deleted

def clear_all_profiles():
    conn = _get_db()
    conn.execute("DELETE FROM leetcode_profiles")
    conn.commit()
    conn.close()

def _get_cf_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS codeforces_profiles (
            username TEXT PRIMARY KEY,
            college TEXT DEFAULT '',
            batch TEXT DEFAULT '',
            rating INTEGER DEFAULT 0,
            max_rating INTEGER DEFAULT 0,
            rank TEXT DEFAULT '',
            problems_solved INTEGER DEFAULT 0,
            contests_attended INTEGER DEFAULT 0,
            avg_problem_rating INTEGER DEFAULT 0,
            score REAL DEFAULT 0,
            raw_json TEXT,
            fetched_at TEXT
        )
    """)
    cursor = conn.execute("PRAGMA table_info(codeforces_profiles)")
    existing_cols = {row[1] for row in cursor.fetchall()}
    if 'college' not in existing_cols:
        conn.execute("ALTER TABLE codeforces_profiles ADD COLUMN college TEXT DEFAULT ''")
    if 'batch' not in existing_cols:
        conn.execute("ALTER TABLE codeforces_profiles ADD COLUMN batch TEXT DEFAULT ''")
    if 'student_name' not in existing_cols:
        conn.execute("ALTER TABLE codeforces_profiles ADD COLUMN student_name TEXT DEFAULT ''")
    conn.commit()
    return conn

def save_cf_profile_to_db(username, data, college='', batch='', student_name=''):
    """Extract stats from Codeforces API data and upsert into SQLite."""
    if not data or not data.get('user'):
        return

    user = data['user']
    rating_history = data.get('ratingHistory', [])
    submissions = data.get('submissions', [])

    rating = user.get('rating', 0)
    max_rating = user.get('maxRating', rating)
    rank = user.get('rank', 'unrated')
    contests_attended = len(rating_history)

    solved_problems = set()
    problem_ratings = []
    for sub in submissions:
        if sub.get('verdict') == 'OK':
            problem = sub.get('problem', {})
            if 'contestId' in problem and 'index' in problem:
                problem_id = f"{problem['contestId']}-{problem['index']}"
                solved_problems.add(problem_id)
                if 'rating' in problem:
                    problem_ratings.append(problem['rating'])

    problems_solved = len(solved_problems)
    avg_problem_rating = int(sum(problem_ratings) / len(problem_ratings)) if problem_ratings else 0
    score = calculate_codeforces_score(data)

    conn = _get_cf_db()
    conn.execute("""
        INSERT INTO codeforces_profiles
            (username, college, batch, student_name, rating, max_rating, rank, problems_solved,
             contests_attended, avg_problem_rating, score, raw_json, fetched_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(username) DO UPDATE SET
            college=excluded.college, batch=excluded.batch, student_name=excluded.student_name,
            rating=excluded.rating, max_rating=excluded.max_rating, rank=excluded.rank,
            problems_solved=excluded.problems_solved, contests_attended=excluded.contests_attended,
            avg_problem_rating=excluded.avg_problem_rating, score=excluded.score,
            raw_json=excluded.raw_json, fetched_at=excluded.fetched_at
    """, (username, college, batch, student_name, rating, max_rating, rank, problems_solved,
          contests_attended, avg_problem_rating, score, json.dumps(data),
          datetime.now().isoformat()))
    conn.commit()
    conn.close()

def load_all_cf_profiles():
    """Load all cached Codeforces profiles from SQLite as a DataFrame."""
    conn = _get_cf_db()
    df = pd.read_sql_query(
        "SELECT username, student_name, college, batch, rating, max_rating, rank, problems_solved, "
        "contests_attended, avg_problem_rating, score, fetched_at FROM codeforces_profiles "
        "ORDER BY score DESC", conn)
    conn.close()
    return df

def delete_cf_profile_from_db(username):
    conn = _get_cf_db()
    cursor = conn.execute("DELETE FROM codeforces_profiles WHERE LOWER(username) = LOWER(?)", (username,))
    deleted = cursor.rowcount
    conn.commit()
    conn.close()
    return deleted

def clear_all_cf_profiles():
    conn = _get_cf_db()
    conn.execute("DELETE FROM codeforces_profiles")
    conn.commit()
    conn.close()

def fetch_leetcode_data(username):
    """Fetch user data from LeetCode GraphQL API"""
    url = "https://leetcode.com/graphql"

    query = """
    query getUserProfile($username: String!) {
        matchedUser(username: $username) {
            username
            profile {
                ranking
                reputation
                starRating
                realName
                aboutMe
                userAvatar
                skillTags
                countryName
            }
            submitStats {
                acSubmissionNum {
                    difficulty
                    count
                    submissions
                }
                totalSubmissionNum {
                    difficulty
                    count
                    submissions
                }
            }
            badges {
                id
                displayName
                icon
                creationDate
            }
            upcomingBadges {
                name
                icon
            }
        }
        userContestRanking(username: $username) {
            attendedContestsCount
            rating
            globalRanking
            totalParticipants
            topPercentage
        }
        userContestRankingHistory(username: $username) {
            attended
            rating
            ranking
            contest {
                title
                startTime
            }
        }
        recentSubmissionList(username: $username, limit: 20) {
            title
            titleSlug
            timestamp
            statusDisplay
            lang
        }
        matchedUserStats: matchedUser(username: $username) {
            submitStatsGlobal {
                acSubmissionNum {
                    difficulty
                    count
                }
            }
        }
    }
    """

    headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://leetcode.com',
        'Origin': 'https://leetcode.com',
    }

    session = requests.Session()
    retries = Retry(total=3, backoff_factor=2, status_forcelist=[429, 500, 502, 503, 504])
    session.mount('https://', HTTPAdapter(max_retries=retries))

    try:
        response = session.post(
            url,
            json={'query': query, 'variables': {'username': username}},
            headers=headers,
            timeout=30
        )

        if response.status_code == 200:
            data = response.json()
            if data.get('data', {}).get('matchedUser'):
                return data['data']
            else:
                return None
        else:
            return None
    except Exception as e:
        st.error(f"Error fetching data for {username}: {str(e)}")
        return None

def fetch_codeforces_data(username):
    """Fetch user data from Codeforces API"""
    try:
        # User info
        user_url = f"https://codeforces.com/api/user.info?handles={username}"
        user_response = requests.get(user_url, timeout=10)

        if user_response.status_code != 200:
            return None

        user_data = user_response.json()
        if user_data.get('status') != 'OK':
            return None

        # User rating history
        rating_url = f"https://codeforces.com/api/user.rating?handle={username}"
        rating_response = requests.get(rating_url, timeout=10)
        rating_history = []
        if rating_response.status_code == 200:
            rating_data = rating_response.json()
            if rating_data.get('status') == 'OK':
                rating_history = rating_data.get('result', [])

        # User submissions
        status_url = f"https://codeforces.com/api/user.status?handle={username}&from=1&count=100"
        status_response = requests.get(status_url, timeout=10)
        submissions = []
        if status_response.status_code == 200:
            status_data = status_response.json()
            if status_data.get('status') == 'OK':
                submissions = status_data.get('result', [])

        return {
            'user': user_data['result'][0],
            'ratingHistory': rating_history,
            'submissions': submissions
        }

    except Exception as e:
        st.error(f"Error fetching Codeforces data: {str(e)}")
        return None

def calculate_score(data, platform='leetcode'):
    """Calculate a comprehensive score for LeetCode or Codeforces"""
    if platform == 'leetcode':
        return calculate_leetcode_score(data)
    else:
        return calculate_codeforces_score(data)

def calculate_leetcode_score(data):
    """Calculate a comprehensive LeetCode score"""
    if not data or not data.get('matchedUser'):
        return 0

    user = data['matchedUser']
    contest = data.get('userContestRanking')

    # Problem solving score (max 400 points)
    solved_stats = {item['difficulty']: item['count']
                   for item in user['submitStats']['acSubmissionNum']}

    easy = solved_stats.get('Easy', 0)
    medium = solved_stats.get('Medium', 0)
    hard = solved_stats.get('Hard', 0)

    problem_score = (easy * 1) + (medium * 3) + (hard * 5)
    normalized_problem_score = min(problem_score / 10, 400)  # Cap at 400

    # Contest rating score (max 300 points)
    contest_score = 0
    if contest and contest.get('rating'):
        contest_score = min(contest['rating'] / 10, 300)  # Cap at 300

    # Consistency score (max 200 points)
    contests_attended = contest.get('attendedContestsCount', 0) if contest else 0
    consistency_score = min(contests_attended * 2, 200)  # Cap at 200

    # Ranking bonus (max 100 points)
    ranking_score = 0
    if user['profile'].get('ranking'):
        ranking = user['profile']['ranking']
        if ranking <= 1000:
            ranking_score = 100
        elif ranking <= 10000:
            ranking_score = 80
        elif ranking <= 50000:
            ranking_score = 60
        elif ranking <= 100000:
            ranking_score = 40
        else:
            ranking_score = 20

    total_score = normalized_problem_score + contest_score + consistency_score + ranking_score

    return round(total_score, 2)

def calculate_codeforces_score(data):
    """Calculate a comprehensive Codeforces score"""
    if not data or not data.get('user'):
        return 0

    user = data['user']
    rating_history = data.get('ratingHistory', [])
    submissions = data.get('submissions', [])

    # Rating score (max 400 points)
    rating = user.get('rating', 0)
    max_rating = user.get('maxRating', rating)
    rating_score = min(max_rating / 7.5, 400)  # 3000 rating = 400 points

    # Contest participation (max 300 points)
    contests_count = len(rating_history)
    contest_score = min(contests_count * 3, 300)

    # Problem solving (max 200 points)
    solved_problems = set()
    for sub in submissions:
        if sub.get('verdict') == 'OK':
            problem = sub.get('problem', {})
            if 'contestId' in problem and 'index' in problem:
                problem_id = f"{problem['contestId']}-{problem['index']}"
                solved_problems.add(problem_id)

    problem_score = min(len(solved_problems) * 2, 200)

    # Rank bonus (max 100 points)
    rank = user.get('rank', '')
    rank_scores = {
        'legendary grandmaster': 100,
        'international grandmaster': 95,
        'grandmaster': 90,
        'international master': 80,
        'master': 70,
        'candidate master': 60,
        'expert': 50,
        'specialist': 40,
        'pupil': 30,
        'newbie': 20
    }
    rank_score = rank_scores.get(rank.lower(), 10)

    total_score = rating_score + contest_score + problem_score + rank_score

    return round(total_score, 2)

def display_profile_header(user_data):
    """Display user profile header"""
    user = user_data['matchedUser']
    profile = user['profile']

    col1, col2 = st.columns([1, 3])

    with col1:
        if profile.get('userAvatar'):
            st.image(profile['userAvatar'], width=150)

    with col2:
        st.title(f"👤 {user['username']}")
        if profile.get('realName'):
            st.subheader(profile['realName'])

        # Score badge
        score = calculate_leetcode_score(user_data)
        st.markdown(f"### 🎯 Overall Score: **{score}/1000**")

        if profile.get('countryName'):
            st.write(f"📍 {profile['countryName']}")

def display_stats_overview(user_data):
    """Display key statistics"""
    user = user_data['matchedUser']
    contest = user_data.get('userContestRanking')
    
    solved_stats = {item['difficulty']: item['count'] 
                   for item in user['submitStats']['acSubmissionNum']}
    
    total_solved = sum(solved_stats.values())
    
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        st.metric("Problems Solved", total_solved)
    
    with col2:
        ranking = user['profile'].get('ranking', 'N/A')
        st.metric("Global Ranking", f"{ranking:,}" if isinstance(ranking, int) else ranking)
    
    with col3:
        if contest and contest.get('rating'):
            st.metric("Contest Rating", round(contest['rating'], 2))
        else:
            st.metric("Contest Rating", "N/A")
    
    with col4:
        if contest:
            st.metric("Contests Attended", contest.get('attendedContestsCount', 0))
        else:
            st.metric("Contests Attended", 0)

def display_problem_breakdown(user_data):
    """Display problem-solving breakdown with charts"""
    user = user_data['matchedUser']
    
    solved_stats = {item['difficulty']: item['count'] 
                   for item in user['submitStats']['acSubmissionNum']}
    total_stats = {item['difficulty']: item['count'] 
                  for item in user['submitStats']['totalSubmissionNum']}
    
    st.subheader("📊 Problem Solving Breakdown")
    
    # Create DataFrame
    difficulties = ['Easy', 'Medium', 'Hard']
    solved = [solved_stats.get(d, 0) for d in difficulties]
    total = [total_stats.get(d, 0) for d in difficulties]
    
    col1, col2 = st.columns(2)
    
    with col1:
        # Bar chart
        df = pd.DataFrame({
            'Difficulty': difficulties,
            'Solved': solved,
            'Attempted': total
        })
        
        fig = go.Figure()
        fig.add_trace(go.Bar(name='Solved', x=df['Difficulty'], y=df['Solved'],
                            marker_color=['#00b8a3', '#ffc01e', '#ef4743']))
        fig.add_trace(go.Bar(name='Attempted', x=df['Difficulty'], y=df['Attempted'],
                            marker_color=['#b3e5df', '#ffe5b3', '#ffc9c7']))
        
        fig.update_layout(
            title="Problems: Solved vs Attempted",
            barmode='group',
            height=400
        )
        st.plotly_chart(fig, use_container_width=True)
    
    with col2:
        # Pie chart
        fig = go.Figure(data=[go.Pie(
            labels=difficulties,
            values=solved,
            marker=dict(colors=['#00b8a3', '#ffc01e', '#ef4743']),
            hole=.3
        )])
        
        fig.update_layout(
            title="Solved Problems Distribution",
            height=400
        )
        st.plotly_chart(fig, use_container_width=True)
    
    # Detailed stats table
    st.subheader("📈 Detailed Statistics")
    
    stats_df = pd.DataFrame({
        'Difficulty': difficulties,
        'Solved': solved,
        'Total Attempted': total,
        'Acceptance Rate': [f"{(s/t*100):.1f}%" if t > 0 else "0%" 
                           for s, t in zip(solved, total)]
    })
    
    st.dataframe(stats_df, use_container_width=True, hide_index=True)

def display_contest_stats(user_data):
    """Display contest statistics and history"""
    contest = user_data.get('userContestRanking')
    history = user_data.get('userContestRankingHistory', [])
    
    st.subheader("🏆 Contest Performance")
    
    if not contest:
        st.info("No contest data available for this user.")
        return
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        st.metric("Current Rating", round(contest.get('rating', 0), 2))
    
    with col2:
        st.metric("Global Ranking", f"{contest.get('globalRanking', 0):,}")
    
    with col3:
        top_percent = contest.get('topPercentage', 0)
        st.metric("Top Percentage", f"{top_percent:.2f}%")
    
    # Contest rating history
    if history:
        st.subheader("📉 Rating History")
        
        df_history = pd.DataFrame(history)
        df_history['date'] = pd.to_datetime(df_history['contest'].apply(lambda x: x['startTime']), unit='s')
        df_history['contest_name'] = df_history['contest'].apply(lambda x: x['title'])
        
        fig = go.Figure()
        fig.add_trace(go.Scatter(
            x=df_history['date'],
            y=df_history['rating'],
            mode='lines+markers',
            name='Rating',
            line=dict(color='#ffc01e', width=2),
            marker=dict(size=6)
        ))
        
        fig.update_layout(
            title="Contest Rating Over Time",
            xaxis_title="Date",
            yaxis_title="Rating",
            height=400,
            hovermode='x unified'
        )
        
        st.plotly_chart(fig, use_container_width=True)
        
        # Recent contests table
        st.subheader("📅 Recent Contests")
        recent_contests = df_history.tail(10).sort_values('date', ascending=False)
        
        display_df = recent_contests[['contest_name', 'rating', 'ranking', 'date']].copy()
        display_df.columns = ['Contest', 'Rating', 'Rank', 'Date']
        display_df['Date'] = display_df['Date'].dt.strftime('%Y-%m-%d')
        
        st.dataframe(display_df, use_container_width=True, hide_index=True)

def display_recent_submissions(user_data):
    """Display recent submissions"""
    submissions = user_data.get('recentSubmissionList', [])
    
    if not submissions:
        st.info("No recent submissions available.")
        return
    
    st.subheader("🔄 Recent Submissions")
    
    submissions_data = []
    for sub in submissions:
        submissions_data.append({
            'Problem': sub['title'],
            'Status': sub['statusDisplay'],
            'Language': sub['lang'],
            'Time': datetime.fromtimestamp(int(sub['timestamp'])).strftime('%Y-%m-%d %H:%M')
        })
    
    df = pd.DataFrame(submissions_data)
    
    # Color code status
    def color_status(val):
        if val == 'Accepted':
            return 'background-color: #d4edda'
        elif 'Wrong' in val or 'Error' in val:
            return 'background-color: #f8d7da'
        else:
            return 'background-color: #fff3cd'
    
    styled_df = df.style.applymap(color_status, subset=['Status'])
    st.dataframe(styled_df, use_container_width=True, hide_index=True)

def display_badges(user_data):
    """Display user badges"""
    user = user_data['matchedUser']
    badges = user.get('badges', [])
    
    if not badges:
        return
    
    st.subheader("🏅 Badges")
    
    cols = st.columns(min(len(badges), 5))
    for idx, badge in enumerate(badges[:10]):  # Show max 10 badges
        with cols[idx % 5]:
            st.image(badge['icon'], width=60)
            st.caption(badge['displayName'])

# Codeforces display functions
def display_codeforces_profile(data):
    """Display Codeforces profile"""
    user = data['user']

    col1, col2 = st.columns([1, 3])

    with col1:
        if user.get('titlePhoto'):
            st.image(user['titlePhoto'], width=150)

    with col2:
        st.title(f"👤 {user['handle']}")
        if user.get('firstName') or user.get('lastName'):
            name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip()
            st.subheader(name)

        # Score badge
        score = calculate_codeforces_score(data)
        st.markdown(f"### 🎯 Overall Score: **{score}/1000**")

        if user.get('country'):
            st.write(f"📍 {user['country']}")

        # Rank and rating
        rank = user.get('rank', 'Unrated')
        rating = user.get('rating', 0)
        max_rating = user.get('maxRating', rating)

        col_a, col_b = st.columns(2)
        with col_a:
            st.metric("Rank", rank.title())
        with col_b:
            st.metric("Rating", f"{rating} (max: {max_rating})")

def display_codeforces_stats(data):
    """Display Codeforces statistics"""
    user = data['user']
    rating_history = data.get('ratingHistory', [])
    submissions = data.get('submissions', [])

    # Calculate stats
    solved_problems = set()
    problem_ratings = []
    for sub in submissions:
        if sub.get('verdict') == 'OK':
            problem = sub.get('problem', {})
            if 'contestId' in problem and 'index' in problem:
                problem_id = f"{problem['contestId']}-{problem['index']}"
                solved_problems.add(problem_id)
                if 'rating' in problem:
                    problem_ratings.append(problem['rating'])

    col1, col2, col3, col4 = st.columns(4)

    with col1:
        st.metric("Problems Solved", len(solved_problems))

    with col2:
        st.metric("Contests", len(rating_history))

    with col3:
        avg_problem_rating = int(sum(problem_ratings) / len(problem_ratings)) if problem_ratings else 0
        st.metric("Avg Problem Rating", avg_problem_rating)

    with col4:
        max_rating = user.get('maxRating', user.get('rating', 0))
        st.metric("Max Rating", max_rating)

    # Rating history chart
    if rating_history:
        st.subheader("📉 Rating History")

        df_history = pd.DataFrame(rating_history)
        df_history['date'] = pd.to_datetime(df_history['ratingUpdateTimeSeconds'], unit='s')

        fig = go.Figure()
        fig.add_trace(go.Scatter(
            x=df_history['date'],
            y=df_history['newRating'],
            mode='lines+markers',
            name='Rating',
            line=dict(color='#00a8cc', width=2),
            marker=dict(size=6)
        ))

        fig.update_layout(
            title="Contest Rating Over Time",
            xaxis_title="Date",
            yaxis_title="Rating",
            height=400,
            hovermode='x unified'
        )

        st.plotly_chart(fig, use_container_width=True)

def display_batch_dashboard_from_db(found_df):
    """Display aggregate dashboard from SQLite cached DataFrame.
    Columns: username, easy, medium, hard, total_solved, contest_rating,
             contests_attended, global_ranking, score, fetched_at
    """
    st.header("Batch Dashboard")

    # Rename columns for display
    found_df = found_df.rename(columns={
        'username': 'Username', 'student_name': 'Name', 'college': 'College', 'batch': 'Batch',
        'easy': 'Easy', 'medium': 'Medium', 'hard': 'Hard',
        'total_solved': 'Total Solved', 'contest_rating': 'Contest Rating',
        'contests_attended': 'Contests Attended', 'global_ranking': 'Global Ranking',
        'score': 'Score',
    })

    # ---- KPI metrics row ----
    st.subheader("Overview")
    total_students = len(found_df)
    avg_solved = found_df['Total Solved'].mean()
    avg_rating = found_df['Contest Rating'].mean()
    avg_score = found_df['Score'].mean()
    avg_contests = found_df['Contests Attended'].mean()

    k1, k2, k3, k4, k5 = st.columns(5)
    k1.metric("Total Students", total_students)
    k2.metric("Avg Problems Solved", f"{avg_solved:.1f}")
    k3.metric("Avg Contest Rating", f"{avg_rating:.1f}")
    k4.metric("Avg Score", f"{avg_score:.1f}")
    k5.metric("Avg Contests Attended", f"{avg_contests:.1f}")

    # ---- Question bucket breakdown ----
    st.subheader("Students by Problems Solved")

    buckets = [
        ("35+ questions", 35),
        ("20-34 questions", 20),
        ("10-19 questions", 10),
        ("5-9 questions", 5),
        ("< 5 questions", 0),
    ]

    bucket_counts = []
    for label, lower in buckets:
        if lower == 35:
            count = len(found_df[found_df['Total Solved'] >= 35])
        elif lower == 20:
            count = len(found_df[(found_df['Total Solved'] >= 20) & (found_df['Total Solved'] < 35)])
        elif lower == 10:
            count = len(found_df[(found_df['Total Solved'] >= 10) & (found_df['Total Solved'] < 20)])
        elif lower == 5:
            count = len(found_df[(found_df['Total Solved'] >= 5) & (found_df['Total Solved'] < 10)])
        else:
            count = len(found_df[found_df['Total Solved'] < 5])
        bucket_counts.append({'Bucket': label, 'Students': count})

    bucket_df = pd.DataFrame(bucket_counts)

    col1, col2 = st.columns(2)

    with col1:
        fig = go.Figure(go.Bar(
            x=bucket_df['Bucket'],
            y=bucket_df['Students'],
            marker_color=['#2ecc71', '#27ae60', '#f1c40f', '#e67e22', '#e74c3c'],
            text=bucket_df['Students'],
            textposition='auto',
        ))
        fig.update_layout(title="Student Distribution by Problems Solved", height=400,
                          xaxis_title="Problems Solved", yaxis_title="Number of Students")
        st.plotly_chart(fig, use_container_width=True)

    with col2:
        fig = go.Figure(go.Pie(
            labels=bucket_df['Bucket'],
            values=bucket_df['Students'],
            marker=dict(colors=['#2ecc71', '#27ae60', '#f1c40f', '#e67e22', '#e74c3c']),
            hole=0.35,
        ))
        fig.update_layout(title="Distribution (%)", height=400)
        st.plotly_chart(fig, use_container_width=True)

    # ---- Difficulty breakdown averages ----
    st.subheader("Average Difficulty Breakdown")
    diff_cols = st.columns(3)
    diff_cols[0].metric("Avg Easy", f"{found_df['Easy'].mean():.1f}")
    diff_cols[1].metric("Avg Medium", f"{found_df['Medium'].mean():.1f}")
    diff_cols[2].metric("Avg Hard", f"{found_df['Hard'].mean():.1f}")

    # Stacked bar of difficulty per student
    fig = go.Figure()
    fig.add_trace(go.Bar(name='Easy', x=found_df['Username'], y=found_df['Easy'], marker_color='#00b8a3'))
    fig.add_trace(go.Bar(name='Medium', x=found_df['Username'], y=found_df['Medium'], marker_color='#ffc01e'))
    fig.add_trace(go.Bar(name='Hard', x=found_df['Username'], y=found_df['Hard'], marker_color='#ef4743'))
    fig.update_layout(barmode='stack', title="Problems Solved by Difficulty per Student",
                      xaxis_title="Username", yaxis_title="Problems Solved", height=450)
    st.plotly_chart(fig, use_container_width=True)

    # ---- Contest Rating distribution ----
    st.subheader("Contest Rating Distribution")
    rated_df = found_df[found_df['Contest Rating'] > 0]
    if not rated_df.empty:
        fig = px.histogram(rated_df, x='Contest Rating', nbins=15,
                           color_discrete_sequence=['#3498db'],
                           title="Contest Rating Histogram")
        fig.update_layout(height=400, xaxis_title="Contest Rating", yaxis_title="Count")
        st.plotly_chart(fig, use_container_width=True)
    else:
        st.info("No students have contest ratings.")

    # ---- Score distribution ----
    st.subheader("Score Distribution")
    fig = px.histogram(found_df, x='Score', nbins=15,
                       color_discrete_sequence=['#9b59b6'],
                       title="Overall Score Histogram")
    fig.update_layout(height=400, xaxis_title="Score (/1000)", yaxis_title="Count")
    st.plotly_chart(fig, use_container_width=True)

    # ---- Full data table ----
    st.subheader("All Students Data")
    display_cols = ['Name', 'Username', 'College', 'Batch', 'Easy', 'Medium', 'Hard', 'Total Solved',
                    'Contest Rating', 'Contests Attended', 'Global Ranking', 'Score']
    st.dataframe(
        found_df[display_cols].sort_values('Score', ascending=False).reset_index(drop=True),
        use_container_width=True,
        hide_index=True,
    )


def display_cf_batch_dashboard_from_db(found_df):
    """Display aggregate dashboard from SQLite cached Codeforces DataFrame."""
    st.header("Codeforces Batch Dashboard")

    found_df = found_df.rename(columns={
        'username': 'Username', 'student_name': 'Name', 'college': 'College', 'batch': 'Batch',
        'rating': 'Rating', 'max_rating': 'Max Rating', 'rank': 'Rank',
        'problems_solved': 'Problems Solved', 'contests_attended': 'Contests Attended',
        'avg_problem_rating': 'Avg Problem Rating', 'score': 'Score',
    })

    # ---- KPI metrics row ----
    st.subheader("Overview")
    total_students = len(found_df)
    avg_solved = found_df['Problems Solved'].mean()
    avg_rating = found_df['Rating'].mean()
    avg_max_rating = found_df['Max Rating'].mean()
    avg_score = found_df['Score'].mean()
    avg_contests = found_df['Contests Attended'].mean()

    k1, k2, k3, k4, k5, k6 = st.columns(6)
    k1.metric("Total Students", total_students)
    k2.metric("Avg Problems Solved", f"{avg_solved:.1f}")
    k3.metric("Avg Rating", f"{avg_rating:.1f}")
    k4.metric("Avg Max Rating", f"{avg_max_rating:.1f}")
    k5.metric("Avg Score", f"{avg_score:.1f}")
    k6.metric("Avg Contests", f"{avg_contests:.1f}")

    # ---- Rank distribution ----
    st.subheader("Students by Rank")
    rank_order = ['legendary grandmaster', 'international grandmaster', 'grandmaster',
                  'international master', 'master', 'candidate master',
                  'expert', 'specialist', 'pupil', 'newbie', 'unrated']
    rank_colors = {
        'legendary grandmaster': '#aa0000', 'international grandmaster': '#ff0000',
        'grandmaster': '#ff0000', 'international master': '#ff8c00',
        'master': '#ff8c00', 'candidate master': '#aa00aa',
        'expert': '#0000ff', 'specialist': '#03a89e',
        'pupil': '#008000', 'newbie': '#808080', 'unrated': '#cccccc',
    }

    rank_counts = []
    for r in rank_order:
        count = len(found_df[found_df['Rank'].str.lower() == r])
        if count > 0:
            rank_counts.append({'Rank': r.title(), 'Students': count,
                                'Color': rank_colors.get(r, '#cccccc')})

    if rank_counts:
        rank_df = pd.DataFrame(rank_counts)
        col1, col2 = st.columns(2)

        with col1:
            fig = go.Figure(go.Bar(
                x=rank_df['Rank'], y=rank_df['Students'],
                marker_color=rank_df['Color'].tolist(),
                text=rank_df['Students'], textposition='auto',
            ))
            fig.update_layout(title="Student Distribution by Rank", height=400,
                              xaxis_title="Rank", yaxis_title="Number of Students")
            st.plotly_chart(fig, use_container_width=True)

        with col2:
            fig = go.Figure(go.Pie(
                labels=rank_df['Rank'], values=rank_df['Students'],
                marker=dict(colors=rank_df['Color'].tolist()), hole=0.35,
            ))
            fig.update_layout(title="Rank Distribution (%)", height=400)
            st.plotly_chart(fig, use_container_width=True)

    # ---- Problems Solved buckets ----
    st.subheader("Students by Problems Solved")
    buckets = [
        ("50+ problems", 50), ("30-49 problems", 30),
        ("15-29 problems", 15), ("5-14 problems", 5), ("< 5 problems", 0),
    ]
    bucket_counts = []
    for label, lower in buckets:
        if lower == 50:
            count = len(found_df[found_df['Problems Solved'] >= 50])
        elif lower == 30:
            count = len(found_df[(found_df['Problems Solved'] >= 30) & (found_df['Problems Solved'] < 50)])
        elif lower == 15:
            count = len(found_df[(found_df['Problems Solved'] >= 15) & (found_df['Problems Solved'] < 30)])
        elif lower == 5:
            count = len(found_df[(found_df['Problems Solved'] >= 5) & (found_df['Problems Solved'] < 15)])
        else:
            count = len(found_df[found_df['Problems Solved'] < 5])
        bucket_counts.append({'Bucket': label, 'Students': count})

    bucket_df = pd.DataFrame(bucket_counts)
    col1, col2 = st.columns(2)
    with col1:
        fig = go.Figure(go.Bar(
            x=bucket_df['Bucket'], y=bucket_df['Students'],
            marker_color=['#2ecc71', '#27ae60', '#f1c40f', '#e67e22', '#e74c3c'],
            text=bucket_df['Students'], textposition='auto',
        ))
        fig.update_layout(title="Student Distribution by Problems Solved", height=400,
                          xaxis_title="Problems Solved", yaxis_title="Number of Students")
        st.plotly_chart(fig, use_container_width=True)
    with col2:
        fig = go.Figure(go.Pie(
            labels=bucket_df['Bucket'], values=bucket_df['Students'],
            marker=dict(colors=['#2ecc71', '#27ae60', '#f1c40f', '#e67e22', '#e74c3c']),
            hole=0.35,
        ))
        fig.update_layout(title="Distribution (%)", height=400)
        st.plotly_chart(fig, use_container_width=True)

    # ---- Rating distribution ----
    st.subheader("Rating Distribution")
    rated_df = found_df[found_df['Rating'] > 0]
    if not rated_df.empty:
        fig = px.histogram(rated_df, x='Rating', nbins=15,
                           color_discrete_sequence=['#00a8cc'],
                           title="Current Rating Histogram")
        fig.update_layout(height=400, xaxis_title="Rating", yaxis_title="Count")
        st.plotly_chart(fig, use_container_width=True)

        fig2 = px.histogram(rated_df, x='Max Rating', nbins=15,
                            color_discrete_sequence=['#e67e22'],
                            title="Max Rating Histogram")
        fig2.update_layout(height=400, xaxis_title="Max Rating", yaxis_title="Count")
        st.plotly_chart(fig2, use_container_width=True)
    else:
        st.info("No students have ratings.")

    # ---- Problems solved per student bar ----
    st.subheader("Problems Solved per Student")
    fig = go.Figure(go.Bar(
        x=found_df['Username'], y=found_df['Problems Solved'],
        marker_color='#3498db', text=found_df['Problems Solved'], textposition='auto',
    ))
    fig.update_layout(title="Problems Solved per Student", height=450,
                      xaxis_title="Username", yaxis_title="Problems Solved")
    st.plotly_chart(fig, use_container_width=True)

    # ---- Score distribution ----
    st.subheader("Score Distribution")
    fig = px.histogram(found_df, x='Score', nbins=15,
                       color_discrete_sequence=['#9b59b6'],
                       title="Overall Score Histogram")
    fig.update_layout(height=400, xaxis_title="Score (/1000)", yaxis_title="Count")
    st.plotly_chart(fig, use_container_width=True)

    # ---- Full data table ----
    st.subheader("All Students Data")
    display_cols = ['Name', 'Username', 'College', 'Batch', 'Rating', 'Max Rating', 'Rank',
                    'Problems Solved', 'Contests Attended', 'Avg Problem Rating', 'Score']
    st.dataframe(
        found_df[display_cols].sort_values('Score', ascending=False).reset_index(drop=True),
        use_container_width=True, hide_index=True,
    )


# Main App
def main():
    st.title("Coding Profile Analyzer")
    st.markdown("Enter a username to view comprehensive profile statistics")

    # Platform selection
    platform = st.radio("Select Platform", ["LeetCode", "Codeforces"], horizontal=True)

    # Mode selection
    mode = st.radio("Mode", ["Single User", "Batch Dashboard"], horizontal=True)

    if mode == "Single User":
        # Input section
        col1, col2 = st.columns([3, 1])

        with col1:
            placeholder = "e.g., john_doe" if platform == "LeetCode" else "e.g., tourist"
            username = st.text_input(f"{platform} Username", placeholder=placeholder)

        with col2:
            st.write("")
            st.write("")
            search_button = st.button("Search", type="primary")

        if search_button or username:
            if not username:
                st.warning("Please enter a username")
                return

            if platform == "LeetCode":
                with st.spinner(f"Fetching LeetCode data for {username}..."):
                    data = fetch_leetcode_data(username)

                if data and data.get('matchedUser'):
                    st.divider()
                    display_profile_header(data)
                    st.divider()
                    display_stats_overview(data)
                    st.divider()
                    display_problem_breakdown(data)
                    st.divider()
                    display_contest_stats(data)
                    st.divider()
                    display_recent_submissions(data)
                    st.divider()
                    display_badges(data)

                    with st.expander("How is the score calculated?"):
                        st.markdown("""
                        **Overall Score (Max: 1000 points)**

                        - **Problem Solving (400 points)**: Based on problems solved
                          - Easy: 1 point each
                          - Medium: 3 points each
                          - Hard: 5 points each
                          - Normalized to max 400

                        - **Contest Rating (300 points)**: Based on contest performance
                          - Rating / 10 (capped at 300)

                        - **Consistency (200 points)**: Based on contest participation
                          - 2 points per contest attended (capped at 200)

                        - **Ranking Bonus (100 points)**: Based on global ranking
                          - Top 1000: 100 points
                          - Top 10K: 80 points
                          - Top 50K: 60 points
                          - Top 100K: 40 points
                          - Others: 20 points
                        """)
                else:
                    st.error(f"User '{username}' not found. Please check the username and try again.")

            else:  # Codeforces
                with st.spinner(f"Fetching Codeforces data for {username}..."):
                    data = fetch_codeforces_data(username)

                if data and data.get('user'):
                    st.divider()
                    display_codeforces_profile(data)
                    st.divider()
                    display_codeforces_stats(data)

                    with st.expander("How is the score calculated?"):
                        st.markdown("""
                        **Overall Score (Max: 1000 points)**

                        - **Rating (400 points)**: Based on max rating
                          - Max Rating / 7.5 (3000 rating = 400 points)

                        - **Contest Participation (300 points)**: Based on contests
                          - 3 points per contest (capped at 300)

                        - **Problem Solving (200 points)**: Based on unique problems solved
                          - 2 points per problem (capped at 200)

                        - **Rank Bonus (100 points)**: Based on current rank
                          - Legendary Grandmaster: 100
                          - International Grandmaster: 95
                          - Grandmaster: 90
                          - International Master: 80
                          - Master: 70
                          - Candidate Master: 60
                          - Expert: 50
                          - Specialist: 40
                          - Pupil: 30
                          - Newbie: 20
                        """)
                else:
                    st.error(f"User '{username}' not found. Please check the username and try again.")

    else:  # Batch Dashboard
        COLLEGES = ["ADYPU, Pune", "SAGE, Indore", "GDG, Gurugram", "SSU, Gurugram"]
        BATCHES = ["2023", "2024", "2025"]

        if platform == "LeetCode":
            input_tab, csv_tab = st.tabs(["Manual Entry", "Upload CSV"])

            with input_tab:
                st.subheader("Add Students")
                fc1, fc2 = st.columns(2)
                with fc1:
                    selected_college = st.selectbox("College", COLLEGES, key="manual_college")
                with fc2:
                    selected_batch = st.selectbox("Batch", BATCHES, key="manual_batch")

                usernames_input = st.text_area(
                    "LeetCode usernames (one per line)",
                    placeholder="john_doe\njane_smith\ncoder123",
                    height=200,
                )

                if st.button("Fetch & Save All", type="primary", key="manual_fetch"):
                    raw_lines = usernames_input.strip().splitlines()
                    usernames = [u.strip() for u in raw_lines if u.strip()]

                    if not usernames:
                        st.warning("Please enter at least one username.")
                    else:
                        status_container = st.empty()
                        progress = st.progress(0, text="Starting...")
                        success_count = 0
                        fail_list = []

                        for i, uname in enumerate(usernames):
                            progress.progress((i) / len(usernames), text=f"Fetching {uname} ({i+1}/{len(usernames)})...")
                            data = fetch_leetcode_data(uname)
                            if data and data.get('matchedUser'):
                                save_profile_to_db(uname, data, college=selected_college, batch=selected_batch)
                                success_count += 1
                            else:
                                fail_list.append(uname)
                            if i < len(usernames) - 1:
                                time.sleep(2)

                        progress.progress(1.0, text="Done!")
                        status_container.success(f"Fetched {success_count}/{len(usernames)} profiles.")
                        if fail_list:
                            st.warning(f"Failed/not found: {', '.join(fail_list)}")
                        st.rerun()

            with csv_tab:
                st.subheader("Upload CSV")
                st.markdown("CSV must have columns: **name**, **college**, **batch**, **profile** (LeetCode username)")
                uploaded_file = st.file_uploader("Choose a CSV file", type="csv", key="lc_csv")

                if uploaded_file is not None:
                    csv_df = pd.read_csv(uploaded_file)
                    csv_df.columns = [c.strip().lower() for c in csv_df.columns]

                    required_cols = {'college', 'batch', 'profile', 'name'}
                    if not required_cols.issubset(set(csv_df.columns)):
                        st.error(f"CSV must have columns: name, college, batch, profile. Found: {list(csv_df.columns)}")
                    else:
                        csv_df = csv_df.dropna(subset=['profile'])
                        csv_df['profile'] = csv_df['profile'].astype(str).str.strip()
                        csv_df['name'] = csv_df['name'].astype(str).str.strip()
                        csv_df['college'] = csv_df['college'].astype(str).str.strip()
                        csv_df['batch'] = csv_df['batch'].astype(str).str.strip()
                        csv_df = csv_df[csv_df['profile'] != '']

                        st.write(f"**{len(csv_df)}** rows found")
                        st.dataframe(csv_df.head(20), use_container_width=True, hide_index=True)

                        uc1, uc2 = st.columns(2)
                        with uc1:
                            st.write("**Unique Colleges:**", ", ".join(csv_df['college'].unique()))
                        with uc2:
                            st.write("**Unique Batches:**", ", ".join(csv_df['batch'].unique()))

                        if st.button("Fetch All from CSV", type="primary", key="csv_fetch"):
                            unique_profiles = csv_df.drop_duplicates(subset='profile')
                            status_container = st.empty()
                            progress = st.progress(0, text="Starting...")
                            success_count = 0
                            fail_list = []

                            for i, row in enumerate(unique_profiles.itertuples()):
                                uname = row.profile
                                sname = row.name
                                college = row.college
                                batch = row.batch
                                progress.progress(
                                    (i) / len(unique_profiles),
                                    text=f"Fetching {uname} ({i+1}/{len(unique_profiles)})..."
                                )
                                data = fetch_leetcode_data(uname)
                                if data and data.get('matchedUser'):
                                    save_profile_to_db(uname, data, college=college, batch=batch, student_name=sname)
                                    success_count += 1
                                else:
                                    fail_list.append(uname)
                                if i < len(unique_profiles) - 1:
                                    time.sleep(2)

                            progress.progress(1.0, text="Done!")
                            status_container.success(f"Fetched {success_count}/{len(unique_profiles)} profiles.")
                            if fail_list:
                                st.warning(f"Failed/not found: {', '.join(fail_list)}")
                            st.rerun()

            st.divider()

            # Load cached data
            cached_df = load_all_profiles()

            if cached_df.empty:
                st.warning("No profiles in database yet. Enter usernames above and click Fetch & Save All.")
            else:
                st.success(f"{len(cached_df)} profile(s) in database.")

                st.subheader("Filter Dashboard")
                ff1, ff2 = st.columns(2)
                with ff1:
                    college_options = ["All"] + sorted(cached_df['college'].unique().tolist())
                    filter_college = st.selectbox("Filter by College", college_options, key="filter_college")
                with ff2:
                    batch_options = ["All"] + sorted(cached_df['batch'].unique().tolist())
                    filter_batch = st.selectbox("Filter by Batch", batch_options, key="filter_batch")

                filtered_df = cached_df.copy()
                if filter_college != "All":
                    filtered_df = filtered_df[filtered_df['college'] == filter_college]
                if filter_batch != "All":
                    filtered_df = filtered_df[filtered_df['batch'] == filter_batch]

                with st.expander("Manage stored profiles"):
                    st.dataframe(
                        cached_df[['student_name', 'username', 'college', 'batch', 'total_solved', 'score', 'fetched_at']].rename(
                            columns={'student_name': 'Name', 'username': 'Username', 'college': 'College', 'batch': 'Batch',
                                     'total_solved': 'Total Solved', 'score': 'Score', 'fetched_at': 'Fetched At'}),
                        use_container_width=True, hide_index=True)

                    col_del1, col_del2 = st.columns(2)
                    with col_del1:
                        del_user = st.text_input("Username to remove", key="lc_del_user")
                        if st.button("Remove User", key="lc_remove"):
                            if del_user.strip():
                                deleted = delete_profile_from_db(del_user.strip())
                                if deleted:
                                    st.rerun()
                                else:
                                    st.warning(f"Username '{del_user.strip()}' not found in database.")
                    with col_del2:
                        st.write("")
                        st.write("")
                        if st.button("Clear All Profiles", type="secondary", key="lc_clear"):
                            clear_all_profiles()
                            st.rerun()

                st.divider()
                if filtered_df.empty:
                    st.warning("No profiles match the selected filters.")
                else:
                    display_batch_dashboard_from_db(filtered_df)

        else:  # Codeforces Batch Dashboard
            input_tab, csv_tab = st.tabs(["Manual Entry", "Upload CSV"])

            with input_tab:
                st.subheader("Add Students")
                fc1, fc2 = st.columns(2)
                with fc1:
                    selected_college = st.selectbox("College", COLLEGES, key="cf_manual_college")
                with fc2:
                    selected_batch = st.selectbox("Batch", BATCHES, key="cf_manual_batch")

                usernames_input = st.text_area(
                    "Codeforces handles (one per line)",
                    placeholder="tourist\njiangly\nneal",
                    height=200,
                    key="cf_usernames",
                )

                if st.button("Fetch & Save All", type="primary", key="cf_manual_fetch"):
                    raw_lines = usernames_input.strip().splitlines()
                    usernames = [u.strip() for u in raw_lines if u.strip()]

                    if not usernames:
                        st.warning("Please enter at least one handle.")
                    else:
                        status_container = st.empty()
                        progress = st.progress(0, text="Starting...")
                        success_count = 0
                        fail_list = []

                        for i, uname in enumerate(usernames):
                            progress.progress((i) / len(usernames), text=f"Fetching {uname} ({i+1}/{len(usernames)})...")
                            data = fetch_codeforces_data(uname)
                            if data and data.get('user'):
                                save_cf_profile_to_db(uname, data, college=selected_college, batch=selected_batch)
                                success_count += 1
                            else:
                                fail_list.append(uname)
                            if i < len(usernames) - 1:
                                time.sleep(2)

                        progress.progress(1.0, text="Done!")
                        status_container.success(f"Fetched {success_count}/{len(usernames)} profiles.")
                        if fail_list:
                            st.warning(f"Failed/not found: {', '.join(fail_list)}")
                        st.rerun()

            with csv_tab:
                st.subheader("Upload CSV")
                st.markdown("CSV must have columns: **name**, **college**, **batch**, **profile** (Codeforces handle)")
                uploaded_file = st.file_uploader("Choose a CSV file", type="csv", key="cf_csv")

                if uploaded_file is not None:
                    csv_df = pd.read_csv(uploaded_file)
                    csv_df.columns = [c.strip().lower() for c in csv_df.columns]

                    required_cols = {'college', 'batch', 'profile', 'name'}
                    if not required_cols.issubset(set(csv_df.columns)):
                        st.error(f"CSV must have columns: name, college, batch, profile. Found: {list(csv_df.columns)}")
                    else:
                        csv_df = csv_df.dropna(subset=['profile'])
                        csv_df['profile'] = csv_df['profile'].astype(str).str.strip()
                        csv_df['name'] = csv_df['name'].astype(str).str.strip()
                        csv_df['college'] = csv_df['college'].astype(str).str.strip()
                        csv_df['batch'] = csv_df['batch'].astype(str).str.strip()
                        csv_df = csv_df[csv_df['profile'] != '']

                        st.write(f"**{len(csv_df)}** rows found")
                        st.dataframe(csv_df.head(20), use_container_width=True, hide_index=True)

                        uc1, uc2 = st.columns(2)
                        with uc1:
                            st.write("**Unique Colleges:**", ", ".join(csv_df['college'].unique()))
                        with uc2:
                            st.write("**Unique Batches:**", ", ".join(csv_df['batch'].unique()))

                        if st.button("Fetch All from CSV", type="primary", key="cf_csv_fetch"):
                            unique_profiles = csv_df.drop_duplicates(subset='profile')
                            status_container = st.empty()
                            progress = st.progress(0, text="Starting...")
                            success_count = 0
                            fail_list = []

                            for i, row in enumerate(unique_profiles.itertuples()):
                                uname = row.profile
                                sname = row.name
                                college = row.college
                                batch = row.batch
                                progress.progress(
                                    (i) / len(unique_profiles),
                                    text=f"Fetching {uname} ({i+1}/{len(unique_profiles)})..."
                                )
                                data = fetch_codeforces_data(uname)
                                if data and data.get('user'):
                                    save_cf_profile_to_db(uname, data, college=college, batch=batch, student_name=sname)
                                    success_count += 1
                                else:
                                    fail_list.append(uname)
                                if i < len(unique_profiles) - 1:
                                    time.sleep(2)

                            progress.progress(1.0, text="Done!")
                            status_container.success(f"Fetched {success_count}/{len(unique_profiles)} profiles.")
                            if fail_list:
                                st.warning(f"Failed/not found: {', '.join(fail_list)}")
                            st.rerun()

            st.divider()

            # Load cached Codeforces data
            cached_df = load_all_cf_profiles()

            if cached_df.empty:
                st.warning("No Codeforces profiles in database yet. Enter handles above and click Fetch & Save All.")
            else:
                st.success(f"{len(cached_df)} Codeforces profile(s) in database.")

                st.subheader("Filter Dashboard")
                ff1, ff2 = st.columns(2)
                with ff1:
                    college_options = ["All"] + sorted(cached_df['college'].unique().tolist())
                    filter_college = st.selectbox("Filter by College", college_options, key="cf_filter_college")
                with ff2:
                    batch_options = ["All"] + sorted(cached_df['batch'].unique().tolist())
                    filter_batch = st.selectbox("Filter by Batch", batch_options, key="cf_filter_batch")

                filtered_df = cached_df.copy()
                if filter_college != "All":
                    filtered_df = filtered_df[filtered_df['college'] == filter_college]
                if filter_batch != "All":
                    filtered_df = filtered_df[filtered_df['batch'] == filter_batch]

                with st.expander("Manage stored profiles"):
                    st.dataframe(
                        cached_df[['student_name', 'username', 'college', 'batch', 'problems_solved', 'score', 'fetched_at']].rename(
                            columns={'student_name': 'Name', 'username': 'Username', 'college': 'College', 'batch': 'Batch',
                                     'problems_solved': 'Problems Solved', 'score': 'Score', 'fetched_at': 'Fetched At'}),
                        use_container_width=True, hide_index=True)

                    col_del1, col_del2 = st.columns(2)
                    with col_del1:
                        del_user = st.text_input("Handle to remove", key="cf_del_user")
                        if st.button("Remove User", key="cf_remove"):
                            if del_user.strip():
                                deleted = delete_cf_profile_from_db(del_user.strip())
                                if deleted:
                                    st.rerun()
                                else:
                                    st.warning(f"Handle '{del_user.strip()}' not found in database.")
                    with col_del2:
                        st.write("")
                        st.write("")
                        if st.button("Clear All Profiles", type="secondary", key="cf_clear"):
                            clear_all_cf_profiles()
                            st.rerun()

                st.divider()
                if filtered_df.empty:
                    st.warning("No profiles match the selected filters.")
                else:
                    display_cf_batch_dashboard_from_db(filtered_df)

    # Footer
    st.divider()
    st.markdown("""
    <div style='text-align: center; color: gray; padding: 20px;'>
        Made for candidate assessment | Data from LeetCode GraphQL API & Codeforces API
    </div>
    """, unsafe_allow_html=True)

if __name__ == "__main__":
    main()