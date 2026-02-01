<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Subject;

class SubjectSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Essential professional subjects for key fields and roles
        $subjects = [
            // Technology & Engineering
            'Artificial Intelligence',
            'Data Science',
            'Cybersecurity',
            'Software Engineering',
            'Web Development',
            'Mobile Development',
            'UI/UX Design',
            'Cloud Computing',
            'DevOps',
            
            // Business & Finance
            'Business Administration',
            'Financial Analysis',
            'Marketing',
            'Accounting',
            'Project Management',
            'Digital Marketing',
            'Supply Chain Management',
            'Human Resources',
            
            // Healthcare & Medicine
            'Medicine',
            'Nursing',
            'Public Health',
            'Biotechnology',
            'Healthcare Administration',
            
            // Education & Academia
            'Education Leadership',
            'Curriculum Development',
            'Educational Technology',
            'Higher Education',
            
            // Law & Legal Studies
            'Corporate Law',
            'International Law',
            'Legal Studies',
            'Compliance',
            
            // Creative Arts & Design
            'Graphic Design',
            'Fashion Design',
            'Interior Design',
            'Animation',
            'Film Production',
            'Creative Writing',
            'Journalism',
            
            // Sciences & Research
            'Physics',
            'Chemistry',
            'Biology',
            'Environmental Science',
            'Mathematics',
            'Statistics',
            
            // Social Sciences
            'Psychology',
            'Sociology',
            'Political Science',
            'Economics',
            
            // Professional Development
            'Leadership Development',
            'Career Development',
            'Public Speaking',
            'Negotiation Skills',
            
            // Advanced Technologies
            'Machine Learning',
            'Blockchain',
            'Robotics',
            'Augmented Reality',
            'Virtual Reality',
            
            // Industry-Specific
            'Hospitality Management',
            'Sports Management',
            'Event Management',
            'Government Administration'
        ];

        // Clear existing subjects
        Subject::query()->delete();

        // Seed simple subjects
        foreach ($subjects as $subject) {
            Subject::create([
                'name' => $subject,
            ]);
        }

        $this->command->info('Simple subjects seeded successfully!');
    }
}
