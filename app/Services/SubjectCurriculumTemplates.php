<?php

namespace App\Services;

class SubjectCurriculumTemplates
{
    /**
     * Get subject-specific topic templates for fallback curriculum generation.
     */
    public static function getTopicsForSubject(string $subject): array
    {
        $subjectLower = strtolower($subject);
        
        // Mathematics subjects
        if (str_contains($subjectLower, 'math') || str_contains($subjectLower, 'algebra') || 
            str_contains($subjectLower, 'calculus') || str_contains($subjectLower, 'geometry') || 
            str_contains($subjectLower, 'statistics') || str_contains($subjectLower, 'trigonometry')) {
            
            return [
                'beginner' => [
                    "Number Systems and Basic Operations",
                    "Introduction to Algebraic Expressions",
                    "Linear Equations and Inequalities",
                    "Functions and Their Graphs",
                    "Basic Geometric Concepts",
                    "Introduction to Probability",
                    "Problem-Solving Strategies",
                    "Ratios, Proportions, and Percentages",
                    "Order of Operations and Simplification",
                    "Coordinate Plane and Plotting Points",
                    "Fractions and Decimals Mastery",
                    "Absolute Value and Number Line",
                    "Patterns and Sequences Introduction",
                    "Word Problems and Real-World Math",
                ],
                'intermediate' => [
                    "Quadratic Equations and Functions",
                    "Systems of Equations",
                    "Polynomials and Factoring",
                    "Trigonometric Functions",
                    "Exponential and Logarithmic Functions",
                    "Sequences and Series",
                    "Statistical Analysis Methods",
                    "Matrices and Determinants",
                    "Conic Sections (Circles, Ellipses, Parabolas)",
                    "Rational Expressions and Equations",
                    "Vectors and Vector Operations",
                    "Combinatorics and Counting Principles",
                    "Data Visualization and Interpretation",
                    "Mathematical Induction and Proofs",
                ],
                'advanced' => [
                    "Calculus: Limits and Derivatives",
                    "Integration Techniques",
                    "Advanced Geometry Proofs",
                    "Complex Numbers",
                    "Differential Equations",
                    "Advanced Probability Theory",
                    "Mathematical Modeling Applications",
                    "Multivariable Calculus",
                    "Linear Algebra and Transformations",
                    "Fourier Series and Transforms",
                    "Numerical Methods and Approximation",
                    "Optimization and Linear Programming",
                    "Topology and Abstract Algebra Intro",
                    "Real Analysis Foundations",
                ]
            ];
        }
        
        // Programming subjects
        if (str_contains($subjectLower, 'program') || str_contains($subjectLower, 'code') || 
            str_contains($subjectLower, 'javascript') || str_contains($subjectLower, 'typescript') || 
            str_contains($subjectLower, 'python') || str_contains($subjectLower, 'java') || 
            str_contains($subjectLower, ' php') || str_contains($subjectLower, 'cpp') || 
            str_contains($subjectLower, 'golang') || str_contains($subjectLower, ' rust') || 
            str_contains($subjectLower, 'ruby') || str_contains($subjectLower, ' swift') || 
            str_contains($subjectLower, 'web') || str_contains($subjectLower, 'development')) {
            
            return [
                'beginner' => [
                    "Introduction to Programming Concepts",
                    "Variables and Data Types",
                    "Control Structures (if/else, loops)",
                    "Functions and Methods",
                    "Basic Data Structures (arrays, objects)",
                    "Debugging Basics",
                    "Simple Project Implementation",
                    "String Manipulation and Formatting",
                    "Input/Output and User Interaction",
                    "Boolean Logic and Comparisons",
                    "Scope and Variable Lifetime",
                    "Basic Algorithms (sorting, searching)",
                    "Code Organization and Readability",
                    "Working with Libraries and Packages",
                ],
                'intermediate' => [
                    "Object-Oriented Programming",
                    "Error Handling and Exceptions",
                    "File I/O Operations",
                    "Database Integration",
                    "API Development Basics",
                    "Testing Fundamentals",
                    "Version Control with Git",
                    "Regular Expressions and Text Processing",
                    "Recursion and Dynamic Programming",
                    "Data Serialization (JSON, XML)",
                    "Authentication and Authorization",
                    "Asynchronous Programming",
                    "Memory Management and References",
                    "Build Tools and Task Runners",
                ],
                'advanced' => [
                    "Design Patterns and Architecture",
                    "Performance Optimization",
                    "Security Best Practices",
                    "Microservices and Distributed Systems",
                    "Machine Learning Integration",
                    "Cloud Deployment",
                    "Advanced Project Management",
                    "Concurrency and Parallelism",
                    "System Design and Scalability",
                    "CI/CD Pipelines and DevOps",
                    "GraphQL and Advanced APIs",
                    "Containerization with Docker",
                    "Real-Time Applications (WebSockets)",
                    "Open Source Contribution and Code Review",
                ]
            ];
        }
        
        // Science subjects
        if (str_contains($subjectLower, 'science') || str_contains($subjectLower, 'physics') || 
            str_contains($subjectLower, 'chemistry') || str_contains($subjectLower, 'biology') || 
            str_contains($subjectLower, 'laboratory') || str_contains($subjectLower, 'experiment')) {
            
            return [
                'beginner' => [
                    "Scientific Method and Inquiry",
                    "Basic Laboratory Safety",
                    "Fundamental Concepts and Terminology",
                    "Measurement and Data Collection",
                    "Observation and Recording Skills",
                    "Basic Experimental Design",
                    "Scientific Communication",
                    "Units, Conversions, and Dimensional Analysis",
                    "Introduction to the Periodic Table",
                    "Forces and Motion Basics",
                    "Cell Structure and Function",
                    "States of Matter and Phase Changes",
                    "Energy Forms and Conservation",
                    "Ecosystems and Food Chains",
                ],
                'intermediate' => [
                    "Advanced Laboratory Techniques",
                    "Data Analysis and Interpretation",
                    "Hypothesis Testing",
                    "Scientific Modeling",
                    "Research Methodology",
                    "Literature Review Skills",
                    "Experimental Controls and Variables",
                    "Chemical Reactions and Stoichiometry",
                    "Genetics and Heredity",
                    "Waves, Sound, and Light",
                    "Thermodynamics Principles",
                    "Organic Chemistry Basics",
                    "Human Anatomy and Physiology",
                    "Electricity and Magnetism",
                ],
                'advanced' => [
                    "Advanced Research Design",
                    "Statistical Analysis in Science",
                    "Scientific Publication",
                    "Peer Review Process",
                    "Independent Research Projects",
                    "Science Ethics and Integrity",
                    "Cutting-Edge Developments",
                    "Quantum Mechanics Introduction",
                    "Molecular Biology and Biotechnology",
                    "Astrophysics and Cosmology",
                    "Environmental Science and Climate",
                    "Nuclear Physics and Radioactivity",
                    "Neuroscience Fundamentals",
                    "Nanotechnology and Materials Science",
                ]
            ];
        }
        
        // Language subjects
        if (str_contains($subjectLower, 'language') || str_contains($subjectLower, 'english') || 
            str_contains($subjectLower, 'writing') || str_contains($subjectLower, 'literature') || 
            str_contains($subjectLower, 'grammar') || str_contains($subjectLower, 'communication')) {
            
            return [
                'beginner' => [
                    "Basic Vocabulary and Phrases",
                    "Grammar Fundamentals",
                    "Sentence Structure",
                    "Reading Comprehension Basics",
                    "Writing Simple Paragraphs",
                    "Listening and Speaking Practice",
                    "Cultural Context Introduction",
                    "Parts of Speech (Nouns, Verbs, Adjectives)",
                    "Punctuation and Capitalization Rules",
                    "Common Idioms and Expressions",
                    "Tenses: Past, Present, and Future",
                    "Descriptive Writing Techniques",
                    "Active vs Passive Voice",
                    "Everyday Conversation Practice",
                ],
                'intermediate' => [
                    "Complex Sentence Structures",
                    "Essay Writing Techniques",
                    "Literary Analysis Basics",
                    "Advanced Vocabulary",
                    "Public Speaking Skills",
                    "Critical Reading",
                    "Writing for Different Audiences",
                    "Narrative and Storytelling Techniques",
                    "Debate and Argumentation",
                    "Poetry Analysis and Interpretation",
                    "Formal vs Informal Register",
                    "Research Skills and Citations",
                    "Comparative Literature",
                    "Media Literacy and Analysis",
                ],
                'advanced' => [
                    "Advanced Literary Analysis",
                    "Creative Writing Techniques",
                    "Research and Academic Writing",
                    "Rhetoric and Persuasion",
                    "Professional Communication",
                    "Literary Theory and Criticism",
                    "Publishing and Presentation",
                    "Sociolinguistics and Language Variation",
                    "Translation and Interpretation",
                    "Screenwriting and Script Analysis",
                    "Discourse Analysis",
                    "Grant and Proposal Writing",
                    "Editing and Proofreading Mastery",
                    "Portfolio Development and Showcase",
                ]
            ];
        }
        
        // Business subjects
        if (str_contains($subjectLower, 'business') || str_contains($subjectLower, 'economics') || 
            str_contains($subjectLower, 'finance') || str_contains($subjectLower, 'marketing') || 
            str_contains($subjectLower, 'management') || str_contains($subjectLower, 'accounting')) {
            
            return [
                'beginner' => [
                    "Business Fundamentals and Concepts",
                    "Basic Economic Principles",
                    "Introduction to Financial Statements",
                    "Marketing Basics",
                    "Management Principles",
                    "Business Ethics",
                    "Entrepreneurship Overview",
                    "Supply and Demand Dynamics",
                    "Bookkeeping and Basic Accounting",
                    "Customer Relationship Management",
                    "Business Communication Skills",
                    "Introduction to E-Commerce",
                    "Time Management for Professionals",
                    "SWOT Analysis and Business Planning",
                ],
                'intermediate' => [
                    "Financial Analysis and Planning",
                    "Market Research and Analysis",
                    "Strategic Management",
                    "Operations Management",
                    "Business Law and Regulations",
                    "International Business",
                    "Project Management",
                    "Digital Marketing and SEO",
                    "Human Resource Management",
                    "Cost Accounting and Budgeting",
                    "Negotiation and Conflict Resolution",
                    "Brand Strategy and Positioning",
                    "Business Process Improvement",
                    "Investment and Portfolio Basics",
                ],
                'advanced' => [
                    "Advanced Financial Modeling",
                    "Global Economics and Trade",
                    "Corporate Strategy",
                    "Risk Management",
                    "Business Analytics",
                    "Mergers and Acquisitions",
                    "Leadership Development",
                    "Venture Capital and Fundraising",
                    "Supply Chain Optimization",
                    "Corporate Governance",
                    "Behavioral Economics",
                    "Crisis Management and Recovery",
                    "Sustainability and CSR Strategy",
                    "Executive Decision-Making Frameworks",
                ]
            ];
        }
        
        // Default topics (for subjects not matching above) — include subject name for uniqueness
        return [
            'beginner' => [
                "Introduction to {$subject}",
                "{$subject}: Core Concepts and Terminology",
                "{$subject}: Basic Principles and Theory",
                "{$subject}: Fundamental Skills Development",
                "{$subject}: Historical Context and Background",
                "{$subject}: Essential Tools and Resources",
                "{$subject}: Practical Applications Overview",
                "{$subject}: Key Vocabulary and Definitions",
                "{$subject}: Foundational Techniques",
                "{$subject}: Beginner Exercises and Drills",
                "{$subject}: Common Misconceptions",
                "{$subject}: Study Methods and Note-Taking",
                "{$subject}: Real-World Examples",
                "{$subject}: Review and Self-Assessment",
            ],
            'intermediate' => [
                "{$subject}: Advanced Concepts and Theory",
                "{$subject}: Applied Problem Solving",
                "{$subject}: Complex Skill Development",
                "{$subject}: Integration with Other Fields",
                "{$subject}: Case Studies and Analysis",
                "{$subject}: Best Practices and Standards",
                "{$subject}: Project-Based Learning",
                "{$subject}: Critical Thinking Applications",
                "{$subject}: Comparative Analysis",
                "{$subject}: Collaborative Learning",
                "{$subject}: Research and Investigation",
                "{$subject}: Practical Workshops",
                "{$subject}: Intermediate Assessment",
                "{$subject}: Connecting Theory to Practice",
            ],
            'advanced' => [
                "{$subject}: Expert-Level Techniques",
                "{$subject}: Specialized Topics and Research",
                "{$subject}: Professional Applications",
                "{$subject}: Innovation and Development",
                "{$subject}: Industry Trends and Future Directions",
                "{$subject}: Advanced Project Work",
                "{$subject}: Mastery and Specialization",
                "{$subject}: Leadership in the Field",
                "{$subject}: Peer Teaching and Mentoring",
                "{$subject}: Portfolio and Capstone Project",
                "{$subject}: Ethics and Responsibility",
                "{$subject}: Cross-Disciplinary Applications",
                "{$subject}: Independent Research",
                "{$subject}: Final Review and Certification Prep",
            ]
        ];
    }
}
