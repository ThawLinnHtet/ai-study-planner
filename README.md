# Flux AI Study Planner 🧠

An intelligent, adaptive study planning application built with Laravel and React. It uses AI (via Google Gemini) to generate personalized study schedules based on your goals, learning style, and available time.

## 🌟 Key Features

*   **AI-Powered Study Schedules:** Describe your goal, and Flux AI builds a structured, adaptive learning path.
*   **Dynamic Rebalancing:** Fall behind? The AI automatically recalculates and shifts your workload to keep you on track.
*   **Real-time Analytics & XP:** Earn XP for completing sessions, level up, and maintain study streaks.
*   **Behavioral Reminders:** Get smart nudges when you're inactive, or celebrate when you hit streak milestones and weekly goals.
*   **Focus Mode Quizzes:** Integrated practice quizzes with an anti-distraction interface.
*   **Modern UI:** A beautiful, responsive frontend built with React, Tailwind CSS, and Framer Motion.

## 🛠 Tech Stack

*   **Backend:** Laravel 12 (PHP 8.2+)
*   **Frontend:** React 19, Inertia.js, Tailwind CSS, shadcn/ui
*   **Database:** MySQL
*   **AI Integration:** Google Gemini 2.0 flash API from openrouter.ai

---

## 🚀 Installation Guide

Follow these steps to get the project running on your local machine.

### Prerequisites

Ensure you have the following installed:
*   [PHP 8.2+](https://www.php.net/downloads)
*   [Composer](https://getcomposer.org/)
*   [Node.js (v18+) & NPM](https://nodejs.org/)
*   Git

### Step 1: Clone the Repository

```bash
git clone <your-repository-url>
cd study-planner
```

### Step 2: Install PHP Dependencies

```bash
composer install
```

### Step 3: Set Up Environment Variables

Copy the example environment file and generate a new application key.

```bash
cp .env.example .env
php artisan key:generate
```

*Note: For Windows Command Prompt, use `copy .env.example .env` instead of `cp`.*

### Step 4: Configure the Database

By default, the application is configured for MySQL. Ensure your local MySQL server is running and create an empty database (e.g., `study_planner`).

Update the `DB_*` connection and credentials in your `.env` file:

```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=study_planner
DB_USERNAME=root
DB_PASSWORD=
```

### Step 5: Run Migrations and Seed the Database

Set up your database tables and populate them with initial data (like subjects and default settings).

```bash
php artisan migrate --seed
```

### Step 6: Configure AI API Keys

Open your `.env` file and set the Gemini AI configuration to point to OpenRouter:

```env
OPENROUTER_API_KEY=
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODE=
```

### Step 7: Configure Gmail Notifications

To send automated study reminders and behavioral notifications, configure your `.env` file to use a Gmail account. 
You will need to generate an **App Password** from your Google Account settings (Security > 2-Step Verification > App Passwords).

```env
MAIL_MAILER=smtp
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME="your-email@gmail.com"
MAIL_PASSWORD="your-16-character-app-password"
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS="your-email@gmail.com"
MAIL_FROM_NAME="${APP_NAME}"
```

### Step 8: Install Node Modules and Build Frontend

Install the necessary frontend dependencies and compile the assets.

```bash
npm install
npm run build
```

### Step 9: Start the Application

You will need two terminal windows to run the application fully during development.

**Terminal 1 (PHP Server & Frontend Hot-Reloading & Vite):**
```bash
composer run dev
```

**Terminal 3 (Background Queue for AI and Emails):**
```bash
php artisan queue:work
```

### Step 10: Access the App

Open your browser and navigate to:
`http://localhost:8000`

---

## 🎮 Testing Behavioral Notifications

To test the automated email and in-app reminder system on your local machine:

1. Create a user account via the web interface.
2. Run the test command to evaluate behavior triggers:
   ```bash
   php artisan emails:test-behavior --user=1
   ```
3. Process the queued notifications:
   ```bash
   php artisan reminders:send
   php artisan queue:work
   ```
