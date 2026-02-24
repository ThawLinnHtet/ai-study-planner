<?php

namespace App\Services;

use App\AI\Neuron\NeuronService;
use App\Models\LearningPath;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class LearningPathService
{
    protected NeuronService $neuron;

    public function __construct(NeuronService $neuron)
    {
        $this->neuron = $neuron;
    }

    /**
     * Create a new learning path for a subject with start/end dates.
     * Generates AI curriculum covering beginner → advanced.
     */
    public function enroll(User $user, array $data, bool $useAi = true): LearningPath
    {
        $subjects = $user->subjects ?? [];
        if (count($subjects) >= 6 && !in_array($data['subject_name'], $subjects)) {
            throw new \Exception("Focus Six: You have reached the limit of 6 active subjects. Focused learning leads to better results!");
        }

        $subjectName = $data['subject_name'];
        $startDate = Carbon::parse($data['start_date']);
        $endDate = Carbon::parse($data['end_date']);
        $totalDays = max(1, $startDate->diffInDays($endDate) + 1);
        $difficulty = $data['difficulty'] ?? 2;
        $sessionDurations = $user->subject_session_durations ?? [];

        // Check if already has an active learning path for this subject
        $existing = $user->learningPaths()
            ->where('subject_name', $subjectName)
            ->where('status', 'active')
            ->first();

        if ($existing) {
            throw new \Exception("You already have an active Learning Path for '{$subjectName}'. Please remove it first to start a new one.");
        }

        $curriculum = $data['curriculum'] ?? $this->generateCurriculum(
            $subjectName,
            $totalDays,
            $difficulty,
            $user->daily_study_hours ?? 2,
            $user->study_goal ?? 'General Study Improvement',
            $useAi,
            $sessionDurations
        );

        // Always normalize if provided directly (e.g. from parallel job)
        if (isset($data['curriculum'])) {
            $curriculum = $this->normalizeCurriculum($curriculum, $totalDays, $subjectName, $sessionDurations);
        }

        $learningPath = LearningPath::create([
            'user_id' => $user->id,
            'subject_name' => $subjectName,
            'start_date' => $startDate,
            'end_date' => $endDate,
            'total_days' => $totalDays,
            'current_day' => 1,
            'status' => 'active',
            'curriculum' => $curriculum,
            'difficulty' => $difficulty,
        ]);

        // Also update user subjects array if not already present
        $subjects = $user->subjects ?? [];
        if (!in_array($subjectName, $subjects)) {
            $subjects[] = $subjectName;
            $user->update(['subjects' => $subjects]);
        }

        Log::info('Learning Path created', [
            'user_id' => $user->id,
            'subject' => $subjectName,
            'total_days' => $totalDays,
        ]);

        // Rebalance all active paths to fit the daily limit after adding a new one
        $this->rebalanceDurationsForUser($user);

        return $learningPath;
    }

    protected function generateCurriculum(
        string $subject,
        int $totalDays,
        int $difficulty,
        int $dailyHours,
        string $studyGoal,
        bool $useAi = true,
        array $sessionDurations = []
    ): array {
        if ($useAi) {
            try {
                $output = $this->neuron->curriculum()->generateCurriculum([
                    'subject' => $subject,
                    'total_days' => $totalDays,
                    'difficulty' => $difficulty,
                    'daily_hours' => $dailyHours,
                    'study_goal' => $studyGoal,
                ]);

                if (!empty($output->curriculum) && is_array($output->curriculum)) {
                    Log::info("AI curriculum generated successfully for {$subject}");
                    return $this->normalizeCurriculum($output->curriculum, $totalDays, $subject, $sessionDurations);
                }
            } catch (\Exception $e) {
                Log::error("CRITICAL: AI curriculum generation failed for {$subject}", [
                    'subject' => $subject,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        // Fallback: generate a basic progressive curriculum
        return $this->generateFallbackCurriculum($subject, $totalDays, $difficulty, $sessionDurations);
    }

    /**
     * Normalize AI-generated curriculum to ensure all days are present and well-formed.
     */
    protected function normalizeCurriculum(array $curriculum, int $totalDays, string $subject, array $sessionDurations): array
    {
        $normalized = [];

        for ($day = 1; $day <= $totalDays; $day++) {
            $dayKey = (string) $day;
            $dayData = $curriculum[$dayKey] ?? null;

            if ($dayData && is_array($dayData)) {
                $duration = $this->parseDuration($dayData['duration_minutes'] ?? 60);
                $duration = $this->clampDurationForSubject($subject, $duration, $sessionDurations);
                $normalized[$dayKey] = [
                    'topic' => $dayData['topic'] ?? "{$subject} - Day {$day}",
                    'level' => $dayData['level'] ?? $this->getLevelForDay($day, $totalDays),
                    'duration_minutes' => $duration,
                    'focus_level' => $dayData['focus_level'] ?? 'medium',
                    'key_topics' => is_array($dayData['key_topics'] ?? null) ? $dayData['key_topics'] : [],
                    'sub_topics' => is_array($dayData['sub_topics'] ?? null) ? $dayData['sub_topics'] : [],
                    'resources' => $this->normalizeResources($dayData['resources'] ?? [], $subject, $dayData['topic'] ?? $subject),
                ];
            } else {
                // Fill in missing days with subject-specific fallback data
                $level = $this->getLevelForDay($day, $totalDays);
                $templates = SubjectCurriculumTemplates::getTopicsForSubject($subject);
                $tierTopics = $templates[$level] ?? $templates['beginner'] ?? [];
                $topicIndex = ($day - 1) % max(1, count($tierTopics));
                $topic = !empty($tierTopics) ? $tierTopics[$topicIndex] : "{$subject} - Day {$day}";
                $duration = $this->clampDurationForSubject($subject, 60, $sessionDurations);

                $normalized[$dayKey] = [
                    'topic' => $topic,
                    'level' => $level,
                    'duration_minutes' => $duration,
                    'focus_level' => 'medium',
                    'key_topics' => $this->generateSpecificKeyTopics($subject, $topic, $level, $day),
                    'sub_topics' => $this->generateSpecificSubTopics($subject, $topic, $level, 2),
                    'resources' => $this->defaultResources($subject, $topic),
                ];
            }
        }

        return $normalized;
    }

    /**
     * Get the appropriate level for a day based on where it falls in the total plan.
     */
    protected function getLevelForDay(int $day, int $totalDays): string
    {
        $progress = $day / $totalDays;

        if ($progress <= 0.3) {
            return 'beginner';
        } elseif ($progress <= 0.7) {
            return 'intermediate';
        }

        return 'advanced';
    }

    /**
     * Parse duration value to integer.
     */
    protected function parseDuration(mixed $val): int
    {
        if (is_int($val) || is_float($val)) {
            return max(15, min(600, (int) $val));
        }

        if (is_string($val)) {
            $numeric = preg_replace('/[^0-9]/', '', $val);
            return max(15, min(600, (int) $numeric ?: 60));
        }

        return 60;
    }

    /**
     * Normalize resource URLs and ensure a mix of video and article.
     */
    protected function normalizeResources(array $resources, string $subject, string $topic): array
    {
        $normalized = [];
        $hasVideo = false;
        $hasArticle = false;

        foreach ($resources as $resource) {
            if (!is_array($resource)) {
                continue;
            }

            $url = $resource['url'] ?? '';
            $title = $resource['title'] ?? $subject;
            $type = $resource['type'] ?? 'article';

            // Sanitize YouTube URLs to search format
            if (str_contains($url, 'youtube.com') && !str_contains($url, 'search_query')) {
                $searchQuery = urlencode("{$subject} {$topic} tutorial");
                $url = "https://www.youtube.com/results?search_query={$searchQuery}";
            }

            // Replace Google search URLs with direct documentation links ONLY if they are generic
            if (str_contains($url, 'google.com/search')) {
                $docUrl = $this->getDocumentationUrl($subject, $topic);
                // Only overwrite if we have a specific match better than a generic MDN search
                if (!str_contains($docUrl, 'developer.mozilla.org/en-US/docs/Web') || str_contains($url, 'official+documentation')) {
                    $url = $docUrl;
                }
            }

            if ($type === 'video') $hasVideo = true;
            if ($type === 'article') $hasArticle = true;

            $normalized[] = [
                'title' => $title,
                'url' => $url,
                'type' => $type,
            ];
        }

        // If AI missed one of the required types, inject it
        if (!$hasVideo) {
            $searchQuery = urlencode("{$subject} {$topic} tutorial");
            $normalized[] = [
                'title' => "{$subject} - Video Guide",
                'url' => "https://www.youtube.com/results?search_query={$searchQuery}",
                'type' => 'video',
            ];
        }

        if (!$hasArticle) {
            $normalized[] = [
                'title' => "{$subject} Documentation",
                'url' => $this->getDocumentationUrl($subject, $topic),
                'type' => 'article',
            ];
        }

        return $normalized;
    }

    /**
     * Default resources for a subject/topic.
     */
    protected function defaultResources(string $subject, string $topic): array
    {
        $searchQuery = urlencode("{$subject} {$topic} tutorial");

        return [
            [
                'title' => "{$subject} - Video Overview",
                'url' => "https://www.youtube.com/results?search_query={$searchQuery}",
                'type' => 'video',
            ],
            [
                'title' => "{$subject} Official Docs",
                'url' => $this->getDocumentationUrl($subject, $topic),
                'type' => 'article',
            ],
        ];
    }

    /**
     * Resolve an official documentation URL for a subject/topic pair.
     */
    protected function getDocumentationUrl(string $subject, string $topic): string
    {
        $subjectKey = Str::lower($subject);
        $topicKey = Str::slug($topic, '-');

        $docCatalog = [
            'typescript' => [
                'base' => 'https://www.typescriptlang.org/docs/handbook/intro.html',
                'topics' => [
                    'functions' => 'https://www.typescriptlang.org/docs/handbook/2/functions.html',
                    'generics' => 'https://www.typescriptlang.org/docs/handbook/2/generics.html',
                    'types' => 'https://www.typescriptlang.org/docs/handbook/2/everyday-types.html',
                ],
            ],
            'javascript' => [
                'base' => 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide',
            ],
            'react' => [
                'base' => 'https://react.dev/learn',
                'topics' => [
                    'hooks' => 'https://react.dev/reference/react/hooks',
                    'components' => 'https://react.dev/learn/your-first-component',
                    'state' => 'https://react.dev/learn/state-a-components-memory',
                ],
            ],
            'next' => [
                'base' => 'https://nextjs.org/docs',
            ],
            'vue' => [
                'base' => 'https://vuejs.org/guide/introduction.html',
            ],
            'nuxt' => [
                'base' => 'https://nuxt.com/docs/getting-started/introduction',
            ],
            'angular' => [
                'base' => 'https://angular.dev/tutorials/learn-angular',
            ],
            'svelte' => [
                'base' => 'https://svelte.dev/docs',
            ],
            'node' => [
                'base' => 'https://nodejs.org/en/docs',
            ],
            'express' => [
                'base' => 'https://expressjs.com/en/guide/routing.html',
            ],
            'python' => [
                'base' => 'https://docs.python.org/3/tutorial/',
            ],
            'django' => [
                'base' => 'https://docs.djangoproject.com/en/stable/',
            ],
            'flask' => [
                'base' => 'https://flask.palletsprojects.com/en/latest/',
            ],
            'java' => [
                'base' => 'https://docs.oracle.com/javase/tutorial/',
            ],
            'spring' => [
                'base' => 'https://docs.spring.io/spring-boot/docs/current/reference/htmlsingle/',
            ],
            'c#' => [
                'base' => 'https://learn.microsoft.com/en-us/dotnet/csharp/',
            ],
            'dotnet' => [
                'base' => 'https://learn.microsoft.com/en-us/dotnet/',
            ],
            'php' => [
                'base' => 'https://www.php.net/manual/en/',
            ],
            'laravel' => [
                'base' => 'https://laravel.com/docs',
            ],
            'symfony' => [
                'base' => 'https://symfony.com/doc/current/index.html',
            ],
            'ruby' => [
                'base' => 'https://ruby-doc.org/core/',
            ],
            'rails' => [
                'base' => 'https://guides.rubyonrails.org/',
            ],
            'go' => [
                'base' => 'https://go.dev/doc/',
            ],
            'rust' => [
                'base' => 'https://doc.rust-lang.org/book/',
            ],
            'swift' => [
                'base' => 'https://docs.swift.org/swift-book/',
            ],
            'kotlin' => [
                'base' => 'https://kotlinlang.org/docs/home.html',
            ],
            'docker' => [
                'base' => 'https://docs.docker.com/guides/',
            ],
            'kubernetes' => [
                'base' => 'https://kubernetes.io/docs/home/',
            ],
            'git' => [
                'base' => 'https://git-scm.com/docs',
            ],
            'science' => [
                'base' => 'https://www.sciencedaily.com/',
            ],
            'mathematics' => [
                'base' => 'https://www.khanacademy.org/math',
            ],
            'math' => [
                'base' => 'https://www.khanacademy.org/math',
            ],
            'biology' => [
                'base' => 'https://www.khanacademy.org/science/biology',
            ],
            'physics' => [
                'base' => 'https://www.khanacademy.org/science/physics',
            ],
            'chemistry' => [
                'base' => 'https://www.khanacademy.org/science/chemistry',
            ],
            'sql' => [
                'base' => 'https://www.w3schools.com/sql/',
            ],
            'database' => [
                'base' => 'https://www.w3schools.com/sql/',
            ],
            'css' => [
                'base' => 'https://developer.mozilla.org/en-US/docs/Web/CSS',
            ],
            'html' => [
                'base' => 'https://developer.mozilla.org/en-US/docs/Web/HTML',
            ],
            'tailwind' => [
                'base' => 'https://tailwindcss.com/docs',
            ],
            'aws' => [
                'base' => 'https://docs.aws.amazon.com/',
            ],
            'azure' => [
                'base' => 'https://learn.microsoft.com/en-us/azure/',
            ],
            'accounting' => [
                'base' => 'https://www.investopedia.com/terms/a/accounting.asp',
            ],
            'economics' => [
                'base' => 'https://www.khanacademy.org/economics-finance-domain',
            ],
        ];

        foreach ($docCatalog as $keyword => $config) {
            if (Str::contains($subjectKey, $keyword)) {
                if (!empty($config['topics'])) {
                    foreach ($config['topics'] as $match => $url) {
                        if (Str::contains($topicKey, $match)) {
                            return $url;
                        }
                    }
                }

                return $config['base'];
            }
        }

        return 'https://developer.mozilla.org/en-US/docs/Web';
    }

    /**
     * Generate a basic fallback curriculum when AI is unavailable.
     */
    protected function generateFallbackCurriculum(
        string $subject,
        int $totalDays,
        int $difficulty,
        array $sessionDurations
    ): array {
        $curriculum = [];

        // Get subject-specific topics
        $topics = \App\Services\SubjectCurriculumTemplates::getTopicsForSubject($subject);
        $beginnerTopics = $topics['beginner'];
        $intermediateTopics = $topics['intermediate'];
        $advancedTopics = $topics['advanced'];


        for ($day = 1; $day <= $totalDays; $day++) {
            $level = $this->getLevelForDay($day, $totalDays);

            $topicList = match ($level) {
                'beginner' => $beginnerTopics,
                'intermediate' => $intermediateTopics,
                default => $advancedTopics,
            };

            $topicIndex = ($day - 1) % count($topicList);
            $topic = $topicList[$topicIndex];

            $focusLevel = match ($difficulty) {
                1 => $level === 'advanced' ? 'medium' : 'low',
                3 => $level === 'beginner' ? 'medium' : 'high',
                default => 'medium',
            };

            $duration = match ([$level, $difficulty]) {
                ['beginner', 1] => 30,
                ['beginner', 2] => 45,
                ['beginner', 3] => 60,
                ['intermediate', 1] => 45,
                ['intermediate', 2] => 60,
                ['intermediate', 3] => 75,
                ['advanced', 1] => 60,
                ['advanced', 2] => 75,
                ['advanced', 3] => 90,
                default => 60,
            };
            $duration = $this->clampDurationForSubject($subject, $duration, $sessionDurations);

            $curriculum[(string) $day] = [
                'topic' => $topic,
                'level' => $level,
                'duration_minutes' => $duration,
                'focus_level' => $focusLevel,
                'key_topics' => $this->generateSpecificKeyTopics($subject, $topic, $level, $day),
                'sub_topics' => $this->generateSpecificSubTopics($subject, $topic, $level, $difficulty),
                'resources' => $this->defaultResources($subject, $topic),
            ];
        }

        return $curriculum;
    }

    /**
     * Generate specific key topics based on subject and level.
     */
    protected function generateSpecificKeyTopics(string $subject, string $topic, string $level, int $day): array
    {
        $templates = SubjectCurriculumTemplates::getTopicsForSubject($subject);
        $tierTopics = $templates[$level] ?? $templates['beginner'] ?? [];

        if (!empty($tierTopics)) {
            // Pick 3 topics cycling through the tier list based on day number
            $count = count($tierTopics);
            return [
                $tierTopics[($day - 1) % $count],
                $tierTopics[$day % $count],
                "Focus: {$topic}",
            ];
        }

        return [
            "{$subject}: {$topic}",
            "{$subject} key principles",
            "{$subject} practice exercises",
        ];
    }

    /**
     * Generate specific sub-topics based on subject, level, and difficulty.
     */
    protected function generateSpecificSubTopics(string $subject, string $topic, string $level, int $difficulty): array
    {
        $templates = SubjectCurriculumTemplates::getTopicsForSubject($subject);
        $tierTopics = $templates[$level] ?? $templates['beginner'] ?? [];

        // Build sub-topics from the curriculum template + topic-specific items
        $subTopics = [];

        if (!empty($tierTopics)) {
            // Use curriculum template topics as sub-topic anchors
            foreach (array_slice($tierTopics, 0, 3) as $t) {
                $subTopics[] = "{$t} — review & practice";
            }
        }

        // Add topic-specific sub-topics
        $subTopics[] = "{$topic}: detailed walkthrough";
        $subTopics[] = "{$topic}: practice exercises";

        // Adjust based on difficulty
        if ($difficulty === 1) {
            array_unshift($subTopics, "{$subject}: prerequisites and preparation");
        } elseif ($difficulty === 3) {
            $subTopics[] = "{$subject}: advanced challenges";
        }

        return $subTopics;
    }

    /**
     * Check if a Learning Path has progress before deletion.
     */
    public function checkBeforeDelete(User $user, int $learningPathId): array
    {
        $learningPath = $user->learningPaths()->find($learningPathId);

        if (!$learningPath) {
            // Check if it's already soft-deleted
            $trashed = $user->learningPaths()->withTrashed()->find($learningPathId);
            if ($trashed) {
                return [
                    'id' => $learningPathId,
                    'subject_name' => $trashed->subject_name,
                    'has_progress' => false,
                    'already_deleted' => true,
                    'completed_sessions' => 0,
                    'completed_days' => 0,
                    'total_days' => $trashed->total_days,
                    'progress_percent' => 0,
                ];
            }

            throw new \Illuminate\Database\Eloquent\ModelNotFoundException("Learning Path not found.");
        }

        $completedCount = $learningPath->completedSessionsCount();
        $completedDays = max(0, $learningPath->current_day - 1);
        if ($learningPath->isCurrentDayComplete()) {
            $completedDays = $learningPath->current_day;
        }

        return [
            'id' => $learningPath->id,
            'subject_name' => $learningPath->subject_name,
            'has_progress' => $completedCount > 0,
            'completed_sessions' => $completedCount,
            'completed_days' => $completedDays,
            'total_days' => $learningPath->total_days,
            'progress_percent' => $learningPath->getProgressPercent(),
        ];
    }

    /**
     * Delete a Learning Path.
     */
    public function deleteLearningPath(User $user, int $learningPathId): void
    {
        $learningPath = $user->learningPaths()->find($learningPathId);

        if (!$learningPath) {
            // If already deleted, nothing to do
            Log::info('Attempted to delete Learning Path that was already gone or doesn\'t belong to user', [
                'user_id' => $user->id,
                'path_id' => $learningPathId
            ]);
            return;
        }

        $subjectName = $learningPath->subject_name;

        // Soft-delete the learning path
        $learningPath->delete();

        // Remove from user's subjects array if no other active learning paths for this subject
        $otherActive = $user->learningPaths()
            ->where('subject_name', $subjectName)
            ->where('status', 'active')
            ->exists();

        if (!$otherActive) {
            $subjects = $user->subjects ?? [];
            $subjects = array_values(array_filter($subjects, fn($s) => $s !== $subjectName));
            $user->update(['subjects' => $subjects]);
        }

        Log::info('Learning Path deleted', [
            'user_id' => $user->id,
            'id' => $learningPathId,
            'subject' => $subjectName,
        ]);
    }

    /**
     * Complete a day and advance to the next in the Learning Path.
     */
    public function completeDay(User $user, int $learningPathId, int $dayNumber): LearningPath
    {
        $learningPath = $user->learningPaths()->findOrFail($learningPathId);

        if ($dayNumber !== $learningPath->current_day) {
            throw new \Exception("Day {$dayNumber} is not the current active day. Current day is {$learningPath->current_day}.");
        }

        // After completing, try to advance
        $learningPath->advanceDay();
        $learningPath->refresh();

        return $learningPath;
    }

    /**
     * Skip the current day in the Learning Path.
     */
    public function skipDay(User $user, int $learningPathId): LearningPath
    {
        $learningPath = $user->learningPaths()->findOrFail($learningPathId);

        // Record the skip
        $learningPath->skipCurrentDay();
        $learningPath->refresh();

        return $learningPath;
    }

    /**
     * Update an existing Learning Path while preserving completed days.
     * Only regenerates curriculum for future (uncompleted) days.
     */
    public function updateLearningPath(User $user, LearningPath $learningPath, array $data): LearningPath
    {
        $startDate = Carbon::parse($data['start_date']);
        $endDate = Carbon::parse($data['end_date']);
        $newTotalDays = max(1, $startDate->diffInDays($endDate) + 1);
        $difficulty = $data['difficulty'] ?? $learningPath->difficulty;
        $sessionDurations = $user->subject_session_durations ?? [];

        // Preserve completed days (everything before current_day)
        $completedDayCount = max(0, $learningPath->current_day - 1);
        if ($learningPath->isCurrentDayComplete()) {
            $completedDayCount = $learningPath->current_day;
        }

        $oldCurriculum = $learningPath->curriculum ?? [];

        // Keep completed day curriculum intact
        $preservedCurriculum = [];
        for ($day = 1; $day <= $completedDayCount; $day++) {
            $preservedCurriculum[(string) $day] = $oldCurriculum[(string) $day] ?? [
                'topic' => "{$learningPath->subject_name} - Day {$day}",
                'level' => $this->getLevelForDay($day, $newTotalDays),
                'duration_minutes' => 60,
                'focus_level' => 'medium',
                'key_topics' => [],
                'sub_topics' => [],
                'resources' => $this->defaultResources($learningPath->subject_name, "Day {$day}"),
            ];
        }

        // Generate new curriculum for remaining days only if not provided
        $remainingDays = max(0, $newTotalDays - $completedDayCount);
        if ($remainingDays > 0) {
            $futureCurriculum = $data['curriculum'] ?? $this->generateCurriculum(
                $learningPath->subject_name,
                $remainingDays,
                $difficulty,
                $user->daily_study_hours ?? 2,
                $user->study_goal ?? 'General Study Improvement',
                true,
                $sessionDurations
            );

            // Normalize if provided directly
            if (isset($data['curriculum'])) {
                $futureCurriculum = $this->normalizeCurriculum($futureCurriculum, $remainingDays, $learningPath->subject_name, $sessionDurations);
            }

            // Re-key future curriculum to start after completed days
            foreach ($futureCurriculum as $key => $dayData) {
                $newDayNumber = $completedDayCount + (int) $key;
                $preservedCurriculum[(string) $newDayNumber] = $dayData;
            }
        }

        // Update the learning path record
        $learningPath->update([
            'start_date' => $startDate,
            'end_date' => $endDate,
            'total_days' => $newTotalDays,
            'difficulty' => $difficulty,
            'curriculum' => $preservedCurriculum,
            // Keep current_day as-is — completed progress is preserved
        ]);

        Log::info('Learning Path updated (preserved completed days)', [
            'user_id' => $user->id,
            'path_id' => $learningPath->id,
            'subject' => $learningPath->subject_name,
            'preserved_days' => $completedDayCount,
            'new_total_days' => $newTotalDays,
        ]);

        return $learningPath->fresh();
    }

    /**
     * Get all active learning paths for a user.
     */
    public function getActiveLearningPaths(User $user): array
    {
        $sessionDurations = $user->subject_session_durations ?? [];
        $paths = $user->learningPaths()
            ->where('status', 'active')
            ->orderBy('created_at', 'desc')
            ->get();

        return $paths->map(function ($path) use ($sessionDurations) {
            $days = [];
            $curriculum = $path->curriculum ?? [];

            for ($day = 1; $day <= $path->total_days; $day++) {
                $dayData = $curriculum[(string) $day] ?? null;
                $status = $path->getDayStatus($day);
                $subject = $path->subject_name;
                $duration = $dayData['duration_minutes'] ?? 60;
                $duration = $this->clampDurationForSubject($subject, (int) $duration, $sessionDurations);

                $days[] = [
                    'day_number' => $day,
                    'status' => $status,
                    'topic' => $dayData['topic'] ?? "Day {$day}",
                    'level' => $dayData['level'] ?? 'beginner',
                    'duration_minutes' => $duration,
                    'focus_level' => $dayData['focus_level'] ?? 'medium',
                    'key_topics' => $dayData['key_topics'] ?? [],
                    'sub_topics' => $dayData['sub_topics'] ?? [],
                    'resources' => $dayData['resources'] ?? [],
                ];
            }

            return [
                'id' => $path->id,
                'subject_name' => $path->subject_name,
                'start_date' => $path->start_date->toDateString(),
                'end_date' => $path->end_date->toDateString(),
                'total_days' => $path->total_days,
                'current_day' => $path->current_day,
                'status' => $path->status,
                'difficulty' => $path->difficulty,
                'progress_percent' => $path->getProgressPercent(),
                'is_behind_schedule' => $path->isBehindSchedule(),
                'completed_sessions_count' => $path->completedSessionsCount(),
                'days' => $days,
            ];
        })->toArray();
    }

    /**
     * Clamp a duration to the user's preferred min/max for a subject (default AI-driven when unset).
     */
    protected function clampDurationForSubject(string $subject, int $duration, array $sessionDurations): int
    {
        $prefs = $this->getSubjectDurationPreference($subject, $sessionDurations);

        if ($prefs) {
            $min = isset($prefs['min']) ? max(15, (int) $prefs['min']) : 15;
            // Only strictly clamp if the user provides a preference, else let it reach a logical fallback limit
            $max = isset($prefs['max']) ? max($min, (int) $prefs['max']) : max($min, 240);
        } else {
            // Allow AI full control up to 4 hours if user has no specific session duration constraints
            $min = 15;
            $max = 240;
        }

        return min($max, max($min, $duration));
    }

    /**
     * Retrieve subject duration preference case-insensitively.
     */
    protected function getSubjectDurationPreference(string $subject, array $sessionDurations): ?array
    {
        if (isset($sessionDurations[$subject])) {
            return $sessionDurations[$subject];
        }

        $lower = mb_strtolower($subject);
        foreach ($sessionDurations as $name => $prefs) {
            if (mb_strtolower($name) === $lower) {
                return $prefs;
            }
        }

        return null;
    }

    /**
     * Rebalance all future durations for all active learning paths to fit the daily study hours limit.
     */
    public function rebalanceDurationsForUser(User $user): void
    {
        $activePaths = $user->learningPaths()->where('status', 'active')->get();
        if ($activePaths->isEmpty()) {
            return;
        }

        $dailyHours = $user->daily_study_hours ?: 2;
        $sessionDurations = $user->subject_session_durations ?? [];
        $totalDailyMinutes = (int) ($dailyHours * 60);

        // --- Iterative Budget Allocation Algorithm ---
        $subjects = $activePaths->pluck('subject_name')->toArray();
        $allocation = [];
        $fixed = [];
        $subjectsPool = $subjects;
        $remainingBudget = $totalDailyMinutes;

        // Loop until all subjects are allocated OR budget is consumed
        while (!empty($subjectsPool)) {
            $fairShare = (int) ($remainingBudget / count($subjectsPool));
            $newFixedFound = false;

            foreach ($subjectsPool as $index => $subject) {
                $prefs = $this->getSubjectDurationPreference($subject, $sessionDurations);
                
                if ($prefs) {
                    // Min 15m, Max 240m (matched with validation)
                    $min = isset($prefs['min']) ? max(15, (int) $prefs['min']) : 15;
                    $max = isset($prefs['max']) ? max($min, (int) $prefs['max']) : 240;

                    if ($fairShare < $min) {
                        $allocation[$subject] = $min;
                        $fixed[] = $subject;
                        unset($subjectsPool[$index]);
                        $remainingBudget -= $min;
                        $newFixedFound = true;
                    } elseif ($fairShare > $max) {
                        $allocation[$subject] = $max;
                        $fixed[] = $subject;
                        unset($subjectsPool[$index]);
                        $remainingBudget -= $max;
                        $newFixedFound = true;
                    }
                }
            }

            // If no subjects were "fixed" in this pass, the remaining share the rest equally
            if (!$newFixedFound) {
                foreach ($subjectsPool as $subject) {
                    $allocation[$subject] = $fairShare;
                }
                break;
            }
            
            $subjectsPool = array_values($subjectsPool);
            if ($remainingBudget <= 0) break;
        }

        // Apply fallback for any remaining subjects if budget ran out
        foreach ($subjects as $subject) {
            if (!isset($allocation[$subject])) {
                $allocation[$subject] = 15; // Bare minimum safety
            }
        }

        Log::info("Budget Rebalancing for User {$user->id}", [
            'total_limit' => $totalDailyMinutes,
            'allocation' => $allocation,
            'subjects' => $subjects
        ]);

        foreach ($activePaths as $path) {
            $curriculum = $path->curriculum ?? [];
            if (empty($curriculum)) continue;
            
            $subject = $path->subject_name;
            $newDuration = $allocation[$subject] ?? 60;
            $updated = false;
            
            // Only update future days (>= current_day)
            for ($day = $path->current_day; $day <= $path->total_days; $day++) {
                $dayKey = (string)$day;
                if (!isset($curriculum[$dayKey])) continue;
                
                if ((int)($curriculum[$dayKey]['duration_minutes'] ?? 0) !== $newDuration) {
                    $curriculum[$dayKey]['duration_minutes'] = $newDuration;
                    $updated = true;
                }
            }
            
            if ($updated) {
                $path->update(['curriculum' => $curriculum]);
                Log::info("Updated path duration: {$path->id} ({$subject}) -> {$newDuration}m");
            }
        }
    }

    /**
     * Get completed learning paths for a user.
     */
    public function getCompletedLearningPaths(User $user): array
    {
        return $user->learningPaths()
            ->where('status', 'completed')
            ->orderBy('updated_at', 'desc')
            ->get()
            ->map(fn($p) => [
                'id' => $p->id,
                'subject_name' => $p->subject_name,
                'total_days' => $p->total_days,
                'completed_at' => $p->updated_at->toDateString(),
            ])
            ->toArray();
    }
}
