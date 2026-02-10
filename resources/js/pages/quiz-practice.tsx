import { Head, router, usePage } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import { ArrowLeft, BookOpen, CheckCircle2, ChevronRight, RotateCcw, XCircle, Sparkles, Target, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

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

type QuizPhase = 'loading' | 'quiz' | 'submitting' | 'result' | 'review';

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
    const [phase, setPhase] = useState<QuizPhase>('loading');
    const [quiz, setQuiz] = useState<QuizData | null>(null);
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [answers, setAnswers] = useState<(string | null)[]>([]);
    const [result, setResult] = useState<QuizResult | null>(null);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);

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

    useEffect(() => {
        generateQuiz();
    }, [subject, topic]);

    const generateQuiz = async (forceNew = false) => {
        try {
            setPhase('loading');

            // Get CSRF token from meta tag
            const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

            const response = await fetch('/quiz/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': token || '',
                },
                body: JSON.stringify({ subject, topic, forceNew }),
            });

            if (!response.ok) throw new Error('Failed to generate quiz');

            const data = await response.json();
            setQuiz(data);
            setAnswers(new Array(data.total_questions).fill(null));
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
            console.log('Submitting quiz:', {
                quiz_id: quiz.quiz_id,
                original_answers: answers,
                cleaned_answers: cleanedAnswers,
                answers_detail: cleanedAnswers.map((ans, i) => ({ index: i, value: ans, type: typeof ans })),
                total_questions: quiz.total_questions
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
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-lg font-medium text-gray-700">Generating your quiz...</p>
                    </div>
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
                    <div className="bg-white shadow-sm border-b">
                        <div className="max-w-4xl mx-auto px-4 py-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleContinue}
                                        className="text-gray-600 hover:text-gray-900"
                                    >
                                        <ArrowLeft className="w-4 h-4 mr-2" />
                                        Back to Study
                                    </Button>
                                    <div>
                                        <h1 className="text-lg font-semibold text-gray-900">{quiz.title}</h1>
                                        <p className="text-sm text-gray-500">{subject}: {topic}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <Target className="w-4 h-4" />
                                    <span className="font-medium">{currentQuestion + 1}/{quiz.total_questions}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="bg-white border-b">
                        <div className="max-w-4xl mx-auto px-4 py-3">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm text-gray-600">Progress</span>
                                <span className="text-sm font-medium text-gray-900">{Math.round(progress)}%</span>
                            </div>
                            <Progress value={progress} className="h-2" />
                        </div>
                    </div>

                    {/* Question */}
                    <div className="max-w-4xl mx-auto px-4 py-8">
                        <Card className="shadow-lg">
                            <CardContent className="p-8">
                                <div className="mb-8">
                                    <div className="flex items-start gap-3 mb-4">
                                        <div className="bg-blue-100 text-blue-600 rounded-full w-8 h-8 flex items-center justify-center font-semibold text-sm">
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
                                                    "hover:border-blue-300 hover:bg-blue-50",
                                                    isSelected && "border-blue-500 bg-blue-50",
                                                    !isSelected && "border-gray-200 bg-white"
                                                )}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="font-medium text-gray-900">{getOptionText(option)}</span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Navigation */}
                                <div className="flex items-center justify-between mt-8">
                                    <Button
                                        variant="outline"
                                        onClick={handlePrevious}
                                        disabled={currentQuestion === 0}
                                    >
                                        Previous
                                    </Button>

                                    <Button
                                        onClick={handleNext}
                                        disabled={!selectedOption}
                                        className="min-w-[120px]"
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
            </AppLayout>
        );
    }

    if (phase === 'submitting') {
        return (
            <AppLayout breadcrumbs={breadcrumbs}>
                <Head title="Submitting Quiz..." />
                <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-lg font-medium text-gray-700">Submitting your answers...</p>
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
                    <Card className="w-full max-w-2xl shadow-xl">
                        <CardContent className="p-8 text-center">
                            <div className="mb-6">
                                {result.passed ? (
                                    <>
                                        <div className="bg-green-100 text-green-600 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                                            <CheckCircle2 className="w-8 h-8" />
                                        </div>
                                        <h2 className="text-2xl font-bold text-green-900 mb-2">Excellent Work!</h2>
                                        <p className="text-gray-600">You've mastered this topic</p>
                                    </>
                                ) : (
                                    <>
                                        <div className="bg-orange-100 text-orange-600 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                                            <Target className="w-8 h-8" />
                                        </div>
                                        <h2 className="text-2xl font-bold text-orange-900 mb-2">Keep Practicing!</h2>
                                        <p className="text-gray-600">You're getting closer to mastery</p>
                                    </>
                                )}
                            </div>

                            <div className="grid grid-cols-3 gap-4 mb-8">
                                <div className="bg-white rounded-lg p-4 border">
                                    <p className="text-2xl font-bold text-gray-900">{result.percentage}%</p>
                                    <p className="text-sm text-gray-600">Score</p>
                                </div>
                                <div className="bg-white rounded-lg p-4 border">
                                    <p className="text-2xl font-bold text-green-600">{result.correct_count}</p>
                                    <p className="text-sm text-gray-600">Correct</p>
                                </div>
                                <div className="bg-white rounded-lg p-4 border">
                                    <p className="text-2xl font-bold text-red-600">{result.incorrect_count}</p>
                                    <p className="text-sm text-gray-600">Incorrect</p>
                                </div>
                            </div>

                            <div className="flex flex-col gap-3">
                                <Button
                                    variant="outline"
                                    onClick={handleReview}
                                    className="w-full"
                                >
                                    <BookOpen className="w-4 h-4 mr-2" />
                                    Review Answers
                                </Button>
                                {result.passed ? (
                                    <Button
                                        onClick={handleMarkComplete}
                                        className="w-full"
                                    >
                                        <CheckCircle2 className="w-4 h-4 mr-2" />
                                        Mark Session Complete
                                    </Button>
                                ) : (
                                    <Button
                                        onClick={handleRetry}
                                        className="w-full"
                                    >
                                        <RotateCcw className="w-4 h-4 mr-2" />
                                        Retry Quiz
                                    </Button>
                                )}
                                <Button
                                    variant="ghost"
                                    onClick={handleContinue}
                                    className="w-full text-gray-600"
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
