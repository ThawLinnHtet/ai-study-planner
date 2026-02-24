import { useState, useRef } from 'react';
import { useForm } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, X, Image } from 'lucide-react';
import InputError from '@/components/input-error';
import { toast } from 'sonner';

interface ProfilePictureModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentAvatar?: string | null;
    userName: string;
}

export function ProfilePictureModal({ isOpen, onClose, currentAvatar, userName }: ProfilePictureModalProps) {
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const form = useForm<{ avatar: File | null }>({
        avatar: null,
    });

    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            // Validate file type
            const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
            if (!validTypes.includes(file.type)) {
                form.setError('avatar', 'Please select a valid image file (JPEG, PNG, GIF, or WebP).');
                return;
            }

            // Validate file size (2MB)
            if (file.size > 2 * 1024 * 1024) {
                form.setError('avatar', 'Image must be smaller than 2MB.');
                return;
            }

            // Create preview
            const reader = new FileReader();
            reader.onload = (e) => {
                setPreviewImage(e.target?.result as string);
                form.setData('avatar', file);
                form.clearErrors('avatar');
            };
            reader.readAsDataURL(file);
        }
    };

    const handleUpload = () => {
        if (form.data.avatar) {
            form.post('/settings/profile/picture', {
                onSuccess: () => {
                    form.reset('avatar');
                    setPreviewImage(null);
                    onClose();
                    toast.success('Profile picture updated successfully!');
                },
                onError: (errors) => {
                    toast.error('Failed to update profile picture. Please try again.');
                }
            });
        }
    };

    const handleRemove = () => {
        form.delete('/settings/profile/picture', {
            onSuccess: () => {
                form.reset('avatar');
                setPreviewImage(null);
                onClose();
                toast.success('Profile picture removed successfully!');
            },
            onError: () => {
                toast.error('Failed to remove profile picture. Please try again.');
            }
        });
    };

    const handleClose = () => {
        form.reset('avatar');
        setPreviewImage(null);
        form.clearErrors('avatar');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Profile Picture</DialogTitle>
                    <DialogDescription>
                        Upload a new profile picture or remove your current one.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Avatar Preview */}
                    <div className="flex justify-center">
                        <div className="relative">
                            <Avatar className="h-24 w-24">
                                <AvatarImage
                                    src={previewImage || (currentAvatar ? `/storage/${currentAvatar}` : undefined)}
                                />
                                <AvatarFallback className="text-xl">
                                    {getInitials(userName)}
                                </AvatarFallback>
                            </Avatar>

                            {/* Upload button overlay */}
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    className="rounded-full opacity-0 hover:opacity-100 transition-opacity"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <Image className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* File Input */}
                    <div className="space-y-2">
                        <Label htmlFor="avatar-upload">Choose Image</Label>
                        <Input
                            id="avatar-upload"
                            type="file"
                            ref={fileInputRef}
                            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                            onChange={handleFileChange}
                            className="cursor-pointer"
                        />
                        <InputError message={form.errors.avatar} />
                        <p className="text-xs text-muted-foreground">
                            JPEG, PNG, JPG, or WebP. Maximum 2MB. Minimum 100x100 pixels for good quality.
                        </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4">
                        <Button
                            onClick={handleUpload}
                            disabled={!form.data.avatar || form.processing}
                            className="flex-1"
                        >
                            <Upload className="h-4 w-4 mr-2" />
                            {form.processing ? 'Uploading...' : 'Upload'}
                        </Button>

                        {currentAvatar && (
                            <Button
                                type="button"
                                variant="destructive"
                                onClick={handleRemove}
                                disabled={form.processing}
                            >
                                <X className="h-4 w-4 mr-2" />
                                Remove
                            </Button>
                        )}

                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleClose}
                        >
                            Cancel
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
