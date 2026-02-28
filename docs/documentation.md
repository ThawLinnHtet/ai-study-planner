# Flux AI Technical Documentation

Flux AI is an adaptive study planning platform that uses AI (Gemini 2.0) to generate personalized learning paths and schedules.

---

## 📁 Directory Structure

### `/app`
*   **`AI/Neuron`**: The brains of the app. Contains AI Agents (`QuizAgent`, `CleanPlannerAgent`, etc.) and structured `Output` classes.
*   **`Http/Controllers`**: Handles web/api requests.
    *   `AiTutorController`: Handles chat thread management and messaging.
    *   `OnboardingController`: Manages the 4-step setup flow.
    *   `QuizController`: Handles quiz generation and submission.
    *   `StudyPlanController`: Manages schedule viewing and rebalancing.
*   **`Services`**: Core business logic.
    *   `NeuronChatService`: Real-time AI context building and streaming logic.
    *   `StudyPlanService`: Orchestrates schedule generation and optimization.
    *   `QuizService`: Logic for quiz scoring and AI generation.
    *   `LearningPathService`: Manages per-subject curricula.
    *   `UserProgressService`: Calculates XP, levels, and streaks.
    *   `ActivityTrackingService`: Manages streaks, grace periods, and behavioral logs.
    *   `ReminderService`: Schedules notifications (email/in-app) and nudges.
    *   `WorkloadAnalyzer`: Heuristic analysis of study feasibility.
*   **`Models`**: Eloquent models (`User`, `StudyPlan`, `LearningPath`, `Quiz`, `StudySession`).

### `/resources/js`
*   **`components/`**: Reusable UI parts (Modals, Charts, Chat Widget).
*   **`pages/`**: Inertia views (Dashboard, Onboarding, Progress).
*   **`layouts/`**: `AppShell` and Sidebar wrappers.

---

## 🚀 Core Workflows

### 1. Onboarding & Plan Generation
**File:** [OnboardingController.php](file:///d:/study-planner/app/Http/Controllers/OnboardingController.php)

1.  **Validation**:
    *   **Step 1**: Subjects (max 6), hours (1-6/day), and goals.
    *   **Step 2**: Dates and difficulty. Uses `WorkloadAnalyzer` to ensure the subject list is realistic for the timeline.
    *   **Step 3**: Timezone and session lengths.
2.  **Dispatch**: Calls `GenerateParallelCurriculaJob`.
3.  **AI Curriculum**: `ParallelCurriculumService` generates structured JSON for each subject simultaneously.
4.  **Assembly**: `FinalizeStudyPlanJob` uses `StudyPlanService` to weave these into a master weekly schedule.

### 2. The Quiz System
**File:** [QuizService.php](file:///d:/study-planner/app/Services/QuizService.php)

*   **`generateForSession`**:
    1.  Identifies current topic.
    2.  Calls `QuizAgent` for 10 unique questions.
    3.  If a retry, adds "focus on different aspects" prompt.
*   **`submitAnswers`**:
    1.  Compares user answers vs correct labels.
    2.  Calculates percentage (70% pass threshold).
    3.  Records duration and anti-cheat metadata.

### 3. Gamification (XP & Streaks)
**File:** [UserProgressService.php](file:///d:/study-planner/app/Services/UserProgressService.php)

*   **XP Formula**: `(Minutes * 2) + (Sessions * 10)`.
*   **Leveling**: `100 * (Level - 1)^2`.
*   **Streaks**: Validates daily study. Includes a **1-day grace period** for streaks over 3 days.

### 4. AI Tutor (Chat Bot)
**File:** [NeuronChatService.php](file:///d:/study-planner/app/Services/NeuronChatService.php)

1.  **Context Building**: Every message triggers `buildContext()`, which gathers your current plan, session history, and XP stats.
2.  **System Prompt**: Injects this context into a tutor persona.
3.  **Streaming**: Uses Server-Sent Events (SSE) to stream responses from Gemini 2.0 to the frontend.
4.  **Thread Management**: Auto-generates smart titles for chat threads based on the first message.

### 5. Rebalancing Logic
**File:** [StudyPlanService.php](file:///d:/study-planner/app/Services/StudyPlanService.php)

*   **`rebalancePlan`**:
    1.  Analyzes recent performance (Quiz scores + session completion).
    2.  `AnalyzerAgent` identifies "Weak Topics" and "Slow Subjects".
    3.  `CleanOptimizerAgent` adjusts future weeks to spend more time on weak areas.

---

## 🤖 Neuron AI Agents

Agents are located in `app/AI/Neuron`. They use **Structured Output** to ensure the AI returns valid JSON.

| Agent | Purpose | Output Class |
| :--- | :--- | :--- |
| `CleanPlannerAgent` | Generates master schedules | `PlannerOutput` |
| `QuizAgent` | Generates study quizzes | `QuizOutput` |
| `CurriculumAgent` | Generates per-subject topics | `CurriculumOutput` |
| `AnalyzerAgent` | Diagnoses learning gaps | `AnalyzerOutput` |

---

## 🛠 UI Architecture & Flow

**Stack:** Laravel + Inertia.js + React + Tailwind CSS

1.  **Server Rendering**: Controllers return `Inertia::render('page-name', $data)`.
2.  **Shared Data**: `HandleInertiaRequests.php` middleware injects global props (User, App Name, Notifications) into every page.
3.  **Client Hydration**: React components receive these props and render the dynamic UI without full page reloads.
4.  **State Management**: Uses local React state for modals and simple interactions, while Inertia manages the "Global" application state via props.

---

## 🛠 Validation Reference

| Feature | Logic Location | Key Rule |
| :--- | :--- | :--- |
| **Hours** | `StudyHoursValidator` | 1-6 hours/day for "Realistic" flag. |
| **Workload** | `WorkloadAnalyzer` | Subjects * days vs Available hours. |
| **Quiz** | `QuizService` | `percentage >= 70` to mark as "Passed". |
| **Subjects** | `OnboardingController` | Matches `[a-zA-Z]` (no pure numbers/symbols). |
