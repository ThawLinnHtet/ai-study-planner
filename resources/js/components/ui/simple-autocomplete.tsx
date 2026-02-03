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
            {/* Input */}
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    value={value}
                    onChange={(e) => onValueChange(e.target.value)}
                    onFocus={() => setIsOpen(true)}
                    onBlur={(e) => {
                        // Don't close if clicking on dropdown
                        if (!e.currentTarget.contains(e.relatedTarget)) {
                            setTimeout(() => setIsOpen(false), 200);
                        }
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    disabled={disabled}
                    className={cn(
                        'w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                        disabled && 'opacity-50 cursor-not-allowed'
                    )}
                />

            </div>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute z-50 w-full mt-1 max-h-60 overflow-auto bg-white border border-gray-200 rounded-md shadow-lg" style={{ top: '100%' }}>
                    {/* Selected Subjects Section */}
                    {selectedSubjects.length > 0 && (
                        <>
                            <li className="px-3 py-2 text-xs font-semibold text-gray-500 bg-gray-50 border-b border-gray-200">
                                SELECTED SUBJECTS ({selectedSubjects.length})
                            </li>
                            {selectedSubjects.map((subject) => (
                                <li
                                    key={`selected-${subject}`}
                                    className={cn(
                                        'px-3 py-2 text-sm cursor-pointer hover:bg-red-50 border-l-2 border-red-400',
                                        'flex items-center justify-between'
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
                                        <span className="text-red-600">✓</span>
                                        <span>{subject}</span>
                                    </div>
                                    <span className="text-xs text-red-500 font-medium">Remove</span>
                                </li>
                            ))}
                        </>
                    )}

                    {/* Suggestions Section */}
                    {filteredSuggestions.length > 0 && (
                        <li className="px-3 py-2 text-xs font-semibold text-gray-500 bg-gray-50 border-b border-gray-200">
                            SUGGESTIONS ({filteredSuggestions.length})
                        </li>
                    )}

                    {filteredSuggestions.map((suggestion, index) => {
                        const isSelected = selectedSubjects.includes(suggestion);
                        const actualIndex = selectedSubjects.length > 0 ? index + selectedSubjects.length + 1 : index;

                        return (
                            <li
                                key={suggestion}
                                className={cn(
                                    'px-3 py-2 text-sm cursor-pointer hover:bg-gray-100',
                                    actualIndex === highlightedIndex && 'bg-blue-50 text-blue-900',
                                    isSelected && 'opacity-50'
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
                                        <span className="text-xs text-green-600 font-medium">✓ Added</span>
                                    )}
                                </div>
                            </li>
                        );
                    })}

                    {/* Custom subject option */}
                    {value.trim() && !filteredSuggestions.includes(value.trim()) && !selectedSubjects.includes(value.trim()) && (
                        <li
                            className={cn(
                                'px-3 py-2 text-sm cursor-pointer hover:bg-green-50 border-t border-gray-200',
                                highlightedIndex === (filteredSuggestions.length + (selectedSubjects.length > 0 ? selectedSubjects.length + 1 : 0)) && 'bg-green-50 text-green-900'
                            )}
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleCustomSubmit();
                            }}
                            onMouseEnter={() => setHighlightedIndex(filteredSuggestions.length + (selectedSubjects.length > 0 ? selectedSubjects.length + 1 : 0))}
                        >
                            <div className="flex items-center justify-between">
                                <span className="flex items-center gap-2">
                                    <span className="text-green-600">+</span>
                                    <span>Add "{value.trim()}"</span>
                                </span>
                                <span className="text-xs text-green-500 font-medium">New</span>
                            </div>
                        </li>
                    )}

                    {/* Clear all option */}
                    {selectedSubjects.length > 0 && onClearAll && (
                        <li
                            className="px-3 py-2 text-sm cursor-pointer hover:bg-red-100 border-t border-gray-200"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onClearAll();
                                setIsOpen(false);
                                onValueChange('');
                            }}
                        >
                            <div className="flex items-center justify-center">
                                <span className="text-gray-500">Clear all subjects</span>
                            </div>
                        </li>
                    )}
                </div>
            )}
        </div>
    );
}
