import { Head, useForm } from '@inertiajs/react';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import OnboardingLayout from '@/layouts/onboarding-layout';

type Subject = {
    id: number;
    name: string;
    exam_date: string | null;
};

export default function OnboardingExamDates({
    subjects,
}: {
    subjects: Subject[];
}) {
    const form = useForm<{ exam_dates: Record<string, string | null> }>({
        exam_dates: Object.fromEntries(
            subjects.map((s) => [s.name, s.exam_date]),
        ),
    });

    return (
        <>
            <Head title="Exam Dates - Study Planner" />
            <OnboardingLayout>

                <div className="mx-auto w-full max-w-2xl p-6">
                    <Heading
                        title="Exam dates"
                        description="When are your exams? This helps our AI prioritize your study schedule."
                    />

                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            form.post('/onboarding/exam-dates');
                        }}
                    >
                        <div className="space-y-6">
                            <div className="space-y-4">
                                {subjects.map((subject) => (
                                    <div key={subject.id} className="grid gap-2">
                                        <Label
                                            htmlFor={`subject-${subject.id}`}
                                        >
                                            {subject.name}
                                        </Label>

                                        <DatePicker
                                            id={`subject-${subject.id}`}
                                            value={
                                                form.data.exam_dates[
                                                subject.name
                                                ]
                                            }
                                            onChange={(value) =>
                                                form.setData('exam_dates', {
                                                    ...form.data.exam_dates,
                                                    [subject.name]: value,
                                                })
                                            }
                                            placeholder="Pick an exam date"
                                        />
                                        <InputError
                                            message={
                                                form.errors[
                                                `exam_dates.${subject.name}` as any
                                                ]
                                            }
                                        />
                                    </div>
                                ))}
                            </div>

                            <div className="flex justify-end">
                                <Button disabled={form.processing}>Next</Button>
                            </div>
                        </div>
                    </form>
                </div>
            </OnboardingLayout>
        </>
    );
}
