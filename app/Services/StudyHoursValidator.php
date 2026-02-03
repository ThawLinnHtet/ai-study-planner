<?php

namespace App\Services;

class StudyHoursValidator
{
    /**
     * Maximum sustainable focus hours by level
     */
    const MAX_HIGH_FOCUS_HOURS = 4;

    const MAX_MEDIUM_FOCUS_HOURS = 3;

    const MAX_LOW_FOCUS_HOURS = 2;

    const MAX_TOTAL_FOCUS_HOURS = 8; // Reduced from 9 to 8 for better sustainability

    const RECOMMENDED_MAX_HOURS = 6; // Recommended maximum for most users

    /**
     * Recommended daily study limits
     */
    const RECOMMENDED_MIN_HOURS = 1;

    const ABSOLUTE_MAX_HOURS = 12;

    /**
     * Validate and adjust study hours based on focus capacity
     */
    public static function validateAndAdjust(int $requestedHours, string $peakTime): array
    {
        $result = [
            'original_hours' => $requestedHours,
            'recommended_hours' => $requestedHours,
            'adjustments' => [],
            'warnings' => [],
            'session_distribution' => [],
            'is_realistic' => true,
        ];

        // Check basic limits
        if ($requestedHours < self::RECOMMENDED_MIN_HOURS) {
            $result['warnings'][] = 'Minimum recommended study time is '.self::RECOMMENDED_MIN_HOURS.' hour(s) per day';
            $result['recommended_hours'] = self::RECOMMENDED_MIN_HOURS;
            $result['adjustments'][] = "Increased from {$requestedHours} to ".self::RECOMMENDED_MIN_HOURS.' hours';
        }

        if ($requestedHours > self::ABSOLUTE_MAX_HOURS) {
            $result['warnings'][] = 'Maximum allowed study time is '.self::ABSOLUTE_MAX_HOURS.' hours per day';
            $result['recommended_hours'] = self::ABSOLUTE_MAX_HOURS;
            $result['adjustments'][] = "Reduced from {$requestedHours} to ".self::ABSOLUTE_MAX_HOURS.' hours';
            $result['is_realistic'] = false;
        }

        // Check if hours exceed recommended maximum
        if ($requestedHours > self::RECOMMENDED_MAX_HOURS) {
            $result['warnings'][] = 'Study time exceeds recommended maximum of '.self::RECOMMENDED_MAX_HOURS.' hours. Consider breaking into multiple sessions.';
            $result['adjustments'][] = "Reduced from {$requestedHours} to ".self::RECOMMENDED_MAX_HOURS.' hours for optimal learning';
            $result['recommended_hours'] = self::RECOMMENDED_MAX_HOURS;
            $result['is_realistic'] = false;
        }

        // Check focus capacity
        if ($result['recommended_hours'] > self::MAX_TOTAL_FOCUS_HOURS) {
            $result['warnings'][] = 'Requested hours exceed realistic focus capacity. Including mandatory breaks.';
            $result['adjustments'][] = 'Reduced to '.self::MAX_TOTAL_FOCUS_HOURS.' hours with mandatory breaks';
            $result['recommended_hours'] = self::MAX_TOTAL_FOCUS_HOURS;
            $result['is_realistic'] = false;
        }

        // Generate optimal session distribution
        $result['session_distribution'] = self::generateSessionDistribution(
            $result['recommended_hours'],
            $peakTime
        );

        return $result;
    }

    /**
     * Generate optimal session distribution based on focus capacity
     */
    private static function generateSessionDistribution(int $hours, string $peakTime): array
    {
        $distribution = [
            'high_focus' => ['hours' => 0, 'sessions' => [], 'timing' => $peakTime],
            'medium_focus' => ['hours' => 0, 'sessions' => [], 'timing' => 'flexible'],
            'low_focus' => ['hours' => 0, 'sessions' => [], 'timing' => 'flexible'],
            'breaks' => ['hours' => 0, 'sessions' => []],
            'total_hours' => $hours,
        ];

        $remainingHours = $hours;

        // Allocate high-focus sessions during peak time
        $highFocusHours = min(self::MAX_HIGH_FOCUS_HOURS, $remainingHours);
        $distribution['high_focus']['hours'] = $highFocusHours;
        $remainingHours -= $highFocusHours;

        // Allocate medium-focus sessions
        $mediumFocusHours = min(self::MAX_MEDIUM_FOCUS_HOURS, $remainingHours);
        $distribution['medium_focus']['hours'] = $mediumFocusHours;
        $remainingHours -= $mediumFocusHours;

        // Allocate low-focus sessions
        $lowFocusHours = min(self::MAX_LOW_FOCUS_HOURS, $remainingHours);
        $distribution['low_focus']['hours'] = $lowFocusHours;
        $remainingHours -= $lowFocusHours;

        // Remaining hours become breaks
        $distribution['breaks']['hours'] = $remainingHours;

        // Generate specific sessions
        $distribution['high_focus']['sessions'] = self::generateSessions(
            $highFocusHours,
            'high',
            $peakTime
        );

        $distribution['medium_focus']['sessions'] = self::generateSessions(
            $mediumFocusHours,
            'medium',
            'flexible'
        );

        $distribution['low_focus']['sessions'] = self::generateSessions(
            $lowFocusHours,
            'low',
            'flexible'
        );

        return $distribution;
    }

