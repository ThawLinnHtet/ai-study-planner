<?php

namespace App\Jobs;

use App\Models\User;
use App\Services\LearningPathService;
use App\Services\ParallelCurriculumService;
use App\Jobs\FinalizeStudyPlanJob;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class GenerateParallelCurriculaJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    protected User $user;
    protected array $subjectsData;

    /**
     * Create a new job instance.
     * 
     * @param array $subjectsData Map of subject name => [start_date, end_date, difficulty]
     */
    public function __construct(User $user, array $subjectsData)
    {
        $this->user = $user;
        $this->subjectsData = $subjectsData;
    }

    /**
     * Execute the job.
     */
    public function handle(
        ParallelCurriculumService $parallelService,
        LearningPathService $learningPathService
    ): void {
        $subjectCount = count($this->subjectsData);
        $subjectList = implode(', ', array_keys($this->subjectsData));
        $this->user->update(['generating_status' => "Neuron AI is mapping out your path for {$subjectList}..."]);
        
        Log::info("Parallel curriculum processing started for user: {$this->user->id}", [
            'subjects' => array_keys($this->subjectsData)
        ]);

        try {
            // Prepare inputs for parallel service
            $batchInputs = [];
            foreach ($this->subjectsData as $subject => $data) {
                // Determine remaining days if path already exists with progress
                $existing = $this->user->learningPaths()
                    ->where('subject_name', $subject)
                    ->where('status', 'active')
                    ->first();

                $totalDays = \Carbon\Carbon::parse($data['start_date'])
                    ->diffInDays(\Carbon\Carbon::parse($data['end_date'])) + 1;
                $totalDays = max(1, $totalDays);

                $remainingDays = $totalDays;
                if ($existing) {
                    $completedDayCount = max(0, $existing->current_day - 1);
                    if ($existing->isCurrentDayComplete()) {
                        $completedDayCount = $existing->current_day;
                    }
                    $remainingDays = max(0, $totalDays - $completedDayCount);

                    // Skip if existing curriculum matches these exact parameters
                    $curriculum = $existing->curriculum ?? [];
                    $metadata = $curriculum['_metadata'] ?? null;
                    
                    if ($metadata) {
                        $currentParams = [
                            'total_days' => $remainingDays,
                            'difficulty' => $data['difficulty'] ?? 2,
                            'daily_hours' => $this->user->daily_study_hours ?? 2,
                            'study_goal' => $this->user->study_goal ?? 'General Study Improvement',
                        ];

                        if ($metadata === $currentParams) {
                            Log::info("Skipping AI generation for {$subject} - Metadata matches existing curriculum.");
                            continue;
                        }
                    }
                }

                if ($remainingDays > 0) {
                    $batchInputs[] = [
                        'subject' => $subject,
                        'total_days' => $remainingDays,
                        'difficulty' => $data['difficulty'] ?? 2,
                        'daily_hours' => $this->user->daily_study_hours ?? 2,
                        'study_goal' => $this->user->study_goal ?? 'General Study Improvement',
                        'total_subjects' => count($this->user->subjects ?? []) ?: $subjectCount,
                    ];
                }
            }

            // Execute parallel AI calls
            $results = $parallelService->generateBatch($batchInputs);

            // Process results and update paths
            foreach ($this->subjectsData as $subject => $data) {
                $curriculumOutput = $results[$subject] ?? null;
                $curriculumData = $curriculumOutput ? $curriculumOutput->curriculum : null;

                $existing = $this->user->learningPaths()
                    ->where('subject_name', $subject)
                    ->where('status', 'active')
                    ->first();

                if ($curriculumData) {
                    // Inject metadata for future caching
                    $curriculumData['_metadata'] = [
                        'total_days' => $this->calculateRemainingDays($existing, $data),
                        'difficulty' => $data['difficulty'] ?? 2,
                        'daily_hours' => $this->user->daily_study_hours ?? 2,
                        'study_goal' => $this->user->study_goal ?? 'General Study Improvement',
                    ];

                    if ($existing) {
                        $hasProgress = $existing->completedSessionsCount() > 0;
                        if ($hasProgress) {
                            $learningPathService->updateLearningPath($this->user, $existing, array_merge($data, [
                                'curriculum' => $curriculumData
                            ]));
                        } else {
                            // Delete and re-create for fresh curriculum
                            $learningPathService->deleteLearningPath($this->user, $existing->id);
                            $learningPathService->enroll($this->user, array_merge($data, [
                                'subject_name' => $subject,
                                'curriculum' => $curriculumData
                            ]));
                        }
                    } else {
                        $learningPathService->enroll($this->user, array_merge($data, [
                            'subject_name' => $subject,
                            'curriculum' => $curriculumData
                        ]));
                    }
                }
            }

            // Rebalance existing paths to fit the daily budget before final plan generation
            $learningPathService->rebalanceDurationsForUser($this->user);

            // Finally, dispatch the master plan generator
            FinalizeStudyPlanJob::dispatch($this->user);

        } catch (\Exception $e) {
            Log::error("Failed parallel curriculum generation for user {$this->user->id}: " . $e->getMessage());
            $this->user->update([
                'is_generating_plan' => false,
                'generating_status' => "Neuron AI encountered a momentary pause. Let's try again."
            ]);
        }
    }

    /**
     * Helper to calculate remaining days consistently
     */
    private function calculateRemainingDays(?\App\Models\LearningPath $existing, array $data): int
    {
        $totalDays = \Carbon\Carbon::parse($data['start_date'])
            ->diffInDays(\Carbon\Carbon::parse($data['end_date'])) + 1;
        $totalDays = max(1, $totalDays);

        if (!$existing) {
            return $totalDays;
        }

        $completedDayCount = max(0, $existing->current_day - 1);
        if ($existing->isCurrentDayComplete()) {
            $completedDayCount = $existing->current_day;
        }

        return max(0, $totalDays - $completedDayCount);
    }
}
