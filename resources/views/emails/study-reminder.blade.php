<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>{{ $reminder->title }}</title>
    <!--[if mso]>
    <noscript>
        <xml>
            <o:OfficeDocumentSettings>
                <o:PixelsPerInch>96</o:PixelsPerInch>
            </o:OfficeDocumentSettings>
        </xml>
    </noscript>
    <![endif]-->
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #1f2937;
            margin: 0;
            padding: 0;
            background-color: #f3f4f6;
            -webkit-text-size-adjust: 100%;
        }
        .wrapper {
            max-width: 600px;
            margin: 0 auto;
            padding: 24px 16px;
        }
        .card {
            background-color: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1);
        }
        .card-header {
            padding: 32px 32px 0;
            text-align: center;
        }
        .logo {
            font-size: 20px;
            font-weight: 700;
            color: #6366f1;
            letter-spacing: -0.025em;
        }
        .icon-circle {
            width: 72px;
            height: 72px;
            border-radius: 50%;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 36px;
            margin: 24px auto 16px;
        }
        .icon-circle.nudge      { background: #ede9fe; }
        .icon-circle.streak     { background: #fef3c7; }
        .icon-circle.milestone  { background: #d1fae5; }
        .icon-circle.inactivity { background: #dbeafe; }
        .icon-circle.tasks      { background: #fce7f3; }
        .icon-circle.digest     { background: #e0e7ff; }
        .icon-circle.default    { background: #f3f4f6; }

        .card-body {
            padding: 8px 32px 32px;
        }
        .title {
            font-size: 22px;
            font-weight: 700;
            color: #111827;
            margin: 0 0 12px;
            text-align: center;
            line-height: 1.3;
        }
        .message {
            font-size: 15px;
            color: #4b5563;
            text-align: center;
            margin: 0 0 24px;
            line-height: 1.7;
            white-space: pre-line;
        }

        /* Stats grid for weekly digest */
        .stats-grid {
            display: flex;
            gap: 12px;
            margin-bottom: 24px;
        }
        .stat-box {
            flex: 1;
            background: #f9fafb;
            border-radius: 12px;
            padding: 16px 12px;
            text-align: center;
        }
        .stat-value {
            font-size: 24px;
            font-weight: 700;
            color: #111827;
            display: block;
        }
        .stat-label {
            font-size: 12px;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-top: 4px;
            display: block;
        }

        /* Streak badge */
        .streak-badge {
            background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%);
            color: #fff;
            border-radius: 12px;
            padding: 20px;
            text-align: center;
            margin-bottom: 24px;
        }
        .streak-badge .number {
            font-size: 36px;
            font-weight: 800;
            display: block;
        }
        .streak-badge .label {
            font-size: 14px;
            opacity: 0.9;
        }

        /* CTA button */
        .cta-wrap {
            text-align: center;
            margin: 24px 0 8px;
        }
        .cta {
            display: inline-block;
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
            color: #ffffff !important;
            text-decoration: none;
            padding: 14px 36px;
            border-radius: 10px;
            font-weight: 600;
            font-size: 15px;
            letter-spacing: 0.01em;
        }

        /* Motivational quote */
        .quote {
            background: #f9fafb;
            border-left: 4px solid #6366f1;
            padding: 16px 20px;
            margin: 0 0 24px;
            border-radius: 0 8px 8px 0;
            font-style: italic;
            color: #6b7280;
            font-size: 14px;
        }

        /* Footer */
        .footer {
            padding: 24px 32px;
            text-align: center;
            border-top: 1px solid #f3f4f6;
        }
        .footer p {
            margin: 0 0 8px;
            font-size: 13px;
            color: #9ca3af;
        }
        .footer a {
            color: #6b7280;
            text-decoration: underline;
        }

        @media (max-width: 600px) {
            .wrapper { padding: 12px 8px; }
            .card-header, .card-body { padding-left: 20px; padding-right: 20px; }
            .stats-grid { flex-direction: column; }
            .cta { width: 100%; box-sizing: border-box; }
        }
    </style>
</head>
<body>
<div class="wrapper">
    <div class="card">
        {{-- Header --}}
        <div class="card-header">
            <div class="logo">🧠 Flux AI</div>

            @php
                $iconClass = match(true) {
                    str_contains($reminder->type, 'nudge')       => 'nudge',
                    str_contains($reminder->type, 'streak_risk') => 'streak',
                    str_contains($reminder->type, 'milestone')   => 'milestone',
                    str_contains($reminder->type, 'inactivity')  => 'inactivity',
                    str_contains($reminder->type, 'tasks')       => 'tasks',
                    str_contains($reminder->type, 'digest')      => 'digest',
                    default                                      => 'default',
                };
            @endphp
            <div class="icon-circle {{ $iconClass }}">{{ $icon }}</div>
        </div>

        {{-- Body --}}
        <div class="card-body">
            <h1 class="title">{{ $reminder->title }}</h1>

            {{-- Weekly digest stats grid --}}
            @if($reminder->type === 'weekly_digest' && !empty($reminder->payload))
                <div class="stats-grid">
                    <div class="stat-box">
                        <span class="stat-value">{{ $reminder->payload['total_sessions'] ?? 0 }}</span>
                        <span class="stat-label">Sessions</span>
                    </div>
                    <div class="stat-box">
                        @php
                            $mins = $reminder->payload['total_minutes'] ?? 0;
                            $h = floor($mins / 60);
                            $m = $mins % 60;
                        @endphp
                        <span class="stat-value">{{ $h > 0 ? $h.'h '.$m.'m' : $m.'m' }}</span>
                        <span class="stat-label">Study Time</span>
                    </div>
                    <div class="stat-box">
                        <span class="stat-value">{{ $reminder->payload['active_days'] ?? 0 }}/7</span>
                        <span class="stat-label">Active Days</span>
                    </div>
                </div>
            @endif

            {{-- Streak badge --}}
            @if($streak > 0 && in_array($reminder->type, ['streak_risk_email', 'streak_milestone_email', 'daily_nudge_email', 'weekly_digest']))
                <div class="streak-badge">
                    <span class="number">🔥 {{ $streak }}</span>
                    <span class="label">day streak</span>
                </div>
            @endif

            <div class="message">{{ $reminder->message }}</div>

            {{-- Motivational quote for inactivity & streak break --}}
            @if(in_array($reminder->type, ['inactivity_reengagement', 'streak_break_email']))
                @php
                    $quotes = [
                        "The secret of getting ahead is getting started. — Mark Twain",
                        "It does not matter how slowly you go as long as you do not stop. — Confucius",
                        "A little progress each day adds up to big results.",
                        "The expert in anything was once a beginner. — Helen Hayes",
                    ];
                @endphp
                <div class="quote">{{ $quotes[array_rand($quotes)] }}</div>
            @endif

            <div class="cta-wrap">
                <a href="{{ $actionUrl }}" class="cta">
                    @if($reminder->type === 'weekly_digest')
                        View Dashboard →
                    @elseif(str_contains($reminder->type, 'inactivity'))
                        Start Studying →
                    @elseif(str_contains($reminder->type, 'streak'))
                        Save My Streak →
                    @else
                        Continue Learning →
                    @endif
                </a>
            </div>
        </div>

        {{-- Footer --}}
        <div class="footer">
            <p>Sent to {{ $userName ?: 'you' }} because you have email reminders enabled.</p>
            <p>
                <a href="{{ config('app.url') }}/settings">Manage preferences</a> &middot;
                <a href="{{ config('app.url') }}">Open Study Planner</a>
            </p>
        </div>
    </div>
</div>
</body>
</html>
