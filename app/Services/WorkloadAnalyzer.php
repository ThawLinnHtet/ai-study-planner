<?php

namespace App\Services;

use Carbon\Carbon;
use Illuminate\Support\Collection;

class WorkloadAnalyzer
{
    /**
     * Standard hours required for a "Normal" difficulty subject for a 30-day curriculum.
     * This is a heuristic for validation.
     */
    const BASE_HOURS_PER_SUBJECT_MONTH = 15;

    /**
     * Minimum days required to generate a meaningful AI curriculum.
     */
    const MIN_DAYS_PER_SUBJECT = 7;

    /**
     * Maximum days allowed for a single subject plan (1 year).
     */
    const MAX_DAYS_PER_SUBJECT = 365;

    /**
     * Analyze if the requested study workload is realistic.
     * 
     * @param int $dailyHours
     * @param array $subjects
     * @param array $difficulties Map of subject => 1(Easy), 2(Medium), 3(Hard)
     * @param array $startDates Map of subject => Y-m-d
     * @param array $endDates Map of subject => Y-m-d
     * @return array
     */
    public function analyze(int $dailyHours, array $subjects, array $difficulties, array $startDates, array $endDates): array
    {
        $analysis = [
            'is_realistic' => true,
            'has_duration_error' => false,
            'overload_percentage' => 0,
            'total_capacity_hours' => 0,
            'total_required_hours' => 0,
            'warnings' => [],
            'recommendations' => [],
        ];

        if (empty($subjects)) {
            return $analysis;
        }

        $totalCapacity = 0;
        $totalRequired = 0;
        
        $shortSubjects = [];
        $longSubjects = [];

        foreach ($subjects as $subject) {
            $start = isset($startDates[$subject]) ? Carbon::parse($startDates[$subject]) : Carbon::today();
            $end = isset($endDates[$subject]) ? Carbon::parse($endDates[$subject]) : Carbon::today()->addDays(30);
            
            $days = $start->diffInDays($end) + 1;
            
            if ($days < self::MIN_DAYS_PER_SUBJECT) {
                $shortSubjects[] = $subject;
            }
            
            if ($days > self::MAX_DAYS_PER_SUBJECT) {
                $longSubjects[] = $subject;
            }

            $days = max(1, $days); // Minimum 1 day for calculation safety
            $capacity = $days * $dailyHours;
            $totalCapacity += $capacity;

            // Required hours based on difficulty
            $difficulty = $difficulties[$subject] ?? 2;
            $multiplier = $difficulty === 3 ? 1.5 : ($difficulty === 1 ? 0.7 : 1.0);
            
            // Standardizing to a 30-day "base"
            $required = ($days / 30) * self::BASE_HOURS_PER_SUBJECT_MONTH * $multiplier;
            $totalRequired += $required;
        }

        // Add grouped warnings for duration issues
        if (!empty($shortSubjects)) {
            $analysis['is_realistic'] = false;
            $analysis['has_duration_error'] = true;
            $subjectList = "'" . implode("', '", $shortSubjects) . "'";
            $analysis['warnings'][] = "The study period for {$subjectList} is too short. We recommend at least 7 days for a meaningful curriculum.";
        }

        if (!empty($longSubjects)) {
            $analysis['is_realistic'] = false;
            $analysis['has_duration_error'] = true;
            $subjectList = "'" . implode("', '", $longSubjects) . "'";
            $analysis['warnings'][] = "The time planned for {$subjectList} spans more than a year. Try breaking these down into smaller 3-6 month milestones!";
        }

        // Calculate overall capacity using the full date range
        $allStart = collect($startDates)->map(fn($d) => Carbon::parse($d))->min() ?: Carbon::today();
        $allEnd = collect($endDates)->map(fn($d) => Carbon::parse($d))->max() ?: Carbon::today()->addDays(30);
        
        $totalDays = $allStart->diffInDays($allEnd) + 1;
        $actualTotalCapacity = $totalDays * $dailyHours;

        $analysis['total_capacity_hours'] = $actualTotalCapacity;
        $analysis['total_required_hours'] = $totalRequired;

        if ($actualTotalCapacity > 0) {
            $ratio = $totalRequired / $actualTotalCapacity;
            $analysis['overload_percentage'] = round(($ratio - 1) * 100);
            
            if ($ratio > 1.25) {
                $analysis['is_realistic'] = false;
                $analysis['warnings'][] = "This schedule looks quite intense! You're currently planning for more material than your daily hours comfortably allow.";
                $analysis['recommendations'][] = "Try adding 30-60 minutes to your daily study time.";
                $analysis['recommendations'][] = "Extend your end dates by a week or more to give your brain room to breathe.";
            } elseif ($ratio > 1.0) {
                $analysis['warnings'][] = "Your schedule is in 'High Efficiency' mode—it's doable, but you'll need to stay disciplined!";
            }
        }
        
        $analysis['warnings'] = array_unique($analysis['warnings']);

        return $analysis;
    }
}
