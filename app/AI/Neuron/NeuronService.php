<?php

namespace App\AI\Neuron;

class NeuronService
{
    protected PlannerAgent $planner;
    protected AnalyzerAgent $analyzer;
    protected OptimizerAgent $optimizer;

    public function __construct()
    {
        $this->planner = new PlannerAgent();
        $this->analyzer = new AnalyzerAgent();
        $this->optimizer = new OptimizerAgent();
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
            default => $this->planner->createPlan($data),
        };
    }

    public function planner(): PlannerAgent { return $this->planner; }
    public function analyzer(): AnalyzerAgent { return $this->analyzer; }
    public function optimizer(): OptimizerAgent { return $this->optimizer; }
}
