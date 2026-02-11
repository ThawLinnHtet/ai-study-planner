import { Head, router, usePage } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import { ArrowLeft, BookOpen, CheckCircle2, ChevronRight, RotateCcw, XCircle, Sparkles, Target, Timer, Lock, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

// Add custom styles for animations
const customStyles = `
@keyframes fadeIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
}

@keyframes slideIn {
    from { opacity: 0; transform: translateX(-20px); }
    to { opacity: 1; transform: translateX(0); }
}

@keyframes scaleIn {
    from { opacity: 0; transform: scale(0.9); }
    to { opacity: 1; transform: scale(1); }
}

@keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
}

.animate-fadeIn {
    animation: fadeIn 0.6s ease-out;
}

.animate-slideIn {
    animation: slideIn 0.4s ease-out;
}

.animate-scaleIn {
    animation: scaleIn 0.3s ease-out;
}

.animate-shimmer {
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
    background-size: 200% 100%;
    animation: shimmer 2s infinite;
}
`;

interface QuizQuestion {
    question: string;
    options: (string | { label: string; text: string })[];
}

interface QuizData {
    quiz_id: number;
    title: string;
    total_questions: number;
    questions: QuizQuestion[];
    pass_percentage: number;
}

interface QuizResult {
    result_id: number;
    passed: boolean;
    percentage: number;
    correct_count: number;
    incorrect_count: number;
    skipped_count: number;
    total_questions: number;
    review: Array<{
        question: string;
        options: string[];
        correct_answer: string;
        explanation: string;
        user_answer: string | null;
        is_correct: boolean;
    }>;
}

type QuizPhase = 'loading' | 'quiz' | 'submitting' | 'result' | 'review' | 'attempt_limit_reached';

interface Props {
    subject: string;
    topic?: string;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Study Planner', href: '/study-planner' },
    { title: 'Quiz Practice', href: '#' },
];

export default function QuizPracticePage({ subject, topic }: Props) {
    const { props: pageProps } = usePage();

    // Inject custom styles
    useEffect(() => {
        const styleElement = document.createElement('style');
        styleElement.textContent = customStyles;
        document.head.appendChild(styleElement);

        return () => {
            document.head.removeChild(styleElement);
        };
    }, []);

    const [phase, setPhase] = useState<QuizPhase>('loading');
    const [quiz, setQuiz] = useState<QuizData | null>(null);
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [answers, setAnswers] = useState<(string | null)[]>([]);
    const [result, setResult] = useState<QuizResult | null>(null);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);

    // Phase 1: Attempt Tracking
    const MAX_ATTEMPTS = 3;
    const [attempts, setAttempts] = useState(0);
    const [attemptHistory, setAttemptHistory] = useState<Array<{ percentage: number; timestamp: number }>>([]);

    // Question Timer Enhancement - Now Total Quiz Timer
    const [timeRemaining, setTimeRemaining] = useState(600); // 10 minutes total (600 seconds)
    const [totalTime, setTotalTime] = useState(0); // Time elapsed
    const [quizStartTime, setQuizStartTime] = useState(Date.now());
    const TOTAL_QUIZ_TIME = 600; // 10 minutes total for 10 questions

    // Anti-Cheat Detection System
    const [tabSwitches, setTabSwitches] = useState(0);
    const [suspiciousActivity, setSuspiciousActivity] = useState<Array<{
        type: string;
        timestamp: number;
        question?: number;
        details?: any;
    }>>([]);
    const [answerTimes, setAnswerTimes] = useState<number[]>([]);
    const [mouseMovements, setMouseMovements] = useState<Array<{ x: number; y: number; timestamp: number }>>([]);

    // Load attempt history from localStorage
    useEffect(() => {
        const attemptKey = `quiz_attempts_${subject}_${topic}`;
        const savedAttempts = localStorage.getItem(attemptKey);
        if (savedAttempts) {
            const history = JSON.parse(savedAttempts);
            setAttemptHistory(history);
            setAttempts(history.length);

            // Phase 2: Check if cooldown has expired
            if (history.length >= MAX_ATTEMPTS) {
                const lastAttempt = history[history.length - 1];
                const hoursSinceLastAttempt = (Date.now() - lastAttempt.timestamp) / (1000 * 60 * 60);
                if (hoursSinceLastAttempt >= 24) {
                    resetAttemptsAfterCooldown();
                }
            }
        }
    }, [subject, topic]);

    // Question Timer Enhancement: Total Quiz Timer Management
    useEffect(() => {
        if (phase === 'quiz' && quiz) {
            const timer = setInterval(() => {
                setTimeRemaining(prev => {
                    if (prev <= 1) {
                        // Time's up - auto-submit entire quiz
                        submitQuiz();
                        return 0;
                    }
                    return prev - 1;
                });
                setTotalTime(prev => prev + 1);
            }, 1000);

            return () => clearInterval(timer);
        }
    }, [phase]);

    // Initialize quiz timer when quiz starts
    useEffect(() => {
        if (phase === 'quiz') {
            setQuizStartTime(Date.now());
            setTimeRemaining(TOTAL_QUIZ_TIME);
            setTotalTime(0);
        }
    }, [phase]);

    // Anti-Cheat Detection: Tab Switching
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden && phase === 'quiz') {
                setTabSwitches(prev => prev + 1);
                setSuspiciousActivity(prev => [...prev, {
                    type: 'tab_switch',
                    timestamp: Date.now(),
                    question: currentQuestion
                }]);

                // Warn user after multiple switches
                if (tabSwitches >= 2) {
                    alert('⚠️ Warning: Multiple tab switches detected! This may affect your score validity.');
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [phase, currentQuestion, tabSwitches]);

    // Anti-Cheat Detection: Copy/Paste Prevention
    useEffect(() => {
        if (phase !== 'quiz') return;

        const handleCopy = (e: ClipboardEvent) => {
            e.preventDefault();
            setSuspiciousActivity(prev => [...prev, {
                type: 'copy_attempt',
                question: currentQuestion,
                timestamp: Date.now()
            }]);
            alert('🚫 Copy is not allowed during quiz!');
        };

        const handlePaste = (e: ClipboardEvent) => {
            e.preventDefault();
            setSuspiciousActivity(prev => [...prev, {
                type: 'paste_attempt',
                question: currentQuestion,
                timestamp: Date.now()
            }]);
            alert('🚫 Paste is not allowed during quiz!');
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            // Detect suspicious shortcuts
            if (e.ctrlKey && (e.key === 'c' || e.key === 'v' || e.key === 'p' || e.key === 'a')) {
                e.preventDefault();
                setSuspiciousActivity(prev => [...prev, {
                    type: 'shortcut_attempt',
                    key: e.key,
                    question: currentQuestion,
                    timestamp: Date.now()
                }]);
            }
        };

        document.addEventListener('copy', handleCopy);
        document.addEventListener('paste', handlePaste);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('copy', handleCopy);
            document.removeEventListener('paste', handlePaste);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [phase, currentQuestion]);

    // Anti-Cheat Detection: Mouse Movement Tracking
    useEffect(() => {
        if (phase !== 'quiz') return;

        const handleMouseMove = (e: MouseEvent) => {
            setMouseMovements(prev => [...prev.slice(-100), { // Keep last 100 movements
                x: e.clientX,
                y: e.clientY,
                timestamp: Date.now()
            }]);
        };

        document.addEventListener('mousemove', handleMouseMove);
        return () => document.removeEventListener('mousemove', handleMouseMove);
    }, [phase]);

    const handleTimeUp = () => {
        // Save empty answer for time-up question
        const newAnswers = [...answers];
        newAnswers[currentQuestion] = null; // Mark as unanswered (time up)
        setAnswers(newAnswers);

        // Move to next question or submit if last question
        if (currentQuestion < quiz!.total_questions - 1) {
            setCurrentQuestion(prev => prev + 1);
        } else {
            submitQuiz();
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const getTimerColor = () => {
        if (timeRemaining > 300) return 'text-green-600'; // > 5 minutes
        if (timeRemaining > 120) return 'text-yellow-600'; // > 2 minutes
        return 'text-red-600'; // < 2 minutes
    };

    // Helper function to extract option text
    const getOptionText = (option: string | { label: string; text: string }): string => {
        if (typeof option === 'string') return option;
        return option.text || option.label || String(option);
    };

    // Helper function to extract option label (A, B, C, D)
    const getOptionLabel = (option: string | { label: string; text: string }): string => {
        if (typeof option === 'string') return option;
        return option.label || String(option);
    };

    // Phase 1: Attempt Management Functions
    const saveAttempt = (percentage: number) => {
        const attemptKey = `quiz_attempts_${subject}_${topic}`;
        const newAttempt = { percentage, timestamp: Date.now() };
        const updatedHistory = [...attemptHistory, newAttempt];

        setAttemptHistory(updatedHistory);
        setAttempts(updatedHistory.length);
        localStorage.setItem(attemptKey, JSON.stringify(updatedHistory));
    };

    const canAttemptQuiz = () => {
        // Phase 2: Check both attempt limit and cooldown
        if (attempts >= MAX_ATTEMPTS) {
            // Check if 24 hours have passed since last attempt
            if (attemptHistory.length > 0) {
                const lastAttempt = attemptHistory[attemptHistory.length - 1];
                const hoursSinceLastAttempt = (Date.now() - lastAttempt.timestamp) / (1000 * 60 * 60);
                if (hoursSinceLastAttempt >= 24) {
                    // Phase 2: Auto-reset attempts after 24-hour cooldown
                    resetAttemptsAfterCooldown();
                    return true; // Cooldown expired, allow retry
                }
            }
            return false; // Still in cooldown or max attempts
        }
        return true; // Attempts available
    };

    const getCooldownStatus = () => {
        if (attempts < MAX_ATTEMPTS) return null;

        if (attemptHistory.length > 0) {
            const lastAttempt = attemptHistory[attemptHistory.length - 1];
            const hoursSinceLastAttempt = (Date.now() - lastAttempt.timestamp) / (1000 * 60 * 60);
            const hoursRemaining = Math.max(0, 24 - hoursSinceLastAttempt);

            if (hoursRemaining > 0) {
                return {
                    inCooldown: true,
                    hoursRemaining: Math.ceil(hoursRemaining),
                    canRetry: false
                };
            }
        }

        return { inCooldown: false, canRetry: true };
    };

    // Phase 2: Auto-reset attempts after cooldown
    const resetAttemptsAfterCooldown = () => {
        const attemptKey = `quiz_attempts_${subject}_${topic}`;
        localStorage.removeItem(attemptKey);
        setAttemptHistory([]);
        setAttempts(0);
        console.log('✅ Attempts reset after 24-hour cooldown');
    };

    // Phase 2: Debug function to test cooldown (remove in production)
    const testCooldown = () => {
        console.log('🧪 Testing 24-hour cooldown...');
        console.log('Current attempts:', attempts);
        console.log('Attempt history:', attemptHistory);

        if (attemptHistory.length > 0) {
            const lastAttempt = attemptHistory[attemptHistory.length - 1];
            const hoursSinceLastAttempt = (Date.now() - lastAttempt.timestamp) / (1000 * 60 * 60);
            console.log('Hours since last attempt:', hoursSinceLastAttempt);
            console.log('Can attempt quiz:', canAttemptQuiz());

            const cooldownStatus = getCooldownStatus();
            console.log('Cooldown status:', cooldownStatus);
        }
    };

    const getAttemptStatus = () => {
        const cooldownStatus = getCooldownStatus();

        if (cooldownStatus?.inCooldown) {
            return {
                canAttempt: false,
                message: `Cooldown: ${cooldownStatus.hoursRemaining} hours remaining`
            };
        }

        if (attempts === 0) return { canAttempt: true, message: 'First attempt - good luck!' };
        if (attempts < MAX_ATTEMPTS) return { canAttempt: true, message: `Attempt ${attempts + 1} of ${MAX_ATTEMPTS}` };
        return { canAttempt: false, message: 'Maximum attempts reached' };
    };

    useEffect(() => {
        generateQuiz();
    }, [subject, topic]);

    const generateQuiz = async (forceNew = false) => {
        // Phase 1: Check attempt limit before generating quiz
        if (!canAttemptQuiz()) {
            setPhase('attempt_limit_reached');
            return;
        }

        try {
            setPhase('loading');

            // Get CSRF token from meta tag
            const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

            // Workaround: Request quiz multiple times to get 10 questions
            const requests = [];
            const maxRequests = 3; // Try up to 3 times to get 10 questions

            for (let i = 0; i < maxRequests; i++) {
                requests.push(
                    fetch('/quiz/generate', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRF-TOKEN': token || '',
                        },
                        body: JSON.stringify({ subject, topic, forceNew: forceNew || i > 0 }),
                    })
                );
            }

            // Wait for all requests to complete
            const responses = await Promise.all(requests);

            // Check if all responses are successful
            if (responses.some(response => !response.ok)) {
                throw new Error('Failed to generate quiz');
            }

            // Parse all responses
            const quizDataArray = await Promise.all(responses.map(res => res.json()));

            // Combine questions from all responses, ensuring uniqueness
            const allQuestions = [];
            const seenQuestions = new Set();
            const duplicateCount = { count: 0 };

            console.log('🔍 Processing questions from', quizDataArray.length, 'quiz responses');

            for (let i = 0; i < quizDataArray.length; i++) {
                const quizData = quizDataArray[i];
                console.log(`📝 Quiz ${i + 1}:`, quizData.questions.length, 'questions');

                for (let j = 0; j < quizData.questions.length; j++) {
                    const question = quizData.questions[j];
                    const questionText = question.question?.trim();

                    console.log(`❓ Question ${j + 1}: "${questionText?.substring(0, 50)}..."`);

                    if (questionText && !seenQuestions.has(questionText)) {
                        seenQuestions.add(questionText);
                        allQuestions.push(question);
                        console.log(`✅ Added unique question #${allQuestions.length}`);

                        // Stop if we have 10 questions
                        if (allQuestions.length >= 10) {
                            console.log('🎯 Reached 10 questions, stopping');
                            break;
                        }
                    } else if (questionText && seenQuestions.has(questionText)) {
                        duplicateCount.count++;
                        console.log(`🔄 Duplicate found, skipping. Total duplicates: ${duplicateCount.count}`);
                    }
                }

                if (allQuestions.length >= 10) {
                    break;
                }
            }

            console.log('📊 Final Question Analysis:', {
                totalRequested: 10,
                totalReceived: allQuestions.length,
                duplicatesFound: duplicateCount.count,
                uniqueQuestions: seenQuestions.size,
                questionsList: allQuestions.map((q, idx) => `${idx + 1}: ${q.question?.substring(0, 30)}...`)
            });

            // Fallback: If we still don't have 10 questions, add more from the pool (allowing some duplicates)
            if (allQuestions.length < 10) {
                console.log(`⚠️ Only have ${allQuestions.length} unique questions, adding more...`);

                for (const quizData of quizDataArray) {
                    for (const question of quizData.questions) {
                        if (allQuestions.length >= 10) break;

                        // Add questions even if they're duplicates (as last resort)
                        if (!allQuestions.includes(question)) {
                            allQuestions.push(question);
                            console.log(`➕ Added fallback question #${allQuestions.length}`);
                        }
                    }

                    if (allQuestions.length >= 10) break;
                }

                // Final fallback: pad with modified versions if still needed
                while (allQuestions.length < 10 && quizDataArray.length > 0) {
                    const baseQuiz = quizDataArray[0];
                    const questionToAdd: any = baseQuiz.questions[allQuestions.length % baseQuiz.questions.length];

                    if (!allQuestions.includes(questionToAdd)) {
                        allQuestions.push({ ...questionToAdd });
                        console.log(`🔄 Added modified fallback question #${allQuestions.length}`);
                    } else {
                        allQuestions.length++; // Force increment to avoid infinite loop
                        console.log(`⚠️ Forced question count to ${allQuestions.length}`);
                    }
                }
            }

            // Create combined quiz data
            const combinedQuiz = {
                ...quizDataArray[0], // Use first quiz as base
                questions: allQuestions.slice(0, 10), // Ensure exactly 10 questions
                total_questions: 10 // Force exactly 10
            };

            console.log('🔍 Combined Quiz Result:', {
                requested: 10,
                received: combinedQuiz.total_questions,
                uniqueQuestions: allQuestions.length,
                originalQuizzes: quizDataArray.map(q => q.total_questions)
            });

            setQuiz(combinedQuiz);
            setAnswers(new Array(combinedQuiz.total_questions).fill(null));
            setPhase('quiz');
            setCurrentQuestion(0);
            setSelectedOption(null);
        } catch (error) {
            console.error('Quiz generation error:', error);
            router.visit('/study-planner');
        }
    };

    const handleAnswerSelect = (option: string | { label: string; text: string }) => {
        const optionText = getOptionText(option);
        const optionLabel = getOptionLabel(option);

        // Anti-Cheat Detection: Answer Timing Analysis (now based on quiz start time)
        const answerTime = Date.now() - quizStartTime;
        setAnswerTimes(prev => [...prev, answerTime]);

        // Flag suspiciously fast answers (< 10 seconds total)
        if (answerTime < 10000 && currentQuestion > 0) {
            setSuspiciousActivity(prev => [...prev, {
                type: 'fast_answer',
                time: answerTime,
                question: currentQuestion,
                timestamp: Date.now()
            }]);
        }

        setSelectedOption(optionText);
        const newAnswers = [...answers];
        newAnswers[currentQuestion] = optionLabel; // Store label for submission
        setAnswers(newAnswers);
    };

    const handleNext = () => {
        if (!quiz) return;

        // Directly move to next question without showing feedback
        if (currentQuestion < quiz.total_questions - 1) {
            const nextQuestion = currentQuestion + 1;
            setCurrentQuestion(nextQuestion);
            // Convert stored label back to text for display
            const nextAnswerLabel = answers[nextQuestion];
            if (nextAnswerLabel && quiz.questions[nextQuestion]) {
                const nextOption = quiz.questions[nextQuestion].options.find(opt => getOptionLabel(opt) === nextAnswerLabel);
                setSelectedOption(nextOption ? getOptionText(nextOption) : null);
            } else {
                setSelectedOption(null);
            }
        } else {
            submitQuiz();
        }
    };

    const handlePrevious = () => {
        if (currentQuestion > 0 && quiz) {
            const prevQuestion = currentQuestion - 1;
            setCurrentQuestion(prevQuestion);
            // Convert stored label back to text for display
            const prevAnswerLabel = answers[prevQuestion];
            if (prevAnswerLabel && quiz.questions[prevQuestion]) {
                const prevOption = quiz.questions[prevQuestion].options.find(opt => getOptionLabel(opt) === prevAnswerLabel);
                setSelectedOption(prevOption ? getOptionText(prevOption) : null);
            } else {
                setSelectedOption(null);
            }
        }
    };

    // Anti-Cheat Detection: Analysis Function
    const analyzeCheatPatterns = () => {
        const patterns = {
            // Tab switching analysis
            tabSwitches: tabSwitches,
            tabSwitchThreshold: tabSwitches > 2,

            // Answer timing analysis
            fastAnswers: answerTimes.filter(time => time < 3000).length,
            slowAnswers: answerTimes.filter(time => time > 28000).length,
            averageTime: answerTimes.length > 0 ? answerTimes.reduce((a, b) => a + b, 0) / answerTimes.length : 0,
            consistentTiming: answerTimes.length > 1 ?
                Math.max(...answerTimes) - Math.min(...answerTimes) < 3000 : false,

            // Mouse movement analysis
            lowMouseActivity: mouseMovements.length < 50,

            // Suspicious activity count
            suspiciousCount: suspiciousActivity.length,

            // Risk score (0-100)
            riskScore: 0
        };

        // Calculate risk score
        let risk = 0;
        if (patterns.tabSwitchThreshold) risk += 30;
        if (patterns.fastAnswers > 3) risk += 25;
        if (patterns.slowAnswers > 2) risk += 20;
        if (patterns.consistentTiming) risk += 15;
        if (patterns.lowMouseActivity) risk += 10;
        risk += Math.min(patterns.suspiciousCount * 5, 50);

        patterns.riskScore = Math.min(risk, 100);

        return patterns;
    };

    const submitQuiz = async () => {
        if (!quiz) return;

        try {
            setPhase('submitting');

            // Clean and validate answers before submission
            const cleanedAnswers = answers.map((answer, index) => {
                // Convert to uppercase and ensure it's A, B, C, D, or null
                if (answer === null || answer === undefined || answer === '') {
                    return null;
                }
                const upperAnswer = String(answer).toUpperCase().trim();
                // Validate it's one of the allowed values
                if (['A', 'B', 'C', 'D'].includes(upperAnswer)) {
                    return upperAnswer;
                }
                // If it's not valid, try to extract the letter from the beginning
                const match = upperAnswer.match(/^([A-D])/);
                return match ? match[1] : null;
            });

            // Debug: Log what we're sending
            const cheatAnalysis = analyzeCheatPatterns();
            console.log('Submitting quiz:', {
                quiz_id: quiz.quiz_id,
                original_answers: answers,
                cleaned_answers: cleanedAnswers,
                answers_detail: cleanedAnswers.map((ans, i) => ({ index: i, value: ans, type: typeof ans })),
                total_questions: quiz.total_questions,
                anti_cheat: {
                    tabSwitches,
                    suspiciousActivity,
                    answerTimes,
                    totalTime,
                    riskScore: cheatAnalysis.riskScore,
                    analysis: cheatAnalysis
                }
            });

            // Get CSRF token from meta tag
            const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

            const response = await fetch('/quiz/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': token || '',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    quiz_id: quiz.quiz_id,
                    answers: cleanedAnswers,
                    anti_cheat_data: {
                        tab_switches: tabSwitches,
                        suspicious_activity: suspiciousActivity,
                        answer_times: answerTimes,
                        total_time: totalTime,
                        mouse_movements: mouseMovements.length,
                        risk_score: cheatAnalysis.riskScore,
                        analysis: cheatAnalysis
                    }
                }),
            });

            if (!response.ok) {
                // Try to get error details
                const text = await response.text();
                console.error('Server response:', text);
                throw new Error(`Server error: ${response.status} - ${text.substring(0, 200)}`);
            }

            const resultData = await response.json();
            setResult(resultData);

            // Phase 1: Save this attempt
            saveAttempt(resultData.percentage);

            setPhase('result');
        } catch (error) {
            console.error('Quiz submission error:', error);
            setPhase('quiz');
        }
    };

    const handleRetry = () => {
        generateQuiz(true); // Force new quiz generation
    };

    const handleContinue = () => {
        if (phase === 'quiz' && currentQuestion > 0) {
            // Show confirmation if user has started the quiz
            if (confirm('Are you sure you want to go back? Your quiz progress will be lost.')) {
                router.visit('/study-planner');
            }
        } else {
            router.visit('/study-planner');
        }
    };

    const handleReview = () => {
        console.log('Review data:', result);
        console.log('Review items:', result?.review);
        setPhase('review');
    };

    const handleMarkComplete = () => {
        if (result?.result_id) {
            router.post(`/study-plan/complete-quiz/${result.result_id}`, {}, {
                onSuccess: () => router.visit('/study-planner'),
            });
        }
    };

    const progress = quiz ? ((currentQuestion + 1) / quiz.total_questions) * 100 : 0;

    if (phase === 'loading') {
        return (
            <AppLayout breadcrumbs={breadcrumbs}>
                <Head title="Loading Quiz..." />
                <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
                    <div className="text-center animate-fadeIn">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-lg font-medium text-gray-700 animate-slideIn">Generating your quiz...</p>
                    </div>
                </div>
            </AppLayout>
        );
    }

    // Phase 1: Attempt Limit Reached Screen
    if (phase === 'attempt_limit_reached') {
        const cooldownStatus = getCooldownStatus();
        const isInCooldown = cooldownStatus?.inCooldown;

        return (
            <AppLayout breadcrumbs={breadcrumbs}>
                <Head title="Quiz Attempts Limit Reached" />
                <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
                    <Card className="w-full max-w-md shadow-xl animate-scaleIn">
                        <CardContent className="p-8 text-center">
                            <div className={cn(
                                "rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4",
                                isInCooldown
                                    ? "bg-orange-100 text-orange-600"
                                    : "bg-red-100 text-red-600"
                            )}>
                                {isInCooldown ? (
                                    <Clock className="w-8 h-8" />
                                ) : (
                                    <Lock className="w-8 h-8" />
                                )}
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">
                                {isInCooldown ? 'Cooldown Period' : 'Maximum Attempts Reached'}
                            </h2>
                            <p className="text-gray-600 mb-6">
                                {isInCooldown
                                    ? `Wait ${cooldownStatus.hoursRemaining} hours before trying again.`
                                    : `You've used all ${MAX_ATTEMPTS} attempts for this quiz.`
                                }
                            </p>

                            {/* Attempt History */}
                            <div className="bg-gray-50 rounded-lg p-4 mb-6">
                                <h3 className="text-sm font-semibold text-gray-700 mb-3">Your Attempts:</h3>
                                <div className="space-y-2">
                                    {attemptHistory.map((attempt, index) => (
                                        <div key={index} className="flex justify-between items-center text-sm">
                                            <span className="text-gray-600">Attempt {index + 1}</span>
                                            <span className={cn(
                                                "font-medium",
                                                attempt.percentage >= 70 ? "text-green-600" :
                                                    attempt.percentage >= 50 ? "text-yellow-600" : "text-red-600"
                                            )}>
                                                {attempt.percentage}%
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Phase 2: Study Recommendations */}
                            {!isInCooldown && (
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                                    <h3 className="text-sm font-semibold text-blue-700 mb-2">Study Recommendations:</h3>
                                    <ul className="text-xs text-blue-600 space-y-1 text-left">
                                        <li>• Review the material thoroughly</li>
                                        <li>• Focus on weak areas identified in previous attempts</li>
                                        <li>• Try again after 24 hours for better retention</li>
                                    </ul>
                                </div>
                            )}

                            {/* Phase 2: Action Buttons */}
                            <div className="space-y-3">
                                <Button
                                    variant="outline"
                                    onClick={() => window.location.href = '/study-planner'}
                                    className="w-full"
                                >
                                    <BookOpen className="w-4 h-4 mr-2" />
                                    Back to Study
                                </Button>
                                {isInCooldown && (
                                    <p className="text-xs text-gray-500 text-center">
                                        Cooldown expires in {cooldownStatus.hoursRemaining} hours
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </AppLayout>
        );
    }

    if (phase === 'quiz' && quiz) {
        const question = quiz.questions[currentQuestion];

        return (
            <AppLayout breadcrumbs={breadcrumbs}>
                <Head title={`Quiz: ${subject} - ${topic}`} />
                <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
                    {/* Header */}
                    <div className="bg-white shadow-sm border-b animate-slideIn">
                        <div className="max-w-4xl mx-auto px-4 py-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleContinue}
                                        className="text-gray-600 hover:text-gray-900 transition-all duration-200 hover:scale-105 active:scale-95"
                                    >
                                        <ArrowLeft className="w-4 h-4 mr-2" />
                                        Back to Study
                                    </Button>
                                    <div className="animate-fadeIn" style={{ animationDelay: '200ms' }}>
                                        <h1 className="text-lg font-semibold text-gray-900">{quiz.title}</h1>
                                        <p className="text-sm text-gray-500">{subject}: {topic}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    {/* Anti-Cheat Monitoring Indicator */}
                                    <div className="flex items-center gap-2 text-xs text-gray-500 animate-pulse">
                                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                                        <span>Monitoring Active</span>
                                    </div>

                                    {/* Phase 1 & 2: Attempt Indicator */}
                                    <div className="flex items-center gap-2 text-sm text-gray-600 animate-scaleIn" style={{ animationDelay: '400ms' }}>
                                        <span className="text-xs">Attempts:</span>
                                        <div className="flex gap-1">
                                            {[...Array(MAX_ATTEMPTS)].map((_, i) => (
                                                <div
                                                    key={i}
                                                    className={cn(
                                                        "w-2 h-2 rounded-full transition-colors duration-200",
                                                        i < attempts ? "bg-red-500" : "bg-gray-300"
                                                    )}
                                                />
                                            ))}
                                        </div>
                                        <span className="text-xs font-medium">{attempts}/{MAX_ATTEMPTS}</span>

                                        {/* Phase 2: Cooldown Indicator */}
                                        {getCooldownStatus()?.inCooldown && (
                                            <div className="flex items-center gap-1 text-orange-600">
                                                <Clock className="w-3 h-3" />
                                                <span className="text-xs font-medium">
                                                    {getCooldownStatus()?.hoursRemaining}h
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 text-sm animate-scaleIn" style={{ animationDelay: '500ms' }}>
                                        <Timer className="w-4 h-4" />
                                        <div className="flex items-center gap-2">
                                            <span className={`font-mono font-bold ${getTimerColor()}`}>
                                                {formatTime(timeRemaining)}
                                            </span>
                                            <span className="text-xs text-gray-500">
                                                Total: {formatTime(totalTime)}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-gray-600 animate-scaleIn" style={{ animationDelay: '400ms' }}>
                                        <Target className="w-4 h-4" />
                                        <span className="font-medium">{currentQuestion + 1}/{quiz.total_questions}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="bg-white border-b animate-slideIn">
                            <div className="max-w-4xl mx-auto px-4 py-3">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm text-gray-600">Progress</span>
                                    <span className="text-sm font-medium text-gray-900">{Math.round(progress)}%</span>
                                </div>
                                <div className="relative">
                                    <Progress value={progress} className="h-2 transition-all duration-500" />
                                    <div className="absolute top-0 left-0 h-2 bg-gray-900 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
                                </div>
                            </div>
                        </div>

                        {/* Question */}
                        <div className="max-w-4xl mx-auto px-4 py-8">
                            <Card className="shadow-lg animate-fadeIn relative overflow-hidden group transition-all duration-300 hover:shadow-xl hover:scale-[1.01]">
                                {/* Shimmer effect */}
                                <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000">
                                    <div className="h-full w-full animate-shimmer"></div>
                                </div>

                                <CardContent className="p-8 relative z-10">
                                    <div className="mb-8 animate-slideIn">
                                        <div className="flex items-start gap-3 mb-4">
                                            <div className="bg-blue-100 text-blue-600 rounded-full w-8 h-8 flex items-center justify-center font-semibold text-sm animate-scaleIn">
                                                {currentQuestion + 1}
                                            </div>
                                            <h2 className="text-xl font-semibold text-gray-900 leading-relaxed flex-1">
                                                {question.question}
                                            </h2>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        {question.options.map((option, index) => {
                                            const optionText = getOptionText(option);
                                            const isSelected = selectedOption === optionText;

                                            return (
                                                <button
                                                    key={index}
                                                    onClick={() => handleAnswerSelect(option)}
                                                    className={cn(
                                                        "w-full text-left p-4 rounded-lg border-2 transition-all duration-200",
                                                        "hover:border-blue-300 hover:bg-blue-50 hover:shadow-md hover:scale-[1.01] active:scale-[0.99]",
                                                        "animate-slideIn",
                                                        `animation-delay-${index * 100}ms`,
                                                        isSelected && "border-blue-500 bg-blue-50 shadow-md animate-scaleIn",
                                                        !isSelected && "border-gray-200 bg-white"
                                                    )}
                                                    style={{ animationDelay: `${index * 100}ms` }}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span className={cn(
                                                            "font-medium transition-colors duration-200",
                                                            isSelected ? "text-blue-700" : "text-gray-900"
                                                        )}>
                                                            {getOptionText(option)}
                                                        </span>
                                                        {isSelected && (
                                                            <CheckCircle2 className="w-5 h-5 text-blue-600 animate-scaleIn" />
                                                        )}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Navigation */}
                                    <div className="flex items-center justify-between mt-8 animate-slideIn" style={{ animationDelay: '600ms' }}>
                                        <Button
                                            variant="outline"
                                            onClick={handlePrevious}
                                            disabled={currentQuestion === 0}
                                            className="transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Previous
                                        </Button>

                                        <Button
                                            onClick={handleNext}
                                            disabled={!selectedOption}
                                            className="bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed min-w-[120px]"
                                        >
                                            {currentQuestion < quiz.total_questions - 1 ? (
                                                <>
                                                    Next
                                                    <ChevronRight className="w-4 h-4 ml-2" />
                                                </>
                                            ) : (
                                                'Submit Quiz'
                                            )}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </AppLayout >
        );
    }

    if (phase === 'submitting') {
        return (
            <AppLayout breadcrumbs={breadcrumbs}>
                <Head title="Submitting Quiz..." />
                <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
                    <div className="text-center animate-fadeIn">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-lg font-medium text-gray-700 animate-slideIn">Submitting your answers...</p>
                    </div>
                </div>
            </AppLayout>
        );
    }

    if (phase === 'result' && result) {
        return (
            <AppLayout breadcrumbs={breadcrumbs}>
                <Head title="Quiz Results" />
                <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
                    <Card className="w-full max-w-2xl shadow-xl animate-scaleIn">
                        <CardContent className="p-8 text-center">
                            <div className="mb-6">
                                {result.passed ? (
                                    <>
                                        <div className="bg-green-100 text-green-600 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 animate-scaleIn">
                                            <CheckCircle2 className="w-8 h-8" />
                                        </div>
                                        <h2 className="text-2xl font-bold text-green-900 mb-2 animate-slideIn">Excellent Work!</h2>
                                        <p className="text-gray-600 animate-slideIn" style={{ animationDelay: '200ms' }}>You've mastered this topic</p>
                                    </>
                                ) : (
                                    <>
                                        <div className="bg-orange-100 text-orange-600 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 animate-scaleIn">
                                            <Target className="w-8 h-8" />
                                        </div>
                                        <h2 className="text-2xl font-bold text-orange-900 mb-2 animate-slideIn">Keep Practicing!</h2>
                                        <p className="text-gray-600 animate-slideIn" style={{ animationDelay: '200ms' }}>You're getting closer to mastery</p>
                                    </>
                                )}
                            </div>

                            <div className="grid grid-cols-3 gap-4 mb-8 animate-slideIn" style={{ animationDelay: '400ms' }}>
                                <div className="bg-white rounded-lg p-4 border hover:shadow-md transition-all duration-200 hover:scale-105">
                                    <p className="text-2xl font-bold text-gray-900">{result.percentage}%</p>
                                    <p className="text-sm text-gray-600">Score</p>
                                </div>
                                <div className="bg-white rounded-lg p-4 border hover:shadow-md transition-all duration-200 hover:scale-105">
                                    <p className="text-2xl font-bold text-green-600">{result.correct_count}</p>
                                    <p className="text-sm text-gray-600">Correct</p>
                                </div>
                                <div className="bg-white rounded-lg p-4 border hover:shadow-md transition-all duration-200 hover:scale-105">
                                    <p className="text-2xl font-bold text-red-600">{result.incorrect_count}</p>
                                    <p className="text-sm text-gray-600">Incorrect</p>
                                </div>
                            </div>

                            {/* Question Timer Enhancement: Time Statistics */}
                            <div className="grid grid-cols-3 gap-4 mb-6 animate-slideIn" style={{ animationDelay: '500ms' }}>
                                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 hover:shadow-md transition-all duration-200 hover:scale-105">
                                    <div className="flex items-center justify-center mb-2">
                                        <Timer className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <p className="text-lg font-bold text-blue-900">{formatTime(totalTime)}</p>
                                    <p className="text-xs text-blue-600">Total Time</p>
                                </div>
                                <div className="bg-purple-50 rounded-lg p-4 border border-purple-200 hover:shadow-md transition-all duration-200 hover:scale-105">
                                    <div className="flex items-center justify-center mb-2">
                                        <Target className="w-5 h-5 text-purple-600" />
                                    </div>
                                    <p className="text-lg font-bold text-purple-900">
                                        {Math.round(totalTime / (quiz?.total_questions || 1))}s
                                    </p>
                                    <p className="text-xs text-purple-600">Avg/Question</p>
                                </div>
                                <div className="bg-green-50 rounded-lg p-4 border border-green-200 hover:shadow-md transition-all duration-200 hover:scale-105">
                                    <div className="flex items-center justify-center mb-2">
                                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                                    </div>
                                    <p className="text-lg font-bold text-green-900">
                                        {result.correct_count}/{quiz?.total_questions || 10}
                                    </p>
                                    <p className="text-xs text-green-600">Accuracy</p>
                                </div>
                            </div>

                            <div className="flex flex-col gap-3 animate-fadeIn" style={{ animationDelay: '600ms' }}>
                                <Button
                                    variant="outline"
                                    onClick={handleReview}
                                    className="w-full transition-all duration-200 hover:scale-105 active:scale-95"
                                >
                                    <BookOpen className="w-4 h-4 mr-2" />
                                    Review Answers
                                </Button>
                                {result.passed ? (
                                    <Button
                                        onClick={handleMarkComplete}
                                        className="w-full transition-all duration-200 hover:scale-105 active:scale-95"
                                    >
                                        <CheckCircle2 className="w-4 h-4 mr-2" />
                                        Mark Session Complete
                                    </Button>
                                ) : (
                                    <Button
                                        onClick={handleRetry}
                                        className="w-full transition-all duration-200 hover:scale-105 active:scale-95"
                                    >
                                        <RotateCcw className="w-4 h-4 mr-2" />
                                        Retry Quiz
                                    </Button>
                                )}
                                <Button
                                    variant="ghost"
                                    onClick={handleContinue}
                                    className="w-full text-gray-600 transition-all duration-200 hover:scale-105 active:scale-95"
                                >
                                    Continue Studying
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </AppLayout>
        );
    }

    if (phase === 'review' && result) {
        return (
            <AppLayout breadcrumbs={breadcrumbs}>
                <Head title="Review Answers" />
                <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
                    <div className="max-w-4xl mx-auto px-4 py-8">
                        <div className="mb-6">
                            <Button
                                variant="ghost"
                                onClick={() => setPhase('result')}
                                className="text-gray-600 hover:text-gray-900"
                            >
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Back to Results
                            </Button>
                            <h1 className="text-2xl font-bold text-gray-900 mt-4">Review Your Answers</h1>
                        </div>

                        <div className="space-y-4">
                            {!result.review || result.review.length === 0 ? (
                                <Card className="shadow">
                                    <CardContent className="p-6 text-center">
                                        <p className="text-gray-500">No review data available.</p>
                                    </CardContent>
                                </Card>
                            ) : (
                                result.review.map((item, index) => (
                                    <Card key={index} className="shadow">
                                        <CardContent className="p-6">
                                            <div className="flex items-start gap-3 mb-4">
                                                <div className={cn(
                                                    "rounded-full w-8 h-8 flex items-center justify-center font-semibold text-sm",
                                                    item.is_correct ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                                                )}>
                                                    {index + 1}
                                                </div>
                                                <h3 className="font-medium text-gray-900 flex-1">{item.question}</h3>
                                                {item.is_correct ? (
                                                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                                                ) : (
                                                    <XCircle className="w-5 h-5 text-red-600" />
                                                )}
                                            </div>

                                            <div className="space-y-2">
                                                {item.options && item.options.map((option, optIndex) => {
                                                    const optionText = getOptionText(option);
                                                    const isCorrect = optionText === item.correct_answer;
                                                    const isUserAnswer = optionText === item.user_answer;

                                                    return (
                                                        <div
                                                            key={optIndex}
                                                            className={cn(
                                                                "p-3 rounded-lg border",
                                                                isCorrect && "bg-green-50 border-green-200",
                                                                isUserAnswer && !isCorrect && "bg-red-50 border-red-200",
                                                                !isCorrect && !isUserAnswer && "bg-gray-50 border-gray-200"
                                                            )}
                                                        >
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-sm">{optionText}</span>
                                                                {isCorrect && <span className="text-xs font-medium text-green-700">Correct</span>}
                                                                {isUserAnswer && !isCorrect && <span className="text-xs font-medium text-red-700">Your answer</span>}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {item.explanation && (
                                                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                                    <p className="text-sm text-blue-900">
                                                        <strong>Explanation:</strong> {item.explanation}
                                                    </p>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </AppLayout>
        );
    }

    return null;
}