    /**
     * Generate specific session recommendations
     */
    private static function generateSessions(float $hours, string $focusLevel, string $timing): array
    {
        $sessions = [];

        if ($hours <= 0) {
            return $sessions;
        }

        // Break into manageable chunks (30-90 minutes each)
        $sessionDuration = $focusLevel === 'high' ? 60 : ($focusLevel === 'medium' ? 45 : 30);
        $numberOfSessions = max(1, min(4, $hours / ($sessionDuration / 60)));

        for ($i = 0; $i < $numberOfSessions; $i++) {
            $sessions[] = [
                'duration_minutes' => $sessionDuration,
                'focus_level' => $focusLevel,
                'optimal_timing' => $timing,
                'description' => self::getSessionDescription($focusLevel, $timing, $i + 1),
            ];
        }

        return $sessions;
    }

    /**
     * Get session description based on focus level and timing
     */
    private static function getSessionDescription(string $focusLevel, string $timing, int $sessionNumber): string
    {
        $descriptions = [
            'high' => [
                'morning' => ['Challenging concepts', 'Problem-solving', 'New topics'],
                'afternoon' => ['Complex exercises', 'Deep work', 'Advanced topics'],
                'night' => ['Focused study', 'Difficult material', 'Intensive learning'],
                'flexible' => ['High-focus work', 'Challenging content', 'Deep learning'],
            ],
            'medium' => [
                'morning' => ['Regular study', 'Practice exercises', 'Review notes'],
                'afternoon' => ['Standard topics', 'Application exercises', 'Mixed activities'],
                'night' => ['Moderate study', 'Practice problems', 'Review material'],
                'flexible' => ['Balanced study', 'Mixed activities', 'Regular learning'],
            ],
            'low' => [
                'morning' => ['Light review', 'Easy topics', 'Quick refresh'],
                'afternoon' => ['Casual study', 'Simple exercises', 'Light reading'],
                'night' => ['Relaxed review', 'Easy material', 'Wind-down study'],
                'flexible' => ['Light activities', 'Review sessions', 'Casual learning'],
            ],
        ];

        $options = $descriptions[$focusLevel][$timing] ?? $descriptions[$focusLevel]['flexible'];
        $index = ($sessionNumber - 1) % count($options);

        return $options[$index];
    }

    /**
     * Get user-friendly recommendations
     */
    public static function getRecommendations(int $requestedHours, string $peakTime): array
    {
        $validation = self::validateAndAdjust($requestedHours, $peakTime);

        $recommendations = [
            'status' => $validation['is_realistic'] ? 'good' : 'warning',
            'message' => '',
            'tips' => [],
        ];

        if (! $validation['is_realistic']) {
            $recommendations['message'] = 'Your requested study time may be too ambitious. Consider our recommendations for better learning outcomes.';
        } else {
            $recommendations['message'] = 'Your study schedule looks balanced and achievable!';
        }

        // Add specific tips based on hours
        if ($requestedHours > 8) {
            $recommendations['tips'][] = 'Consider breaking your study time into morning and evening sessions';
            $recommendations['tips'][] = 'Include 15-minute breaks every 90 minutes';
        }

        if ($requestedHours > self::MAX_TOTAL_FOCUS_HOURS) {
            $recommendations['tips'][] = 'Schedule regular breaks to maintain focus quality';
            $recommendations['tips'][] = 'Mix high-focus and low-focus activities throughout the day';
        }

        if ($peakTime === 'night' && $requestedHours > 6) {
            $recommendations['tips'][] = 'Night studying works best for 4-6 hours maximum';
            $recommendations['tips'][] = 'Save challenging topics for your peak focus time';
        }

        return $recommendations;
    }
}
