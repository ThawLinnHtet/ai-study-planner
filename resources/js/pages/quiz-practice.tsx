import { Head, router, usePage } from '@inertiajs/react';
import { ArrowLeft, BookOpen, CheckCircle2, ChevronRight, RotateCcw, XCircle, Sparkles, Target, Timer, Lock, Clock, Heart } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import {
    Alert,
    AlertDescription,
    AlertTitle,
} from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
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
    learning_path_id?: number;
    day_number?: number;
}

const CHEAT_SCORE_ALERT_THRESHOLD = 5;
const FAST_ANSWER_THRESHOLD = 3000; // 3 seconds
const MAX_CHEAT_SCORE = 10;

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Study Planner', href: '/study-planner' },
    { title: 'Quiz Practice', href: '#' },
];

export default function QuizPracticePage({ subject, topic }: Props) {
    const { props: pageProps } = usePage();

    // Read learning path context from URL params (for path-based day completion)
    const urlParams = new URLSearchParams(window.location.search);
    const learningPathId = urlParams.get('learning_path_id') ? parseInt(urlParams.get('learning_path_id')!) : null;
    const dayNumber = urlParams.get('day_number') ? parseInt(urlParams.get('day_number')!) : null;
    const isPathQuiz = learningPathId !== null && dayNumber !== null;
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
    const [showExitConfirm, setShowExitConfirm] = useState(false);
    const [pendingNavUrl, setPendingNavUrl] = useState<string>('/study-planner');

    // Lives System (Duolingo-style)
    const MAX_LIVES = 3;
    const LIFE_REFILL_MINUTES = 30; // 1 life refills every 30 minutes
    type LivesData = {
        lives: number;
        lastLostAt: number | null; // timestamp when last life was lost
    };

    const [lives, setLives] = useState(MAX_LIVES);
    const [nextRefillIn, setNextRefillIn] = useState<string | null>(null);
    const [livesReady, setLivesReady] = useState(false);

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
    const [cheatScore, setCheatScore] = useState(0);
    const [cheatWarnings, setCheatWarnings] = useState(0);
    const [violationLog, setViolationLog] = useState<Array<{ reason: string; points: number; timestamp: number }>>([]);
    const alertLockRef = useRef(false);
    const isConfirmedLeaveRef = useRef(false); // Prevents infinite loop in exit confirm
    const [sessionSaved, setSessionSaved] = useState(false);

    const registerViolation = (reason: string, points: number) => {
        if (alertLockRef.current) return;
        setCheatScore(prev => Math.min(prev + points, MAX_CHEAT_SCORE));
        setViolationLog(prev => [...prev.slice(-9), { reason, points, timestamp: Date.now() }]);
    };

    const resetCheatMonitoring = () => {
        alertLockRef.current = false;
        setCheatScore(0);
        setViolationLog([]);
    };

    // Learning-Focused Response System
    const [learningAlert, setLearningAlert] = useState<{
        level: 'none' | 'unfocused' | 'distracted' | 'struggling';
        message: string;
        action: string;
        show: boolean;
    }>({
        level: 'none',
        message: '',
        action: '',
        show: false
    });

    // Pattern Tracking for Better UX
    const [learningPatterns, setLearningPatterns] = useState<{
        sessionStartTime: number;
        questionsAttempted: number;
        averageAnswerTime: number;
        difficultyStruggles: Set<number>;
        focusTrends: number[]; // Track focus over time
        learningVelocity: number; // How fast user is learning
        engagementScore: number; // Overall engagement level
    }>({
        sessionStartTime: 0,
        questionsAttempted: 0,
        averageAnswerTime: 0,
        difficultyStruggles: new Set<number>(),
        focusTrends: [], // Track focus over time
        learningVelocity: 0, // How fast user is learning
        engagementScore: 0 // Overall engagement level
    });

    // Load lives from localStorage and calculate refills
    const livesKey = `quiz_lives_${subject}_${topic}`;

    const loadLives = (): LivesData => {
        const saved = localStorage.getItem(livesKey);
        if (!saved) return { lives: MAX_LIVES, lastLostAt: null };
        try {
            return JSON.parse(saved);
        } catch {
            return { lives: MAX_LIVES, lastLostAt: null };
        }
    };

    const saveLives = (data: LivesData) => {
        localStorage.setItem(livesKey, JSON.stringify(data));
    };

    const calculateRefills = (data: LivesData): LivesData => {
        if (data.lives >= MAX_LIVES || !data.lastLostAt) return data;
        const now = Date.now();
        const elapsed = now - data.lastLostAt;
        const refillsEarned = Math.floor(elapsed / (LIFE_REFILL_MINUTES * 60000));
        if (refillsEarned > 0) {
            const newLives = Math.min(data.lives + refillsEarned, MAX_LIVES);
            const newLastLostAt = newLives >= MAX_LIVES ? null : data.lastLostAt + refillsEarned * LIFE_REFILL_MINUTES * 60000;
            return { lives: newLives, lastLostAt: newLastLostAt };
        }
        return data;
    };

    useEffect(() => {
        setLivesReady(false);
        const data = calculateRefills(loadLives());
        setLives(data.lives);
        saveLives(data);
        setLivesReady(true);
    }, [subject, topic]);

    // Refill timer - update countdown every second
    useEffect(() => {
        if (lives >= MAX_LIVES) {
            setNextRefillIn(null);
            return;
        }

        const interval = setInterval(() => {
            const data = loadLives();
            const updated = calculateRefills(data);
            if (updated.lives !== lives) {
                setLives(updated.lives);
                saveLives(updated);
            }

            // Calculate time until next refill
            if (updated.lastLostAt && updated.lives < MAX_LIVES) {
                const elapsed = Date.now() - updated.lastLostAt;
                const nextRefillMs = LIFE_REFILL_MINUTES * 60000 - (elapsed % (LIFE_REFILL_MINUTES * 60000));
                const mins = Math.floor(nextRefillMs / 60000);
                const secs = Math.floor((nextRefillMs % 60000) / 1000);
                setNextRefillIn(`${mins}:${secs.toString().padStart(2, '0')}`);
            } else {
                setNextRefillIn(null);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [lives, subject, topic]);

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

    // Anti-Cheat Detection: Tab Switching (covers mouse tab clicks + Alt+Tab)
    useEffect(() => {
        if (phase !== 'quiz') return;

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                setTabSwitches(prev => prev + 1);
                registerViolation('tab_switch', 1);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange, true);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange, true);
    }, [phase]);

    // Blur event detection
    useEffect(() => {
        if (phase !== 'quiz') return;

        const handleBlur = () => {
            console.log('👀 Blur event detected');
            registerViolation('blur_event', 1);
        };

        window.addEventListener('blur', handleBlur);
        return () => window.removeEventListener('blur', handleBlur);
    }, [phase]);

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
            registerViolation('copy_attempt', 2);
        };

        const handlePaste = (e: ClipboardEvent) => {
            e.preventDefault();
            setSuspiciousActivity(prev => [...prev, {
                type: 'paste_attempt',
                question: currentQuestion,
                timestamp: Date.now()
            }]);
            alert('🚫 Paste is not allowed during quiz!');
            registerViolation('paste_attempt', 2);
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
                registerViolation('shortcut_attempt', 2);
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

    // Lives system helpers
    const canAttemptQuiz = () => lives > 0;

    const loseLife = () => {
        const data = calculateRefills(loadLives());
        const newLives = Math.max(0, data.lives - 1);
        const updated: LivesData = { lives: newLives, lastLostAt: Date.now() };
        saveLives(updated);
        setLives(newLives);
    };

    // Intercept Inertia sidebar/breadcrumb navigation while quiz or result is active
    useEffect(() => {
        const removeHandler = router.on('before', (event) => {
            const url = (event.detail.visit as any)?.url?.href ?? '/study-planner';

            if (phase === 'quiz') {
                if (isConfirmedLeaveRef.current) {
                    isConfirmedLeaveRef.current = false;
                    return;
                }
                // Mid-quiz: block and show confirmation
                setPendingNavUrl(url);
                setShowExitConfirm(true);
                event.preventDefault();
                return;
            }

            if (phase === 'result' && result && !result.passed) {
                // If leaving failed result page via sidebar/breadcrumbs, silently abandon 
                // so next visit doesn't show the same failed quiz.
                const quizId = quiz?.quiz_id;
                const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
                if (quizId && token) {
                    fetch(`/quiz/${quizId}/abandon`, {
                        method: 'DELETE',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRF-TOKEN': token,
                            'Accept': 'application/json',
                        },
                        keepalive: true,
                    });
                }
            }
        });
        return removeHandler;
    }, [phase, result, quiz]);

    useEffect(() => {
        if (!livesReady) return;
        generateQuiz();
    }, [subject, topic, livesReady]);

    const generateQuiz = async (forceNew = false) => {
        // Phase 1: Check attempt limit before generating quiz
        if (!canAttemptQuiz()) {
            setPhase('attempt_limit_reached');
            return;
        }

        console.log('🚀 Generating quiz', {
            subject,
            topic,
            forceNew,
            timestamp: new Date().toISOString()
        });

        try {
            setPhase('loading');

            // Get CSRF token from meta tag with fallback
            const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

            if (!token) {
                console.error('CSRF token not found');
                throw new Error('Security token missing. Please refresh the page.');
            }

            // Workaround: Request quiz multiple times to get 10 questions
            const requests = [];
            const maxRequests = 3; // Try up to 3 times to get 10 questions

            for (let i = 0; i < maxRequests; i++) {
                requests.push(
                    fetch('/quiz/generate', {
                        method: 'POST',
                        credentials: 'same-origin',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                            'X-Requested-With': 'XMLHttpRequest',
                            'X-CSRF-TOKEN': token,
                        },
                        body: JSON.stringify({
                            subject,
                            topic,
                            forceNew,
                            learning_path_id: learningPathId,
                            day_number: dayNumber
                        }),
                    })
                );
            }

            // Wait for all requests to complete
            const responses = await Promise.all(requests);

            // Check each response individually for better error reporting
            const failedResponses: { index: number; status: number; statusText: string }[] = [];
            const successfulResponses: Response[] = [];

            responses.forEach((response, index) => {
                if (!response.ok) {
                    failedResponses.push({ index, status: response.status, statusText: response.statusText });
                } else {
                    successfulResponses.push(response);
                }
            });

            if (failedResponses.length > 0) {
                console.error('Failed quiz generation requests:', failedResponses);

                // If all requests failed, throw error
                if (failedResponses.length === responses.length) {
                    const firstError = failedResponses[0];
                    if (firstError.status === 419) {
                        throw new Error('Security token expired. Please refresh the page.');
                    } else if (firstError.status === 404) {
                        throw new Error('Quiz generation endpoint not found. Please contact support.');
                    } else {
                        throw new Error(`Quiz generation failed (${firstError.status}: ${firstError.statusText}). Please try again.`);
                    }
                }

                // If some requests failed, continue with successful ones
                console.warn(`${failedResponses.length} requests failed, continuing with ${successfulResponses.length} successful requests`);
            }

            // Parse only successful responses
            const quizDataArray = await Promise.all(
                successfulResponses.map(res => res.json())
            );

            // If no successful responses, throw error
            if (quizDataArray.length === 0) {
                throw new Error('No quiz data received. Please check your internet connection and try again.');
            }

            console.log('📊 Backend responses received:', {
                totalResponses: quizDataArray.length,
                cachedResponses: quizDataArray.filter(r => r.cached).length,
                newResponses: quizDataArray.filter(r => !r.cached).length,
                quizIds: quizDataArray.map(r => r.quiz_id),
                titles: quizDataArray.map(r => r.title)
            });

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

            // Validate we have enough questions
            if (combinedQuiz.questions.length < 5) {
                throw new Error('Not enough questions generated. Please try again.');
            }

            setQuiz(combinedQuiz);
            setAnswers(new Array(combinedQuiz.total_questions).fill(null));
            setPhase('quiz');
            setCurrentQuestion(0);
            setSelectedOption(null);
        } catch (error) {
            console.error('Quiz generation error:', error);

            // Show user-friendly error message
            const errorMessage = error instanceof Error ? error.message : 'Failed to generate quiz. Please try again.';

            // You could show a toast or modal here instead of redirecting
            alert(errorMessage);

            // Optionally redirect back to study planner
            router.visit('/study-planner');
        }
    };

    const handleAnswerSelect = (option: string | { label: string; text: string }) => {
        const optionText = getOptionText(option);
        const optionLabel = getOptionLabel(option);

        // Anti-Cheat Detection: Answer Timing Analysis (now based on quiz start time)
        const answerTime = Date.now() - quizStartTime;
        setAnswerTimes(prev => [...prev, answerTime]);

        if (answerTime < FAST_ANSWER_THRESHOLD) {
            setSuspiciousActivity(prev => [...prev, {
                type: 'fast_answer',
                time: answerTime,
                question: currentQuestion,
                timestamp: Date.now()
            }]);
            registerViolation('fast_answer', 2);
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
        const riskScore = Math.min((cheatScore / CHEAT_SCORE_ALERT_THRESHOLD) * 100, 100);

        return {
            tabSwitches,
            suspiciousCount: suspiciousActivity.length,
            cheatScore,
            violationLog,
            riskScore
        };
    };

    // Learning-Focused Pattern Analysis
    const analyzeLearningPatterns = () => {
        const patterns = analyzeCheatPatterns();
        const { cheatScore, violationLog } = patterns;

        console.log('🧮 Cheat score check:', {
            cheatScore,
            violationLog
        });

        if (cheatScore < CHEAT_SCORE_ALERT_THRESHOLD) {
            return {
                level: 'none' as const,
                message: '',
                action: 'continue'
            };
        }

        const latestViolation = violationLog[violationLog.length - 1];
        const reasonMessages: Record<string, string> = {
            tab_switch: 'Switching tabs mid-quiz breaks your focus and hurts retention. Stay in this window until the section is complete.',
            blur_event: 'You minimized or left the quiz window. Keep the quiz in focus so your brain stays in learning mode.',
            fast_answer: 'Answers submitted in under 3 seconds usually mean guessing or copying. Slow down and reason through each step.',
            copy_attempt: 'Copying quiz content prevents real learning. Engage with the question and explain it in your own words.',
            paste_attempt: 'Pasting answers bypasses the practice. Try solving it yourself first, then review explanations.',
            shortcut_attempt: 'Keyboard shortcuts like Ctrl+C/Ctrl+V are disabled during quizzes. Use the review mode afterward for notes.'
        };

        const defaultMessage = 'We noticed repeated behaviors that prevent productive study. Let\'s reset and come back with full focus.';
        const message = latestViolation ? reasonMessages[latestViolation.reason] || defaultMessage : defaultMessage;

        if (cheatWarnings === 0) {
            return {
                level: 'unfocused' as const,
                message: `${message} This is your only warning—stay focused and keep the quiz in view.`,
                action: 'gentle_nudge'
            };
        }

        return {
            level: 'distracted' as const,
            message: 'We already warned you about losing focus. To ensure fair assessment and prevent memorization, we\'ll generate fresh questions for this section.',
            action: 'restart_section'
        };
    };

    // Learning Response Handler
    const handleLearningResponse = (action: string) => {
        resetCheatMonitoring();

        switch (action) {
            case 'gentle_nudge':
                // Show gentle reminder and continue
                setLearningAlert(prev => ({ ...prev, show: false }));
                setCheatWarnings(1);
                break;
            case 'restart_section':
                // Reset current quiz section with fresh questions
                setLearningAlert(prev => ({ ...prev, show: false }));
                setCheatWarnings(prev => Math.min(prev + 1, 2));

                // Generate fresh questions to prevent memorization
                generateQuiz(true); // Force new quiz generation

                break;
            case 'adapt_content':
                // Navigate to easier content or review
                setLearningAlert(prev => ({ ...prev, show: false }));
                // You could redirect to review material here
                router.visit('/study-planner');
                break;
            case 'continue_anyway':
                // Allow to continue with understanding
                setLearningAlert(prev => ({ ...prev, show: false }));
                break;
                // Show gentle reminder and continue
                setLearningAlert(prev => ({ ...prev, show: false }));
                break;
            case 'restart_section':
                // Reset current quiz section
                setLearningAlert(prev => ({ ...prev, show: false }));
                setCurrentQuestion(0);
                setAnswers(new Array(quiz!.total_questions).fill(null));
                setSelectedOption(null);
                setTimeRemaining(TOTAL_QUIZ_TIME);
                break;
            case 'adapt_content':
                // Navigate to easier content or review
                setLearningAlert(prev => ({ ...prev, show: false }));
                // You could redirect to review material here
                router.visit('/study-planner');
                break;
            case 'continue_anyway':
                // Allow to continue with understanding
                setLearningAlert(prev => ({ ...prev, show: false }));
                break;
        }
    };

    // Check Learning Patterns Continuously
    useEffect(() => {
        if (phase !== 'quiz' || learningAlert.show || cheatScore === 0) return;

        console.log('🔍 Checking learning patterns...', {
            cheatScore,
            violationLog,
            currentAlert: learningAlert.level
        });

        const learningPattern = analyzeLearningPatterns();
        console.log('📊 Learning pattern analysis:', learningPattern);

        if (learningPattern.level !== 'none') {
            console.log('🚨 Showing learning alert:', learningPattern);
            alertLockRef.current = true;
            setLearningAlert({
                level: learningPattern.level,
                message: learningPattern.message,
                action: learningPattern.action,
                show: true
            });
        }
    }, [cheatScore, violationLog, phase, learningAlert.show]);

    const submitQuiz = async () => {
        if (!quiz) return;

        try {
            setPhase('submitting');

            // Clean and validate answers before submission
            const cleanedAnswers = answers.map((answer) => {
                if (answer === null || answer === undefined || answer === '') {
                    return null;
                }
                const upperAnswer = String(answer).toUpperCase().trim();
                if (['A', 'B', 'C', 'D'].includes(upperAnswer)) {
                    return upperAnswer;
                }
                const match = upperAnswer.match(/^([A-D])/);
                return match ? match[1] : null;
            });

            const cheatAnalysis = analyzeCheatPatterns();

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
                const text = await response.text();
                console.error('Server response:', text);
                throw new Error(`Server error: ${response.status} - ${text.substring(0, 200)}`);
            }

            const resultData = await response.json();
            setResult(resultData);

            const passed = resultData.percentage >= (quiz?.pass_percentage ?? 70);
            if (!passed) {
                loseLife();
            } else {
                if (isPathQuiz) {
                    // Learning path-based day completion
                    fetch(`/learning-path/${learningPathId}/complete-day`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRF-TOKEN': token || '',
                            'Accept': 'application/json',
                        },
                        body: JSON.stringify({
                            day_number: dayNumber,
                            quiz_result_id: resultData.result_id,
                        }),
                    }).then(res => {
                        if (res.ok) setSessionSaved(true);
                    }).catch(() => {
                        // Silent — user can still manually mark complete
                    });
                } else {
                    // Legacy: Auto-save the session in the background
                    fetch(`/study-plan/complete-quiz/${resultData.result_id}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRF-TOKEN': token || '',
                            'Accept': 'application/json',
                            'X-Inertia': 'true',
                        },
                    }).then(res => {
                        if (res.ok) setSessionSaved(true);
                    }).catch(() => {
                        // Silent — user can still manually mark complete from result screen
                    });
                }
            }

            setPhase('result');
        } catch (error) {
            console.error('Quiz submission error:', error);
            setPhase('quiz');
        }
    };

    const handleRetry = () => {
        generateQuiz(true); // Force new quiz generation
    };

    const performAbandon = (destination: string) => {
        const quizId = quiz?.quiz_id;
        const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

        const doNavigate = () => {
            isConfirmedLeaveRef.current = true;
            router.visit(destination);
        };

        if (quizId && token) {
            fetch(`/quiz/${quizId}/abandon`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': token,
                    'Accept': 'application/json',
                },
            }).finally(doNavigate);
        } else {
            doNavigate();
        }
    };

    const confirmExit = () => {
        setShowExitConfirm(false);
        performAbandon(pendingNavUrl);
    };

    const handleContinue = () => {
        if (phase === 'quiz') {
            setPendingNavUrl('/study-planner');
            setShowExitConfirm(true);
            return;
        }

        if (phase === 'result' && result && !result.passed) {
            // Leaving after failing — abandon so next time is a fresh random quiz
            performAbandon('/study-planner');
            return;
        }

        router.visit('/study-planner');
    };

    const handleReview = () => {
        console.log('Review data:', result);
        console.log('Review items:', result?.review);
        setPhase('review');
    };

    const handleMarkComplete = () => {
        // If it was already saved via the background fetch in submitQuiz, just go back
        if (sessionSaved) {
            router.visit('/study-planner');
            return;
        }

        if (isPathQuiz && result?.result_id) {
            router.post(`/learning-path/${learningPathId}/complete-day`, {
                day_number: dayNumber,
                quiz_result_id: result.result_id
            }, {
                onSuccess: () => router.visit('/study-planner'),
            });
        } else if (result?.result_id) {
            router.post(`/study-plan/complete-quiz/${result.result_id}`, {}, {
                onSuccess: () => router.visit('/study-planner'),
            });
        } else {
            router.visit('/study-planner');
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

    // No Lives Screen
    if (phase === 'attempt_limit_reached') {
        return (
            <AppLayout breadcrumbs={breadcrumbs}>
                <Head title="No Lives Remaining" />
                <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
                    <Card className="w-full max-w-md shadow-xl animate-scaleIn">
                        <CardContent className="p-8 text-center">
                            {/* Hearts Display */}
                            <div className="flex justify-center gap-2 mb-4">
                                {[...Array(MAX_LIVES)].map((_, i) => (
                                    <Heart
                                        key={i}
                                        className={cn(
                                            "w-10 h-10 transition-all duration-300",
                                            i < lives
                                                ? "text-red-500 fill-red-500"
                                                : "text-gray-300"
                                        )}
                                    />
                                ))}
                            </div>

                            <h2 className="text-2xl font-bold text-gray-900 mb-2">
                                No Lives Remaining
                            </h2>
                            <p className="text-gray-600 mb-4">
                                You've lost all your lives for this quiz. Lives refill automatically over time.
                            </p>

                            {/* Refill Timer */}
                            {nextRefillIn && (
                                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
                                    <div className="flex items-center justify-center gap-2 text-orange-700">
                                        <Clock className="w-5 h-5" />
                                        <span className="font-semibold text-lg">{nextRefillIn}</span>
                                    </div>
                                    <p className="text-xs text-orange-600 mt-1">until next life refills</p>
                                </div>
                            )}

                            {/* Study Recommendations */}
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                                <h3 className="text-sm font-semibold text-blue-700 mb-2">While you wait:</h3>
                                <ul className="text-xs text-blue-600 space-y-1 text-left">
                                    <li>• Review the material thoroughly</li>
                                    <li>• Focus on weak areas from previous attempts</li>
                                    <li>• Practice with a different topic</li>
                                </ul>
                            </div>

                            {/* Action Buttons */}
                            <div className="space-y-3">
                                <Button
                                    variant="outline"
                                    onClick={() => window.location.href = '/study-planner'}
                                    className="w-full"
                                >
                                    <BookOpen className="w-4 h-4 mr-2" />
                                    Back to Study
                                </Button>
                                <p className="text-xs text-gray-500 text-center">
                                    1 life refills every {LIFE_REFILL_MINUTES} minutes
                                </p>
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
                <Dialog open={showExitConfirm} onOpenChange={setShowExitConfirm}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Leave this quiz?</DialogTitle>
                            <DialogDescription>
                                You&apos;ll lose your current progress if you exit before submitting. Do you want to go back to your study plan?
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setShowExitConfirm(false)}>
                                Stay on quiz
                            </Button>
                            <Button onClick={confirmExit} className="bg-red-600 hover:bg-red-700">
                                Leave quiz
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
                <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
                    {/* Learning Alert Modal */}
                    {learningAlert.show && (
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fadeIn">
                            <Card className="w-full max-w-md mx-4 shadow-2xl animate-scaleIn">
                                <CardContent className="p-6 text-center">
                                    {/* Alert Icon */}
                                    <div className={cn(
                                        "rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4",
                                        learningAlert.level === 'struggling' ? "bg-purple-100 text-purple-600" :
                                            learningAlert.level === 'distracted' ? "bg-orange-100 text-orange-600" :
                                                learningAlert.level === 'unfocused' ? "bg-blue-100 text-blue-600" :
                                                    "bg-gray-100 text-gray-600"
                                    )}>
                                        {learningAlert.level === 'struggling' ? (
                                            <Target className="w-8 h-8" />
                                        ) : learningAlert.level === 'distracted' ? (
                                            <RotateCcw className="w-8 h-8" />
                                        ) : learningAlert.level === 'unfocused' ? (
                                            <Sparkles className="w-8 h-8" />
                                        ) : (
                                            <CheckCircle2 className="w-8 h-8" />
                                        )}
                                    </div>

                                    {/* Alert Message */}
                                    <h3 className="text-lg font-semibold text-gray-900 mb-3">
                                        {learningAlert.action === 'gentle_nudge' ? 'Stay Focused on This Quiz' : 'Section Restart Required'}
                                    </h3>
                                    <p className="text-gray-600 mb-6 leading-relaxed">
                                        {learningAlert.message}
                                    </p>

                                    {/* Action Buttons */}
                                    <div className="space-y-3">
                                        {learningAlert.action === 'gentle_nudge' && (
                                            <Button
                                                onClick={() => handleLearningResponse('gentle_nudge')}
                                                className="w-full"
                                            >
                                                I Understand, I'll Refocus
                                            </Button>
                                        )}

                                        {learningAlert.action === 'restart_section' && (
                                            <Button
                                                onClick={() => handleLearningResponse('restart_section')}
                                                className="w-full"
                                            >
                                                Generate Fresh Questions
                                            </Button>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

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
                                    {/* Lives (Hearts) Indicator */}
                                    <div className="flex items-center gap-1 animate-scaleIn" style={{ animationDelay: '400ms' }}>
                                        {[...Array(MAX_LIVES)].map((_, i) => (
                                            <Heart
                                                key={i}
                                                className={cn(
                                                    "w-5 h-5 transition-all duration-300",
                                                    i < lives
                                                        ? "text-red-500 fill-red-500"
                                                        : "text-gray-300"
                                                )}
                                            />
                                        ))}
                                        {nextRefillIn && lives < MAX_LIVES && (
                                            <span className="text-xs text-orange-600 font-medium ml-1">{nextRefillIn}</span>
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
                                            const optionLetter = String.fromCharCode(65 + index); // A, B, C, D

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
                                                        <div className="flex items-center gap-3">
                                                            <span className={cn(
                                                                "flex items-center justify-center w-8 h-8 rounded-full border-2 font-bold text-sm transition-colors duration-200",
                                                                isSelected
                                                                    ? "border-blue-500 bg-blue-500 text-white"
                                                                    : "border-gray-300 bg-gray-100 text-gray-600"
                                                            )}>
                                                                {optionLetter}
                                                            </span>
                                                            <span className={cn(
                                                                "font-medium transition-colors duration-200",
                                                                isSelected ? "text-blue-700" : "text-gray-900"
                                                            )}>
                                                                {optionText}
                                                            </span>
                                                        </div>
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
                                    <>
                                        {sessionSaved && (
                                            <div className="flex items-center justify-center gap-2 py-2 px-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                                                <CheckCircle2 className="w-4 h-4" />
                                                Session saved to your study plan
                                            </div>
                                        )}
                                        <Button
                                            onClick={handleMarkComplete}
                                            className="w-full transition-all duration-200 hover:scale-105 active:scale-95"
                                        >
                                            <CheckCircle2 className="w-4 h-4 mr-2" />
                                            {sessionSaved ? 'Back to Study Plan' : 'Mark Session Complete'}
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <Button
                                            onClick={handleRetry}
                                            className="w-full transition-all duration-200 hover:scale-105 active:scale-95"
                                        >
                                            <RotateCcw className="w-4 h-4 mr-2" />
                                            Retry Quiz
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            onClick={handleContinue}
                                            className="w-full text-gray-600 transition-all duration-200 hover:scale-105 active:scale-95"
                                        >
                                            Continue Studying
                                        </Button>
                                    </>
                                )}
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
                                result.review.map((item, index) => {
                                    const correctOption = item.options?.find((option) => {
                                        const optionText = getOptionText(option);
                                        const optionLabel = getOptionLabel(option);
                                        return optionText === item.correct_answer || optionLabel === item.correct_answer;
                                    });
                                    const correctAnswerText = correctOption ? getOptionText(correctOption) : item.correct_answer;

                                    return (
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
                                                        const optionLabel = getOptionLabel(option);
                                                        const isCorrect = optionText === item.correct_answer || optionLabel === item.correct_answer;
                                                        const isUserAnswer = optionText === item.user_answer || optionLabel === item.user_answer;
                                                        const optionLetter = String.fromCharCode(65 + optIndex); // A, B, C, D

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
                                                                    <div className="flex items-center gap-3">
                                                                        <span className={cn(
                                                                            "flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold",
                                                                            isCorrect && "bg-green-200 text-green-700",
                                                                            isUserAnswer && !isCorrect && "bg-red-200 text-red-700",
                                                                            !isCorrect && !isUserAnswer && "bg-gray-200 text-gray-600"
                                                                        )}>
                                                                            {optionLetter}
                                                                        </span>
                                                                        <span className="flex-1 text-sm">{optionText}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        {isCorrect && (
                                                                            <span className="text-xs font-medium text-green-700">Correct</span>
                                                                        )}
                                                                        {isUserAnswer && !isCorrect && (
                                                                            <span className="text-xs font-medium text-red-700">Your answer</span>
                                                                        )}
                                                                        {isCorrect && (
                                                                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                                                                        )}
                                                                        {isUserAnswer && !isCorrect && (
                                                                            <XCircle className="w-4 h-4 text-red-600" />
                                                                        )}
                                                                    </div>
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
                                    )
                                })
                            )}
                        </div>

                        {/* Bottom action — matches the top back button style */}
                        <div className="mt-8 pt-6 border-t border-gray-200 flex justify-end">
                            <Button
                                variant="ghost"
                                onClick={() => setPhase('result')}
                                className="text-gray-600 hover:text-gray-900"
                            >
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Back to Results
                            </Button>
                        </div>
                    </div>
                </div>
            </AppLayout>
        );
    }
}
