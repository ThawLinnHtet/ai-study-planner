import { Link } from '@inertiajs/react';
import {
    BookOpen,
    Bot,
    CalendarClock,
    Folder,
    LayoutGrid,
    LineChart,
    Settings,
    SpellCheck,
} from 'lucide-react';
import { NavFooter } from '@/components/nav-footer';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import { useCurrentUrl } from '@/hooks/use-current-url';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { aiTutor, dashboard, progress, quizzes, studyPlanner } from '@/routes';
import { overview as settingsOverview } from '@/routes/settings';
import type { NavItem } from '@/types';
import AppLogo from './app-logo';

const footerNavItems: NavItem[] = [
    {
        title: 'Repository',
        href: 'https://github.com/laravel/react-starter-kit',
        icon: Folder,
    },
    {
        title: 'Documentation',
        href: 'https://laravel.com/docs/starter-kits#react',
        icon: BookOpen,
    },
];

export function AppSidebar() {
    const { currentUrl } = useCurrentUrl();

    const mainNavItems: NavItem[] = [
        {
            title: 'Dashboard',
            href: dashboard(),
            icon: LayoutGrid,
        },
        {
            title: 'Study Planner',
            href: studyPlanner(),
            icon: CalendarClock,
        },
        {
            title: 'AI Tutor',
            href: aiTutor(),
            icon: Bot,
        },
        {
            title: 'Quizzes',
            href: quizzes(),
            icon: SpellCheck,
        },
        {
            title: 'Progress',
            href: progress(),
            icon: LineChart,
        },
        {
            title: 'Settings',
            href: settingsOverview(),
            icon: Settings,
            isActive: currentUrl.startsWith('/settings'),
        },
    ];

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href={dashboard()} prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMain items={mainNavItems} />
            </SidebarContent>

            <SidebarFooter>
                <NavFooter items={footerNavItems} className="mt-auto" />
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
