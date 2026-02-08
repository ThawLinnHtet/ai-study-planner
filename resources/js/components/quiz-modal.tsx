import { useState, useEffect, useCallback } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle, Loader2, RotateCcw, Trophy, AlertTriangle } from 'lucide-react';

interface QuizOption {
    label: string;
    text: string;
}

interface QuizQuestion {
    question: string;
    options: QuizOption[];
}

interface ReviewItem {
    question: string;
    options: QuizOption[];
    correct_answer: string;
    explanation: string;
    user_answer: string | null;
    is_correct: boolean;
}

interface QuizResult {
    result_id: number;
    passed: boolean;
    percentage: number;
    correct_count: number;
    incorrect_count: number;
    skipped_count: number;
    total_questions: number;
    pass_percentage: number;
    review: ReviewItem[];
}

interface QuizModalProps {
    open: boolean;
    onClose: () => void;
    onPassed: (resultId: number) => void;
    onFailed?: () => void;
    subject: string;
    topic: string;
}

type Phase = 'loading' | 'quiz' | 'submitting' | 'result';

const STORAGE_KEY = 'quiz_progress';

interface StoredQuizState {
    quizId: number;
    subject: string;
    topic: string;
    questions: QuizQuestion[];
    currentIndex: number;
    answers: Record<number, string>;
    timestamp: number;
}

function saveQuizProgress(state: StoredQuizState) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch { /* ignore storage errors */ }
}

function loadQuizProgress(subject: string, topic: string): StoredQuizState | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const state: StoredQuizState = JSON.parse(raw);
        // Only restore if same subject+topic and less than 24 hours old
        if (
            state.subject === subject &&
            state.topic === topic &&
            Date.now() - state.timestamp < 24 * 60 * 60 * 1000
        ) {
            return state;
        }
        localStorage.removeItem(STORAGE_KEY);
        return null;
    } catch {
        return null;
    }
}

function clearQuizProgress() {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch { /* ignore */ }
}

