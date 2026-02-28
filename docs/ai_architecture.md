# Neuron AI Architecture

Flux AI uses a custom AI orchestration layer called **Neuron AI**. This system ensures that LLM responses are reliable, structured, and integrated into the PHP backend.

---

## 🏗 System Components

### 1. The Provider Layer
**File:** `app/AI/Providers/OpenRouter.php`
Flux AI communicates with **Gemini 2.0 Flash** via OpenRouter. This provides high speed and a large context window for complex schedule generation.

### 2. The Agent Pattern
**Folder:** `app/AI/Neuron/`
Each AI capability is encapsulated in an **Agent** class.

*   **`CleanPlannerAgent`**: Uses a complex prompt to arrange sessions without overlaps, respecting focus-level capacities.
*   **`QuizAgent`**: Uses high-entropy randomization seeds (`microtime` + `rand`) to ensure that every quiz for a topic is unique.
*   **`CurriculumAgent`**: Responsible for breaking a subject down into a day-by-day progression.

### 3. Structured Output (The DTO Pattern)
**Folder:** `app/AI/Neuron/Output/`
To prevent the application from crashing due to "creative" AI formatting, every agent uses a **Structured Output Class**.

**Workflow:**
1.  The Agent sends a prompt.
2.  The response is stripped of Markdown (```json).
3.  The JSON is decoded into a PHP array.
4.  The system maps array keys to properties on a class (e.g., `PlannerOutput.php`).
5.  If a required field (like `schedule`) is missing, an exception is thrown early.

---

## 🛠 Randomization & Uniqueness

A key feature of Flux AI's agents (especially the `QuizAgent`) is the **Context Hash**.
When generating a quiz, the agent injects a `randomSeed` and `contextHash` into the prompt. It explicitly tells the AI:
> "This is request #12345. Use context hash XYZ to ensure you do NOT repeat previous questions."

This forces the LLM to explore different sub-topics and scenarios even for the same subject.

---

## 📊 Output Mapping Reference

| Agent | Main Logic | Primary Output |
| :--- | :--- | :--- |
| **Planner** | Balancing focus levels & durations | `schedule` (Day => Sessions) |
| **Quiz** | Topic breakdown & distractor generation | `questions` (Array of Q/A/Exp) |
| **Analyzer** | Gap detection & performance review | `weak_topics` & `stagnant_subjects` |
| **Optimizer** | Time allocation adjustment | `optimized_schedule` |
