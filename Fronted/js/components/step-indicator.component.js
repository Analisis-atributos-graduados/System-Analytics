export class StepIndicatorComponent {
    constructor(steps, currentStep) {
        this.steps = steps;
        this.currentStep = currentStep;
    }

    render() {
        const stepsHTML = this.steps.map((step, index) => {
            let status = 'pending';
            if (index < this.currentStep) status = 'completed';
            if (index === this.currentStep) status = 'active';

            return `
                <div class="step ${status}">
                    <div class="step-icon">${step.icon}</div>
                    <div class="step-text">
                        <span class="step-label">Paso ${index + 1}</span>
                        <span class="step-title">${step.title}</span>
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div class="steps">
                ${stepsHTML}
            </div>
        `;
    }
}