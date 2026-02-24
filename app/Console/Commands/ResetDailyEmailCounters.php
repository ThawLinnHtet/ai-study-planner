<?php

namespace App\Console\Commands;

use App\Services\BehaviorEmailService;
use Illuminate\Console\Command;

class ResetDailyEmailCounters extends Command
{
    protected $signature = 'emails:reset-counters';
    protected $description = 'Reset daily email send counters for all users';

    public function handle(BehaviorEmailService $emailService): int
    {
        $emailService->resetDailyCounters();
        $this->info('Daily email counters reset.');
        return self::SUCCESS;
    }
}
