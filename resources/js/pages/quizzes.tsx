import { Head } from '@inertiajs/react';
import Heading from '@/components/heading';
import AppLayout from '@/layouts/app-layout';
import { quizzes } from '@/routes';
import type { BreadcrumbItem } from '@/types';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, XCircle, AlertCircle, Eye, RotateCcw, Loader2, BookOpen, TrendingUp, Target } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import QuizModal from '@/components/quiz-modal';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Quizzes',
        href: quizzes().url,
    },
];

interface QuizResult {
    id: number;
    quiz_id: number;
    title: string;
    subject: string;
    topic: string;
    percentage: number;
    passed: boolean;
    correct_count: number;
    incorrect_count: number;
    skipped_count: number;
    total_questions: number;
    taken_at: string;
}

interface QuizHistoryResponse {
    results: QuizResult[];
    total: number;
    passed_count: number;
    failed_count: number;
}

interface ReviewItem {
    question: string;
    options: { label: string; text: string }[];
    correct_answer: string;
    explanation: string;
    user_answer: string | null;
    is_correct: boolean;
    skipped: boolean;
}

interface QuizDetail {
    id: number;
    title: string;
    subject: string;
    topic: string;
    percentage: number;
    passed: boolean;
    correct_count: number;
    incorrect_count: number;
    skipped_count: number;
    total_questions: number;
    taken_at: string;
    review: ReviewItem[];
}

