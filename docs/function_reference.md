# Function Reference & Logic Flow

This document provides a technical deep-dive into the primary functions of Flux AI.

---

## 🏗 Onboarding & Setup

### `OnboardingController.store(Request $request)`
**File:** [OnboardingController.php](file:///d:/study-planner/app/Http/Controllers/OnboardingController.php)

*   **Step 1: Identity & Goals**
    1.  **Validation**: Ensures `subjects` is an array (1-6). `daily_study_hours` (integer).
    2.  **Processing**: Normalizes subject names using `mb_convert_case` (Title Case).
    3.  **Validation**: Uses `StudyHoursValidator` to check if `daily_study_hours` is realistic (max 6).
*   **Step 2: Subject Parameters**
    1.  **Validation**: Requires `start_date` and `end_date` for every subject.
    2.  **Processing**: Checks that `start_date` is before `end_date`.
    3.  **Workload Analysis**: Calls `WorkloadAnalyzer.analyze`.
        *   Calculates `TotalDays * DailyHours`.
        *   If the workload is "unsustainable" (too many complex subjects in too little time), it returns a warning flash message.
*   **Step 3: Optimization**
    1.  **Processing**: Merges custom `subject_session_durations` with defaults (30-90 min).
    2.  **Validation**: Checks if the sum of all subject "minimum" sessions exceeds the daily hour budget.
*   **Final Step: Completion**
    1.  Sets `onboarding_completed = true`.
    2.  Dispatches `GenerateParallelCurriculaJob`.

---

## 🧠 AI Curriculum Logic

### `LearningPathService.enroll(...)`
**File:** [LearningPathService.php](file:///d:/study-planner/app/Services/LearningPathService.php)

1.  **Duplication Check**: Ensures user doesn't have an active path for the same subject.
2.  **Curriculum Generation**:
    *   Calls `NeuronService.curriculum().generateCurriculum()`.
    *   **AI Prompt**: Includes `total_days`, `difficulty`, and `study_goal`.
3.  **Normalization**:
    *   Iterates through 1 to `total_days`.
    *   If AI skipped a day, fills it with a fallback topic from `SubjectCurriculumTemplates`.
    *   Ensures duration is clamped within user limits.
    *   **Resources**: Injects official documentation URLs and YouTube "Search Query" URLs if missing.

---

## 🗓 Schedule Generation

### `StudyPlanService.generateInitialPlan(User $user)`
**File:** [StudyPlanService.php](file:///d:/study-planner/app/Services/StudyPlanService.php)

1.  **Data Gathering**: Fetches all active `LearningPath` records.
2.  **Week 1 Assembly**: Takes "Day 1" topics from every active subject.
3.  **Focus Leveling**: Alternates high-focus and low-focus sessions to prevent burnout.
4.  **Distribution**: Spreads sessions across the 7-day week according to the `daily_study_hours` budget.

---

## 📝 Quiz System

### `QuizService.submitAnswers(...)`
**File:** [QuizService.php](file:///d:/study-planner/app/Services/QuizService.php)

1.  **Scoring**: Iterates through `questions` from the `Quiz` model.
2.  **Matching**: Compares `user_answer` string to `correct_answer` label.
3.  **Outcome**:
    *   Sets `score` and `percentage`.
    *   Captures `duration_seconds` for progress stats.
4.  **Storage**: Creates a `QuizResult` and links it to the `StudySession` if applicable.
5.  **Completion**: If passed (>=70%), the `StudyPlanService` will automatically advance the topic in the next rebalance.

---

## 💬 AI Tutor (Chat) Logic

### `NeuronChatService.sendStream(...)`
**File:** [NeuronChatService.php](file:///d:/study-planner/app/Services/NeuronChatService.php)

1.  **Thread Validation**: Ensures the user owns the `thread_id`. Creates a new one if missing.
2.  **Context Injection**: Calls `buildContext(User $user)`.
    *   Fetches active `StudyPlan` name and goal.
    *   Lists topics studied "Today" and "Recently".
    *   Includes current `Level` and `Streak`.
3.  **Prompt Assembly**: Combines user message + full context history.
4.  **Streaming Response**:
    *   Iterates through the LLM stream.
    *   Calculates `total_tokens` (if available).
    *   Echoes data in SSE format (`data: { ... }`).
5.  **Persistence**: Saves the final completed response as a `ChatMessage` model.

### `NeuronChatService.generateSmartTitle(...)`
1.  Sends the first user message to the AI.
2.  Asks specifically for a "3-5 word concise title" that summarizes the intent.
3.  Updates the `ChatThread` title dynamically.

---

## 🎖 Gamification & Streaks

### `UserProgressService.calculateXpFromMinutesAndSessions(...)`
**File:** [UserProgressService.php](file:///d:/study-planner/app/Services/UserProgressService.php)

1.  **Input**: Total minutes studied and sessions completed.
2.  **Calculation**: `XP = (Minutes * 2) + (Sessions * 10)`.
3.  **Logic**: Prioritizes "Deep Work" time while providing a completion bonus for task switching.

### `ActivityTrackingService.updateStreak(User $user)`
**File:** [ActivityTrackingService.php](file:///d:/study-planner/app/Services/ActivityTrackingService.php)

1.  **Analysis**: Fetches unique study dates from the database.
2.  **Consecutive Check**: Loops backwards from today to count consecutive days.
3.  **Grace Period**:
    *   If a user misses a day, `getGracePeriod()` checks their previous streak.
    *   Longer streaks (3+ days) may get a 1-day grace period where the streak is "rescued" automatically.
4.  **Update**: Records the new `study_streak` on the User model.

---

## 🔔 Notifications & Reminders

### `ReminderService.scheduleRemindersForUser(User $user)`
**File:** [ReminderService.php](file:///d:/study-planner/app/Services/ReminderService.php)

1.  **Check**: Looks for pending tasks in the `StudyPlan`.
2.  **Condition**: Evaluates if today is a study day and if many tasks are left uncompleted.
3.  **Scheduling**: Creates a `Reminder` record with a `scheduled_at` time based on the user's past activity window.
4.  **Email Dispatch**: A background command (`sendDueReminders`) picks these up and sends them to the user's email.

---

## 🧪 Rebalancing Algorithm

### `StudyPlanService.rebalancePlan(User $user)`
**File:** [StudyPlanService.php](file:///d:/study-planner/app/Services/StudyPlanService.php)

1.  **Diagnostic**: Fetches last 14 days of `QuizResult` and `StudySession` data.
2.  **AI Analysis**: Sends performance history to `AnalyzerAgent`.
    *   **Output**: List of "At Risk" topics and "Stagnant" subjects.
3.  **Optimization**: `CleanOptimizerAgent` suggests updates.
4.  **Implementation**:
    *   Adds extra time slots for weak subjects.
    *   Re-orders topics to re-study failed quiz areas.
    *   Generates a new JSON schedule with the "Optimized" flag.
