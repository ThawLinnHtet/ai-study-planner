import { useForm, usePage } from '@inertiajs/react';
import { useRef } from 'react';
import type { SharedData } from '@/types';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function DeleteUser() {
    const { auth } = usePage<SharedData>().props;
    const isOAuthUser = !!auth.user.auth_provider;

    const passwordInput = useRef<HTMLInputElement>(null);
    const form = useForm({
        password: '',
    });

    return (
        <div className="space-y-6">
            <Heading
                variant="small"
                title="Delete account"
                description="Delete your account and all of its resources"
            />
            <div className="space-y-4 rounded-lg border border-red-100 bg-red-50 p-4 dark:border-red-200/10 dark:bg-red-700/10">
                <div className="relative space-y-0.5 text-red-600 dark:text-red-100">
                    <p className="font-medium">Warning</p>
                    <p className="text-sm">
                        Please proceed with caution, this cannot be undone.
                    </p>
                </div>

                <Dialog>
                    <DialogTrigger asChild>
                        <Button
                            variant="destructive"
                            data-test="delete-user-button"
                        >
                            Delete account
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogTitle>
                            Are you sure you want to delete your account?
                        </DialogTitle>
                        <DialogDescription>
                            Once your account is deleted, all of its resources
                            and data will also be permanently deleted.
                            {!isOAuthUser && ' Please enter your password to confirm you would like to permanently delete your account.'}
                        </DialogDescription>

                        <form
                            className="space-y-6"
                            onSubmit={(e) => {
                                e.preventDefault();
                                form.delete('/settings/profile', {
                                    preserveScroll: true,
                                    onError: () => passwordInput.current?.focus(),
                                    onSuccess: () => form.reset('password'),
                                });
                            }}
                        >
                            {(() => (
                                <>
                                    {!isOAuthUser && (
                                        <div className="grid gap-2">
                                            <Label
                                                htmlFor="password"
                                                className="sr-only"
                                            >
                                                Password
                                            </Label>

                                            <Input
                                                id="password"
                                                type="password"
                                                name="password"
                                                ref={passwordInput}
                                                placeholder="Password"
                                                autoComplete="current-password"
                                                value={form.data.password}
                                                onChange={(e) => form.setData('password', e.target.value)}
                                            />

                                            <InputError message={form.errors.password} />
                                        </div>
                                    )}

                                    <DialogFooter className="gap-2">
                                        <DialogClose asChild>
                                            <Button
                                                variant="secondary"
                                                onClick={() => {
                                                    form.reset('password');
                                                    form.clearErrors();
                                                }}
                                            >
                                                Cancel
                                            </Button>
                                        </DialogClose>

                                        <Button
                                            variant="destructive"
                                            disabled={form.processing}
                                            asChild
                                        >
                                            <button
                                                type="submit"
                                                data-test="confirm-delete-user-button"
                                            >
                                                Delete account
                                            </button>
                                        </Button>
                                    </DialogFooter>
                                </>
                            ))()}
                        </form>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}
