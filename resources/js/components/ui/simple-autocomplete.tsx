import * as React from 'react';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface SimpleAutocompleteProps {
    value: string;
    onValueChange: (value: string) => void;
    onSelect: (value: string) => void;
    suggestions: string[];
    placeholder?: string;
    className?: string;
    disabled?: boolean;
    onRemoveSubject?: (subject: string) => void;
    selectedSubjects?: string[];
    onClearAll?: () => void;
}

export function SimpleAutocomplete({
    value,
    onValueChange,
    onSelect,
    suggestions,
    placeholder = 'Type to search...',
    className,
    disabled = false,
    onRemoveSubject,
    selectedSubjects = [],
    onClearAll,
}: SimpleAutocompleteProps) {
    const [isOpen, setIsOpen] = React.useState(false);
    const [highlightedIndex, setHighlightedIndex] = React.useState(0);
    const inputRef = React.useRef<HTMLInputElement>(null);

    // Filter suggestions based on current input
    const filteredSuggestions = useMemo(() => {
        if (!value.trim()) return [];

        // Combine suggestions and filter out selected ones
        const allSuggestions = [...suggestions];
        const filtered = allSuggestions.filter(suggestion =>
            suggestion.toLowerCase().includes(value.toLowerCase()) &&
            !selectedSubjects.includes(suggestion)
        );

        return filtered;
    }, [suggestions, value, selectedSubjects]);

    // Handle keyboard navigation
    React.useEffect(() => {
        setHighlightedIndex(0);
    }, [filteredSuggestions.length]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isOpen || disabled) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setHighlightedIndex(prev =>
                    prev < filteredSuggestions.length - 1 ? prev + 1 : prev
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0);
                break;
            case 'Enter':
                e.preventDefault();
                if (filteredSuggestions[highlightedIndex]) {
                    onSelect(filteredSuggestions[highlightedIndex]);
                    setIsOpen(false);
                    onValueChange('');
                } else {
                    // Try to add custom
                    const trimmed = value.trim();
                    const isDuplicate = selectedSubjects.includes(trimmed);
                    const isTooShort = trimmed.length < 3;
                    const isJunk = !/[a-zA-Z0-9]/.test(trimmed);

                    if (trimmed && !isDuplicate && !isTooShort && !isJunk) {
                        handleCustomSubmit();
                        setIsOpen(false);
                        onValueChange('');
                    }
                }
                break;
            case 'Escape':
                e.preventDefault();
                setIsOpen(false);
                break;
        }
    };

    const handleSelect = (suggestion: string) => {
        if (selectedSubjects.includes(suggestion)) {
            if (onRemoveSubject) {
                onRemoveSubject(suggestion);
            }
        } else {
            onSelect(suggestion);
        }
        setIsOpen(false);
        onValueChange('');
    };

    const handleCustomSubmit = () => {
        if (value.trim()) {
            handleSelect(value.trim());
        }
    };

    return (
        <div className={cn('relative', className)}>
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    value={value}
                    onChange={(e) => onValueChange(e.target.value)}
                    onFocus={() => setIsOpen(true)}
                    onBlur={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget)) {
                            setTimeout(() => setIsOpen(false), 200);
                        }
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    disabled={disabled}
                    className={cn(
                        'w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                        'placeholder:text-muted-foreground',
                        disabled && 'cursor-not-allowed opacity-50'
                    )}
                />
            </div>

            {isOpen && (
                <div
                    className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-popover text-popover-foreground shadow-md"
                    style={{ top: '100%' }}
                >
                    {selectedSubjects.length > 0 && (
                        <>
                            <li className="border-b border-border bg-muted/60 px-3 py-2 text-xs font-semibold text-muted-foreground">
                                SELECTED SUBJECTS ({selectedSubjects.length})
                            </li>
                            {selectedSubjects.map((subject) => (
                                <li
                                    key={`selected-${subject}`}
                                    className={cn(
                                        'flex cursor-pointer items-center justify-between px-3 py-2 text-sm',
                                        'border-l-2 border-destructive/60 bg-destructive/5 hover:bg-destructive/10',
                                        'dark:border-destructive dark:bg-destructive/15 dark:hover:bg-destructive/25'
                                    )}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (onRemoveSubject) {
                                            onRemoveSubject(subject);
                                        }
                                        setIsOpen(false);
                                        onValueChange('');
                                    }}
                                    onMouseEnter={() => setHighlightedIndex(0)}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-destructive">✓</span>
                                        <span>{subject}</span>
                                    </div>
                                    <span className="text-xs font-medium text-destructive">
                                        Remove
                                    </span>
                                </li>
                            ))}
                        </>
                    )}

                    {filteredSuggestions.length > 0 && (
                        <li className="border-b border-border bg-muted/60 px-3 py-2 text-xs font-semibold text-muted-foreground">
                            SUGGESTIONS ({filteredSuggestions.length})
                        </li>
                    )}

                    {filteredSuggestions.map((suggestion, index) => {
                        const isSelected = selectedSubjects.includes(suggestion);
                        const actualIndex =
                            selectedSubjects.length > 0
                                ? index + selectedSubjects.length + 1
                                : index;

                        return (
                            <li
                                key={suggestion}
                                className={cn(
                                    'cursor-pointer px-3 py-2 text-sm',
                                    'hover:bg-accent hover:text-accent-foreground',
                                    actualIndex === highlightedIndex &&
                                    'bg-accent text-accent-foreground',
                                    isSelected && 'opacity-60'
                                )}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleSelect(suggestion);
                                }}
                                onMouseEnter={() => setHighlightedIndex(actualIndex)}
                            >
                                <div className="flex items-center justify-between">
                                    <span>{suggestion}</span>
                                    {isSelected && (
                                        <span className="text-xs font-medium text-emerald-500 dark:text-emerald-300">
                                            ✓ Added
                                        </span>
                                    )}
                                </div>
                            </li>
                        );
                    })}

                    {(() => {
                        const trimmedValue = value.trim();
                        if (!trimmedValue) return null;

                        const isDuplicate = selectedSubjects.includes(trimmedValue);
                        const isTooShort = trimmedValue.length < 3;
                        const isJunk = !/[a-zA-Z0-9]/.test(trimmedValue);
                        const isPredefined = filteredSuggestions.includes(trimmedValue);

                        if (isPredefined) return null;

                        return (
                            <li
                                className={cn(
                                    'cursor-pointer border-t border-border px-3 py-2 text-sm transition-colors',
                                    (isDuplicate || isTooShort || isJunk)
                                        ? 'bg-muted/30 cursor-not-allowed opacity-80'
                                        : 'hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                                )}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (!isDuplicate && !isTooShort && !isJunk) {
                                        handleCustomSubmit();
                                    }
                                }}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="flex items-center gap-2">
                                        <span className={cn(
                                            "flex size-4 items-center justify-center rounded-full text-[10px] font-bold",
                                            (isDuplicate || isTooShort || isJunk)
                                                ? "bg-muted text-muted-foreground"
                                                : "bg-emerald-500 text-white"
                                        )}>
                                            +
                                        </span>
                                        <span className={cn(
                                            "truncate max-w-[180px]",
                                            (isDuplicate || isTooShort || isJunk) && "text-muted-foreground"
                                        )}>
                                            Add "{trimmedValue}"
                                        </span>
                                    </span>

                                    {isDuplicate && (
                                        <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                                            Already added
                                        </span>
                                    )}
                                    {isTooShort && !isDuplicate && (
                                        <span className="text-[10px] font-medium text-muted-foreground">
                                            {trimmedValue.length}/3 chars
                                        </span>
                                    )}
                                    {isJunk && !isTooShort && !isDuplicate && (
                                        <span className="text-[10px] font-medium text-destructive">
                                            Invalid name
                                        </span>
                                    )}
                                    {!isDuplicate && !isTooShort && !isJunk && (
                                        <span className="text-[10px] font-medium text-emerald-500">
                                            New
                                        </span>
                                    )}
                                </div>
                            </li>
                        );
                    })()}

                    {selectedSubjects.length > 0 && onClearAll && (
                        <li
                            className="cursor-pointer border-t border-border px-3 py-2 text-sm hover:bg-destructive/10 dark:hover:bg-destructive/25"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onClearAll();
                                setIsOpen(false);
                                onValueChange('');
                            }}
                        >
                            <div className="flex items-center justify-center">
                                <span className="text-muted-foreground">
                                    Clear all subjects
                                </span>
                            </div>
                        </li>
                    )}
                </div>
            )}
        </div>
    );
}