export default function QuizModal({ open, onClose, onPassed, onFailed, subject, topic }: QuizModalProps) {
    const [phase, setPhase] = useState<Phase>('loading');
    const [quizId, setQuizId] = useState<number | null>(null);
    const [questions, setQuestions] = useState<QuizQuestion[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<number, string>>({});
    const [result, setResult] = useState<QuizResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [initialized, setInitialized] = useState(false);

    const reset = (clearStorage = true) => {
        setPhase('loading');
        setQuizId(null);
        setQuestions([]);
        setCurrentIndex(0);
        setAnswers({});
        setResult(null);
        setError(null);
        setInitialized(false);
        if (clearStorage) clearQuizProgress();
    };

    const generateQuiz = useCallback(async (forceNew = false) => {
        reset(forceNew);
        setPhase('loading');

        // Try to restore from localStorage first
        if (!forceNew) {
            const saved = loadQuizProgress(subject, topic);
            if (saved) {
                setQuizId(saved.quizId);
                setQuestions(saved.questions);
                setCurrentIndex(saved.currentIndex);
                setAnswers(saved.answers);
                setPhase('quiz');
                setInitialized(true);
                return;
            }
        }

        try {
            const res = await fetch('/quiz/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({ subject, topic }),
            });

            if (!res.ok) throw new Error('Failed to generate quiz');

            const data = await res.json();
            setQuizId(data.quiz_id);
            setQuestions(data.questions);
            setPhase('quiz');
            setInitialized(true);

            // Save to localStorage immediately
            saveQuizProgress({
                quizId: data.quiz_id,
                subject,
                topic,
                questions: data.questions,
                currentIndex: 0,
                answers: {},
                timestamp: Date.now(),
            });
        } catch {
            setError('Failed to generate quiz. Please try again.');
            setPhase('quiz');
        }
    }, [subject, topic]);

    const submitQuiz = async () => {
        if (!quizId) return;
        setPhase('submitting');

        const answerArray = questions.map((_, i) => answers[i] ?? null);

        try {
            const res = await fetch('/quiz/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({ quiz_id: quizId, answers: answerArray }),
            });

            if (!res.ok) throw new Error('Failed to submit quiz');

            const data: QuizResult = await res.json();
            setResult(data);
            setPhase('result');
            clearQuizProgress();
        } catch {
            setError('Failed to submit quiz. Please try again.');
            setPhase('quiz');
        }
    };

    // Save progress to localStorage whenever answers or currentIndex change
    useEffect(() => {
        if (quizId && questions.length > 0 && phase === 'quiz') {
            saveQuizProgress({
                quizId,
                subject,
                topic,
                questions,
                currentIndex,
                answers,
                timestamp: Date.now(),
            });
        }
    }, [quizId, questions, currentIndex, answers, phase, subject, topic]);

    const handleOpenChange = (isOpen: boolean) => {
        if (!isOpen) {
            // Don't reset on close - preserve state for resuming
            onClose();
        }
    };

    // Auto-generate/restore when modal opens
    useEffect(() => {
        if (open && !initialized && phase === 'loading' && !error) {
            generateQuiz();
        }
    }, [open, initialized, phase, error, generateQuiz]);

    const currentQuestion = questions[currentIndex];
    const allAnswered = questions.length > 0 && Object.keys(answers).length === questions.length;

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent showCloseButton={phase !== 'submitting'} className="sm:max-w-lg">
                {/* Loading Phase */}
                {phase === 'loading' && (
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                        <Loader2 className="size-8 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground">Generating quiz for {topic}...</p>
                    </div>
                )}

                {/* Error State */}
                {error && phase !== 'result' && (
                    <div className="flex flex-col items-center justify-center py-8 gap-4">
                        <AlertTriangle className="size-8 text-destructive" />
                        <p className="text-sm text-destructive text-center">{error}</p>
                        <Button onClick={() => generateQuiz()} variant="outline" size="sm">
                            <RotateCcw className="size-4 mr-2" />
                            Try Again
                        </Button>
                    </div>
                )}

                {/* Quiz Phase */}
                {phase === 'quiz' && !error && currentQuestion && (
                    <>
                        <DialogHeader>
                            <DialogTitle className="text-base">
                                {subject}: {topic}
                            </DialogTitle>
                            <DialogDescription>
                                Question {currentIndex + 1} of {questions.length} — Score 75%+ to complete
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4">
                            <p className="text-sm font-medium leading-relaxed">
                                {currentQuestion.question}
                            </p>

                            <div className="space-y-2">
                                {currentQuestion.options.map((option) => (
                                    <button
                                        key={option.label}
                                        onClick={() => setAnswers({ ...answers, [currentIndex]: option.label })}
                                        className={cn(
                                            'w-full text-left px-4 py-3 rounded-lg border text-sm transition-all',
                                            'hover:border-primary/50 hover:bg-primary/5',
                                            answers[currentIndex] === option.label
                                                ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                                                : 'border-border'
                                        )}
                                    >
                                        <span className="font-medium mr-2">{option.label}.</span>
                                        {option.text}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <DialogFooter className="flex-row justify-between sm:justify-between">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                                disabled={currentIndex === 0}
                            >
                                Previous
                            </Button>

                            <div className="flex gap-2">
                                {currentIndex < questions.length - 1 ? (
                                    <Button
                                        size="sm"
                                        onClick={() => setCurrentIndex(currentIndex + 1)}
                                        disabled={!answers[currentIndex]}
                                    >
                                        Next
                                    </Button>
                                ) : (
                                    <Button
                                        size="sm"
                                        onClick={submitQuiz}
                                        disabled={!allAnswered}
                                    >
                                        Submit
                                    </Button>
                                )}
                            </div>
                        </DialogFooter>
                    </>
                )}

                {/* Submitting Phase */}
                {phase === 'submitting' && (
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                        <Loader2 className="size-8 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground">Checking your answers...</p>
                    </div>
                )}

                {/* Result Phase */}
                {phase === 'result' && result && (
                    <>
                        <DialogHeader>
                            <div className="flex flex-col items-center gap-3 py-2">
                                {result.passed ? (
                                    <Trophy className="size-10 text-yellow-500" />
                                ) : (
                                    <XCircle className="size-10 text-destructive" />
                                )}
                                <DialogTitle className="text-center">
                                    {result.passed ? 'Quiz Passed!' : 'Not Quite There'}
                                </DialogTitle>
                                <DialogDescription className="text-center">
                                    {result.correct_count}/{result.total_questions} correct ({result.percentage}%)
                                    {!result.passed && ` — Need ${result.pass_percentage}% to pass`}
                                </DialogDescription>
                            </div>
                        </DialogHeader>

                        <div className="space-y-3 max-h-60 overflow-y-auto">
                            {result.review.map((item, i) => (
                                <div
                                    key={i}
                                    className={cn(
                                        'p-3 rounded-lg border text-sm',
                                        item.is_correct
                                            ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950'
                                            : 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950'
                                    )}
                                >
                                    <div className="flex items-start gap-2">
                                        {item.is_correct ? (
                                            <CheckCircle2 className="size-4 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                                        ) : (
                                            <XCircle className="size-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                                        )}
                                        <div className="space-y-1">
                                            <p className="font-medium">{item.question}</p>
                                            {!item.is_correct && (
                                                <p className="text-xs text-muted-foreground">
                                                    Your answer: {item.user_answer ?? 'Skipped'} — Correct: {item.correct_answer}
                                                </p>
                                            )}
                                            <p className="text-xs text-muted-foreground">{item.explanation}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <DialogFooter>
                            {result.passed ? (
                                <Button
                                    onClick={() => onPassed(result.result_id)}
                                    className="w-full"
                                >
                                    <CheckCircle2 className="size-4 mr-2" />
                                    Mark Session Complete
                                </Button>
                            ) : (
                                <div className="flex gap-2 w-full">
                                    <Button
                                        variant="outline"
                                        onClick={onClose}
                                        className="flex-1"
                                    >
                                        Close
                                    </Button>
                                    {onFailed && (
                                        <Button
                                            variant="secondary"
                                            onClick={onFailed}
                                            className="flex-1"
                                        >
                                            <CheckCircle2 className="size-4 mr-2" />
                                            Complete Anyway
                                        </Button>
                                    )}
                                    <Button
                                        onClick={() => generateQuiz(true)}
                                        className="flex-1"
                                    >
                                        <RotateCcw className="size-4 mr-2" />
                                        Retry Quiz
                                    </Button>
                                </div>
                            )}
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
