<?php

namespace App\Console\Commands;

use App\Models\AiMessage;
use Illuminate\Console\Command;
use Carbon\Carbon;

class PurgeSoftDeletedAiMessages extends Command
{
    protected $signature = 'ai:purge-deleted {--days=30 : Number of days to keep soft-deleted records}';
    
    protected $description = 'Permanently delete AI messages that have been soft-deleted for the specified number of days';
    
    public function handle(): int
    {
        $days = (int) $this->option('days');
        $cutoffDate = Carbon::now()->subDays($days);
        
        $this->info("Purging soft-deleted AI messages older than {$days} days (before {$cutoffDate->toDateTimeString()})...");
        
        // Get soft-deleted records older than cutoff date
        $messagesToPurge = AiMessage::onlyTrashed()
            ->where('deleted_at', '<', $cutoffDate)
            ->get();
            
        $count = $messagesToPurge->count();
        
        if ($count === 0) {
            $this->info('No records to purge.');
            return self::SUCCESS;
        }
        
        $this->info("Found {$count} records to purge.");
        
        // Force delete these records
        foreach ($messagesToPurge as $message) {
            $message->forceDelete();
        }
        
        $this->info("Successfully purged {$count} records.");
        
        return self::SUCCESS;
    }
}
