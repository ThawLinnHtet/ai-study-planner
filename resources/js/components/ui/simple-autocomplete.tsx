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

                    {value.trim() &&
                        !filteredSuggestions.includes(value.trim()) &&
                        !selectedSubjects.includes(value.trim()) && (
                            <li
                                className={cn(
                                    'cursor-pointer border-t border-border px-3 py-2 text-sm',
                                    'hover:bg-emerald-50 dark:hover:bg-emerald-900/20',
                                    highlightedIndex ===
                                        (filteredSuggestions.length +
                                            (selectedSubjects.length > 0
                                                ? selectedSubjects.length + 1
                                                : 0)) &&
                                        'bg-emerald-50 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-100'
                                )}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleCustomSubmit();
                                }}
                                onMouseEnter={() =>
                                    setHighlightedIndex(
                                        filteredSuggestions.length +
                                            (selectedSubjects.length > 0
                                                ? selectedSubjects.length + 1
                                                : 0)
                                    )
                                }
                            >
                                <div className="flex items-center justify-between">
                                    <span className="flex items-center gap-2">
                                        <span className="text-emerald-600 dark:text-emerald-300">
                                            +
                                        </span>
                                        <span>Add "{value.trim()}"</span>
                                    </span>
                                    <span className="text-xs font-medium text-emerald-500 dark:text-emerald-300">
                                        New
                                    </span>
                                </div>
                            </li>
                        )}

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
