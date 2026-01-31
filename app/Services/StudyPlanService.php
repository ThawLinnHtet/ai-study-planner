<?php

namespace App\Services;

use App\AI\Neuron\NeuronService;
use App\Models\StudyPlan;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class StudyPlanService
{
    protected NeuronService $neuron;

    public function __construct(NeuronService $neuron)
    {
        $this->neuron = $neuron;
    }

    /**
     * Generate the initial study plan for a user after onboarding.
     */
    public function generateInitialPlan(User $user): StudyPlan
    {
        $data = [
            'subjects' => $user->subjects,
            'exam_dates' => $user->exam_dates,
            'subject_difficulties' => $user->subject_difficulties,
            'daily_study_hours' => $user->daily_study_hours,
            'productivity_peak' => $user->productivity_peak,
            'learning_style' => $user->learning_style,
            'study_goal' => $user->study_goal,
            'current_day' => Carbon::today()->format('l'),
            'current_date' => Carbon::today()->toDateString(),
        ];

        $output = $this->neuron->planner()->createPlan($data);

        return DB::transaction(function () use ($user, $output) {
            // Deactivate any existing active plans
            $user->studyPlans()->where('status', 'active')->update(['status' => 'archived']);

            return StudyPlan::create([
                'user_id' => $user->id,
                'title' => 'Initial Strategic Plan',
                'goal' => $user->study_goal,
                'starts_on' => Carbon::today(),
                // Use the latest exam date as the end date
                'ends_on' => collect($user->exam_dates)->map(fn($d) => Carbon::parse($d))->max(),
                'target_hours_per_week' => $user->daily_study_hours * 7,
                'status' => 'active',
                'preferences' => [
                    'productivity_peak' => $user->productivity_peak,
                    'learning_style' => $user->learning_style,
                ],
                'generated_plan' => (array)$output,
            ]);
        });
    }

    /**
     * Regenerate and optimize the plan based on performance analysis.
     */
    public function rebalancePlan(User $user): StudyPlan
    {
        $activePlan = $user->studyPlans()->where('status', 'active')->firstOrFail();

        // Gather performance data
        $recentSessions = $user->studySessions()
            ->where('started_at', '>=', Carbon::now()->subDays(7))
            ->get();
        
        $recentQuizzes = $user->quizResults()
            ->where('taken_at', '>=', Carbon::now()->subDays(7))
            ->get();

        // 1. Analyze performance
        $analysis = $this->neuron->analyzer()->analyze([
            'study_sessions' => $recentSessions->toArray(),
            'quiz_results' => $recentQuizzes->toArray(),
            'current_plan' => $activePlan->generated_plan,
        ]);

        // 2. Optimize plan
        $optimization = $this->neuron->optimizer()->optimize([
            'current_plan' => $activePlan->generated_plan,
            'analysis_insights' => (array)$analysis,
            'current_day' => Carbon::today()->format('l'),
            'current_date' => Carbon::today()->toDateString(),
        ]);

        // 3. Persist new plan
        return DB::transaction(function () use ($user, $activePlan, $optimization) {
            $activePlan->update(['status' => 'archived']);

            return StudyPlan::create([
                'user_id' => $user->id,
                'title' => 'Optimized Recovery Plan',
                'goal' => $activePlan->goal,
                'starts_on' => Carbon::today(),
                'ends_on' => $activePlan->ends_on,
                'target_hours_per_week' => $activePlan->target_hours_per_week,
                'status' => 'active',
                'preferences' => $activePlan->preferences,
                'generated_plan' => [
                    'schedule' => $optimization->optimized_schedule,
                    'strategy_summary' => $optimization->predicted_improvement,
                    'change_log' => $optimization->change_log,
                ],
            ]);
        });
    }
}
