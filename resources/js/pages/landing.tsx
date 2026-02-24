import { Head, Link } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import LandingNav from '@/components/landing-nav';
import { register } from '@/routes';
import {
    Brain,
    Calendar,
    Target,
    TrendingUp,
    Clock,
    BookOpen,
    Award,
    Zap,
    ArrowRight,
    CheckCircle2,
    Users,
    BarChart3,
    Sparkles
} from 'lucide-react';
import { motion } from 'framer-motion';

const fadeInUp = {
    initial: { opacity: 0, y: 20 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0.6 }
};

const staggerContainer = {
    initial: { opacity: 0 },
    whileInView: { opacity: 1 },
    viewport: { once: true },
    transition: { staggerChildren: 0.1 }
};

export default function Landing() {
    return (
        <>
            <Head title="AI Study Planner - Personalized Study Plans That Work">
                <meta name="description" content="Create AI-powered study plans that adapt to your schedule, subjects, and goals. Track progress, build streaks, and achieve your learning goals faster." />
            </Head>

            {/* Navigation */}
            <div className="fixed top-0 w-full bg-white/80 dark:bg-gray-900/80 backdrop-blur-md z-50 border-b border-gray-200 dark:border-gray-700">
                <LandingNav />
            </div>

            {/* Hero Section */}
            <section className="relative bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-20 lg:py-32 pt-32 overflow-hidden">
                <div className="container mx-auto px-6">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                        className="text-center max-w-4xl mx-auto"
                    >
                        <Badge className="mb-4 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                            <Sparkles className="w-3 h-3 mr-1" />
                            AI-Powered Learning
                        </Badge>

                        <h1 className="text-4xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-6 leading-tight">
                            Study Plans That
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                                {" "}Actually Work
                            </span>
                        </h1>

                        <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto leading-relaxed">
                            Personalized AI-generated schedules that adapt to your subjects, availability, and learning pace. Build consistent habits and achieve your goals faster.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                            <Link href={register()}>
                                <Button size="lg" className="bg-black text-white hover:bg-gray-800 text-lg px-8 py-3 rounded-full transition-all hover:scale-105 active:scale-95">
                                    Start Free
                                    <ArrowRight className="ml-2 h-5 w-5" />
                                </Button>
                            </Link>
                            <div className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                                No credit card required • Free forever
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* How It Works */}
            <section className="py-20 bg-white dark:bg-gray-800 overflow-hidden">
                <div className="container mx-auto px-6">
                    <motion.div
                        {...fadeInUp}
                        className="text-center mb-16"
                    >
                        <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4">
                            How It Works
                        </h2>
                        <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
                            Get your personalized AI study plan in 4 simple steps
                        </p>
                    </motion.div>

                    <motion.div
                        variants={staggerContainer}
                        initial="initial"
                        whileInView="whileInView"
                        viewport={{ once: true }}
                        className="grid md:grid-cols-2 lg:grid-cols-4 gap-8"
                    >
                        {[
                            {
                                icon: BookOpen,
                                title: "Add Your Subjects",
                                description: "Choose from our subject library or add custom subjects you're studying"
                            },
                            {
                                icon: Clock,
                                title: "Set Your Schedule",
                                description: "Tell us when you prefer to study and how many hours per day"
                            },
                            {
                                icon: Sparkles,
                                title: "AI Curriculum",
                                description: "Our AI generates a deep-dive curriculum tailored to your difficulty level."
                            },
                            {
                                icon: Brain,
                                title: "Get AI Plan",
                                description: "Our AI creates a personalized study schedule just for you"
                            }
                        ].map((step, index) => (
                            <motion.div key={index} variants={fadeInUp}>
                                <Card className="text-center h-full border-0 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 bg-white dark:bg-gray-900/50">
                                    <CardHeader>
                                        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/50 rounded-2xl flex items-center justify-center mx-auto mb-4 rotate-3 group-hover:rotate-0 transition-transform">
                                            <step.icon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                                        </div>
                                        <div className="text-sm font-bold text-blue-600 dark:text-blue-400 mb-2 uppercase tracking-wider">
                                            Step {index + 1}
                                        </div>
                                        <CardTitle className="text-xl font-bold">{step.title}</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <CardDescription className="text-gray-600 dark:text-gray-300 text-base">
                                            {step.description}
                                        </CardDescription>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            </section>

            {/* Key Features */}
            <section className="py-20 bg-gray-50 dark:bg-gray-900 overflow-hidden">
                <div className="container mx-auto px-6">
                    <motion.div
                        {...fadeInUp}
                        className="text-center mb-16"
                    >
                        <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4">
                            Features That Help You Succeed
                        </h2>
                        <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
                            Everything you need to build consistent study habits and achieve your goals
                        </p>
                    </motion.div>

                    <motion.div
                        variants={staggerContainer}
                        initial="initial"
                        whileInView="whileInView"
                        viewport={{ once: true }}
                        className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
                    >
                        {[
                            {
                                icon: Brain,
                                title: "AI Learning Paths",
                                description: "Smart algorithms create optimal study schedules and curricula based on your learning patterns and goals",
                                highlight: true
                            },
                            {
                                icon: BookOpen,
                                title: "Multi-Subject Management",
                                description: "Balance multiple subjects efficiently with intelligent session distribution"
                            },
                            {
                                icon: BarChart3,
                                title: "Progress Tracking",
                                description: "Monitor your XP, streaks, and completion rates to stay motivated"
                            },
                            {
                                icon: Sparkles,
                                title: "AI Quiz & Practice",
                                description: "Generate custom quizzes from your study topics to reinforce your knowledge and track mastery."
                            },
                            {
                                icon: Clock,
                                title: "Flexible Scheduling",
                                description: "Set your preferred study times and let AI adapt to your availability"
                            },
                            {
                                icon: TrendingUp,
                                title: "Smart Coaching",
                                description: "Get personalized insights and adaptive tips based on your actual study patterns and consistency."
                            }
                        ].map((feature, index) => (
                            <motion.div
                                key={index}
                                variants={fadeInUp}
                                whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
                                whileTap={{ scale: 0.98 }}
                                className="cursor-pointer group h-full"
                            >
                                <Card className="h-full border-2 border-transparent transition-all duration-300 shadow-lg hover:shadow-2xl hover:border-blue-500/30 active:border-blue-500 bg-white dark:bg-gray-900/50">
                                    <CardHeader>
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:rotate-6 group-active:rotate-0 ${feature.highlight
                                            ? 'bg-gradient-to-r from-blue-500 to-purple-500 shadow-lg shadow-blue-500/20'
                                            : 'bg-gray-100 dark:bg-gray-800'
                                            }`}>
                                            <feature.icon className={`w-6 h-6 ${feature.highlight ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`} />
                                        </div>
                                        <CardTitle className="text-xl font-bold">{feature.title}</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <CardDescription className="text-gray-600 dark:text-gray-300 text-base leading-relaxed">
                                            {feature.description}
                                        </CardDescription>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            </section>

            {/* Benefits Section */}
            <section className="py-20 bg-white dark:bg-gray-800 overflow-hidden">
                <div className="container mx-auto px-6">
                    <div className="grid lg:grid-cols-2 gap-12 items-center">
                        <motion.div {...fadeInUp}>
                            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-6 uppercase tracking-tight">
                                Study Smarter, Not Harder
                            </h2>
                            <div className="space-y-6">
                                {[
                                    {
                                        icon: Zap,
                                        title: "2x More Efficient",
                                        description: "AI-optimized schedules help you learn more in less time by focusing on high-impact sessions"
                                    },
                                    {
                                        icon: Award,
                                        title: "Build Lasting Habits",
                                        description: "Consistent daily schedules and streak tracking help you maintain study discipline"
                                    },
                                    {
                                        icon: Target,
                                        title: "Achieve Goals Faster",
                                        description: "Adaptive planning ensures you stay on track with your curriculum, even if life gets in the way"
                                    }
                                ].map((benefit, index) => (
                                    <motion.div
                                        key={index}
                                        initial={{ opacity: 0, x: -20 }}
                                        whileInView={{ opacity: 1, x: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ delay: index * 0.1 }}
                                        className="flex gap-4 group"
                                    >
                                        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/50 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
                                            <benefit.icon className="w-5 h-5 text-blue-600 dark:text-blue-400 group-hover:text-white" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-900 dark:text-white mb-1">
                                                {benefit.title}
                                            </h3>
                                            <p className="text-gray-600 dark:text-gray-300">
                                                {benefit.description}
                                            </p>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.8 }}
                            className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-800/50 dark:to-gray-700/50 p-8 rounded-3xl relative overflow-hidden group shadow-2xl shadow-blue-500/10"
                        >
                            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-primary/10 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-700"></div>
                            <div className="text-center relative z-10">
                                <div className="text-5xl font-black text-blue-600 dark:text-blue-400 mb-2">
                                    10,000+
                                </div>
                                <div className="text-gray-600 dark:text-gray-300 mb-8 font-medium italic">
                                    Students using AI study plans
                                </div>
                                <div className="grid grid-cols-3 gap-4 text-center">
                                    <div>
                                        <div className="text-2xl font-black text-gray-900 dark:text-white">30</div>
                                        <div className="text-xs font-bold text-blue-600/70 uppercase tracking-tighter">Day Streaks</div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-black text-gray-900 dark:text-white">5</div>
                                        <div className="text-xs font-bold text-blue-600/70 uppercase tracking-tighter">Subjects Avg</div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-black text-gray-900 dark:text-white">2x</div>
                                        <div className="text-xs font-bold text-blue-600/70 uppercase tracking-tighter">Faster Progress</div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Final CTA */}
            <section className="py-20 bg-gradient-to-br from-blue-600 to-purple-700 text-white relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>

                <div className="container mx-auto px-6 text-center relative z-10">
                    <motion.div {...fadeInUp}>
                        <h2 className="text-4xl lg:text-5xl font-black mb-4 tracking-tight">
                            Ready to Transform Your Study Habits?
                        </h2>
                        <p className="text-xl mb-10 opacity-90 max-w-2xl mx-auto leading-relaxed">
                            Join thousands of students who are already learning more efficiently with AI-powered study plans.
                        </p>
                        <Link href={register()}>
                            <motion.div
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                <Button size="lg" className="bg-white text-blue-600 hover:bg-gray-100 text-xl font-bold px-12 py-6 rounded-full shadow-2xl shadow-black/20">
                                    Start Your Free Journey
                                    <ArrowRight className="ml-2 h-6 w-6" />
                                </Button>
                            </motion.div>
                        </Link>
                        <p className="mt-6 opacity-80 font-medium">
                            No credit card required • Free forever plan available
                        </p>
                    </motion.div>
                </div>
            </section>
        </>
    );
}
