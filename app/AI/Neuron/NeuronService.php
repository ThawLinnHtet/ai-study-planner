<?php

namespace App\AI\Neuron;

class NeuronService
{
    protected CleanPlannerAgent $planner;

    protected AnalyzerAgent $analyzer;

    protected CleanOptimizerAgent $optimizer;

    protected CurriculumAgent $curriculum;

    public function __construct()
    {
        $this->planner = new CleanPlannerAgent;
        $this->analyzer = new AnalyzerAgent;
        $this->optimizer = new CleanOptimizerAgent;
        $this->curriculum = new CurriculumAgent;
    }

    /**
     * Entry point for full plan generation or optimization cycle.
     */
    public function execute(array $data)
    {
        $action = $data['action'] ?? 'plan';

        return match ($action) {
            'analyze' => $this->analyzer->analyze($data),
            'optimize' => $this->optimizer->optimize($data),
            'curriculum' => $this->curriculum->generateCurriculum($data),
            default => $this->planner->createPlan($data),
        };
    }

    public function planner(): CleanPlannerAgent
    {
        return $this->planner;
    }

    public function analyzer(): AnalyzerAgent
    {
        return $this->analyzer;
    }

    public function optimizer(): CleanOptimizerAgent
    {
        return $this->optimizer;
    }

    public function curriculum(): CurriculumAgent
    {
        return $this->curriculum;
    }
}