export default function Quizzes() {
    const [loading, setLoading] = useState(true);
    const [history, setHistory] = useState<QuizHistoryResponse | null>(null);
    const [selectedQuiz, setSelectedQuiz] = useState<QuizDetail | null>(null);
    const [reviewOpen, setReviewOpen] = useState(false);
    const [reviewLoading, setReviewLoading] = useState(false);

    // Retake quiz state
    const [retakeOpen, setRetakeOpen] = useState(false);
    const [retakeSubject, setRetakeSubject] = useState('');
    const [retakeTopic, setRetakeTopic] = useState('');
    const [retakeResultId, setRetakeResultId] = useState<number | null>(null);

    useEffect(() => {
        loadHistory();
    }, []);

    const loadHistory = async () => {
        setLoading(true);
        try {
            const res = await fetch('/quiz/history', {
                headers: {
                    'Accept': 'application/json',
                },
            });
            if (res.ok) {
                const data = await res.json();
                setHistory(data);
            }
        } catch {
            // Silent fail
        } finally {
            setLoading(false);
        }
    };

    const loadReview = async (id: number) => {
        setReviewLoading(true);
        try {
            const res = await fetch(`/quiz/results/${id}`, {
                headers: {
                    'Accept': 'application/json',
                },
            });
            if (res.ok) {
                const data = await res.json();
                setSelectedQuiz(data);
                setReviewOpen(true);
            }
        } catch {
            // Silent fail
        } finally {
            setReviewLoading(false);
        }
    };

    const formatDate = (isoString: string) => {
        return format(new Date(isoString), 'MMM d, yyyy');
    };

    const formatTime = (isoString: string) => {
        return format(new Date(isoString), 'h:mm a');
    };

    const handleRetake = (result: QuizResult) => {
        setRetakeSubject(result.subject);
        setRetakeTopic(result.topic);
        setRetakeResultId(result.id);
        setReviewOpen(false);
        setRetakeOpen(true);
    };

    const handleRetakePassed = () => {
        setRetakeOpen(false);
        setRetakeSubject('');
        setRetakeTopic('');
        setRetakeResultId(null);
        // Refresh history to show the new result
        loadHistory();
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Quiz History" />

            <div className="p-6 space-y-6">
                <Heading
                    title="Quiz History"
                    description="Review your quiz performance and track your learning progress"
                />

                {/* Stats Overview */}
                {history && history.total > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Total Quizzes</p>
                                        <p className="text-2xl font-bold">{history.total}</p>
                                    </div>
                                    <BookOpen className="size-5 text-muted-foreground" />
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Passed</p>
                                        <p className="text-2xl font-bold text-green-600">{history.passed_count}</p>
                                    </div>
                                    <CheckCircle2 className="size-5 text-green-600" />
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Success Rate</p>
                                        <p className="text-2xl font-bold">
                                            {history.total > 0 ? Math.round((history.passed_count / history.total) * 100) : 0}%
                                        </p>
                                    </div>
                                    <TrendingUp className="size-5 text-muted-foreground" />
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Quiz List */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Target className="size-5" />
                            Recent Quizzes
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex items-center justify-center py-12 gap-2">
                                <Loader2 className="size-5 animate-spin" />
                                <span className="text-sm text-muted-foreground">Loading quiz history...</span>
                            </div>
                        ) : !history || history.total === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 gap-3">
                                <AlertCircle className="size-10 text-muted-foreground/50" />
                                <p className="text-sm text-muted-foreground text-center">
                                    No quizzes taken yet.<br />
                                    Complete study sessions to see your quiz results here.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {history.results.map((result) => (
                                    <div
                                        key={result.id}
                                        className={cn(
                                            'p-4 rounded-lg border transition-colors',
                                            result.passed
                                                ? 'border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/30'
                                                : 'border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/30'
                                        )}
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h4 className="font-medium text-sm truncate">{result.title}</h4>
                                                    {result.passed ? (
                                                        <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200 text-xs">
                                                            Passed
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200 text-xs">
                                                            Failed
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground mb-2">
                                                    {formatDate(result.taken_at)} at {formatTime(result.taken_at)}
                                                </p>
                                                <div className="flex items-center gap-4 text-xs">
                                                    <div className="flex items-center gap-1">
                                                        <CheckCircle2 className="size-3 text-green-600" />
                                                        <span>{result.correct_count} correct</span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <XCircle className="size-3 text-red-600" />
                                                        <span>{result.incorrect_count} wrong</span>
                                                    </div>
                                                    {result.skipped_count > 0 && (
                                                        <div className="flex items-center gap-1">
                                                            <AlertCircle className="size-3 text-yellow-600" />
                                                            <span>{result.skipped_count} skipped</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex flex-col items-end gap-2">
                                                <div className="text-right">
                                                    <span className={cn(
                                                        'text-lg font-bold',
                                                        result.passed ? 'text-green-600' : 'text-red-600'
                                                    )}>
                                                        {result.percentage}%
                                                    </span>
                                                </div>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => loadReview(result.id)}
                                                    disabled={reviewLoading}
                                                >
                                                    <Eye className="size-4 mr-1" />
                                                    Review
                                                </Button>
                                            </div>
                                        </div>

                                        <Progress
                                            value={result.percentage}
                                            className={cn(
                                                'h-1.5 mt-3',
                                                result.passed ? 'bg-green-200' : 'bg-red-200'
                                            )}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Review Modal */}
            <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
                <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
                    {selectedQuiz && (
                        <>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    {selectedQuiz.passed ? (
                                        <CheckCircle2 className="size-5 text-green-600" />
                                    ) : (
                                        <XCircle className="size-5 text-red-600" />
                                    )}
                                    {selectedQuiz.title}
                                </DialogTitle>
                                <DialogDescription>
                                    {formatDate(selectedQuiz.taken_at)} — {selectedQuiz.correct_count}/{selectedQuiz.total_questions} correct ({selectedQuiz.percentage}%)
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4 mt-4">
                                {selectedQuiz.review.map((item, i) => (
                                    <div
                                        key={i}
                                        className={cn(
                                            'p-4 rounded-lg border',
                                            item.is_correct
                                                ? 'border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/30'
                                                : 'border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/30'
                                        )}
                                    >
                                        <div className="flex items-start gap-2 mb-3">
                                            <span className="font-medium text-sm">{i + 1}.</span>
                                            <p className="text-sm">{item.question}</p>
                                        </div>

                                        <div className="space-y-1 mb-3 pl-6">
                                            {item.options.map((opt) => (
                                                <div
                                                    key={opt.label}
                                                    className={cn(
                                                        'text-sm px-3 py-1.5 rounded',
                                                        opt.label === item.correct_answer
                                                            ? 'bg-green-100 text-green-800 dark:bg-green-900/50'
                                                            : opt.label === item.user_answer && !item.is_correct
                                                                ? 'bg-red-100 text-red-800 dark:bg-red-900/50'
                                                                : 'text-muted-foreground'
                                                    )}
                                                >
                                                    <span className="font-medium mr-2">{opt.label}.</span>
                                                    {opt.text}
                                                </div>
                                            ))}
                                        </div>

                                        <div className="pl-6 text-xs text-muted-foreground border-t border-border/50 pt-3">
                                            <span className="font-medium">Explanation: </span>
                                            {item.explanation}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="flex justify-end mt-6">
                                {selectedQuiz.passed === false && (
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setRetakeSubject(selectedQuiz.subject);
                                            setRetakeTopic(selectedQuiz.topic);
                                            setReviewOpen(false);
                                            setRetakeOpen(true);
                                        }}
                                        className="mr-2"
                                    >
                                        <RotateCcw className="size-4 mr-2" />
                                        Retake Quiz
                                    </Button>
                                )}
                                <Button onClick={() => setReviewOpen(false)}>Close</Button>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* Retake Quiz Modal */}
            {retakeOpen && retakeSubject && retakeTopic && (
                <QuizModal
                    open={retakeOpen}
                    onClose={() => {
                        setRetakeOpen(false);
                        setRetakeSubject('');
                        setRetakeTopic('');
                        setRetakeResultId(null);
                    }}
                    onPassed={handleRetakePassed}
                    subject={retakeSubject}
                    topic={retakeTopic}
                />
            )}
        </AppLayout>
    );
}
