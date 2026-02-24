<?php

namespace App\Jobs;

use App\Models\User;
use App\Services\StudyPlanService;
use Illuminate\Bus\Batchable;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class FinalizeStudyPlanJob implements ShouldQueue
{
    use Batchable, Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    protected User $user;

    /**
     * Create a new job instance.
     */
    public function __construct(User $user)
    {
        $this->user = $user;
    }

    /**
     * Execute the job.
     */
    public function handle(StudyPlanService $studyPlanService, \App\Services\UserProgressService $progressService): void
    {
        $this->user->update(['generating_status' => 'Perfecting your study balance...']);
        
        Log::info('Finalizing study plan in background', ['user_id' => $this->user->id]);

        try {
            // Ensure all learning path durations are aligned with user's current daily limit and preferences
            app(\App\Services\LearningPathService::class)->rebalanceDurationsForUser($this->user);

            $studyPlanService->generateInitialPlan($this->user);
            
            // Clear progress cache so the dashboard reflects new targets/hours
            $progressService->clearUserCache($this->user);
            
            Log::info('Background AI generation completed successfully', ['user_id' => $this->user->id]);
        } catch (\Exception $e) {
            Log::error('Failed to generate initial study plan in background: ' . $e->getMessage());
        } finally {
            $this->user->update([
                'is_generating_plan' => false,
                'generating_status' => null
            ]);
        }
    }
}
