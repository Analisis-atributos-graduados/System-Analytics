export class StepIndicatorComponent {
    constructor(steps, currentStep) {
        this.steps = steps;
        this.currentStep = currentStep;
    }

    render() {
        const stepsHTML = this.steps.map((step, index) => {
            const isCompleted = index < this.currentStep;
            const isCurrent = index === this.currentStep;
            
            return `
                <div class="step ${isCompleted ? 'completed' : ''} ${isCurrent ? 'active' : ''}">
                    <div class="step-number">${index + 1}</div>
                    <div class="step-label">${step}</div>
                </div>
            `;
        }).join('');

        return `
            <div class="step-indicator">
                ${stepsHTML}
            </div>
        `;
    }
}
