// 📍 المكان: src/core/video/enhanced-slide.generator.ts
// الوظيفة: توسيع SlideGenerator لدعم المعادلات الرياضية التفاعلية

import { EnhancedSlideGenerator as BaseSlideGenerator } from './slide.generator';
import { latexRenderer, MathStep, type MathExpression } from '../interactive/math/latex-renderer';
import type { SlideContent } from './slide.generator';
// If SlideTheme is needed, define it here or import from the correct module:
// export type SlideTheme = 'default' | 'dark' | 'light'; // Example definition
type SlideTheme = 'default' | 'dark' | 'light';

// ============= EXTENDED TYPES =============

export interface MathSlideContent extends SlideContent {
  mathExpressions?: MathExpression[];
  showSteps?: boolean;
  interactive?: boolean;
  mathLayout?: 'single' | 'grid' | 'vertical';
}

export interface MathSlideOptions {
  enableInteractivity?: boolean;
  showSolveButton?: boolean;
  autoPlaySteps?: boolean;
  stepDelay?: number; // milliseconds
}

// ============= ENHANCED SLIDE GENERATOR =============

export class MathEnabledSlideGenerator extends BaseSlideGenerator {
  private mathOptions: MathSlideOptions = {
    enableInteractivity: true,
    showSolveButton: true,
    autoPlaySteps: false,
    stepDelay: 2000,
  };

  constructor() {
    super();
  }

  /**
   * توليد شريحة معادلة رياضية
   */
  async generateMathSlide(
    content: MathSlideContent,
    theme: SlideTheme = 'default',
    options?: MathSlideOptions
  ): Promise<string> {
    const opts = { ...this.mathOptions, ...options };
    
    // إضافة styles خاصة بالرياضيات
    const mathStyles = latexRenderer.getStyles();
    
    let html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${content.title || 'معادلة رياضية'}</title>
        ${this.getBaseStyles(theme)}
        ${mathStyles}
        <style>
          .math-slide {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            padding: 40px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          }
          
          .math-slide-header {
            text-align: center;
            margin-bottom: 30px;
          }
          
          .math-slide-title {
            font-size: 2.5em;
            color: white;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
          }
          
          .math-slide-subtitle {
            font-size: 1.2em;
            color: rgba(255,255,255,0.9);
          }
          
          .math-content {
            background: white;
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            max-width: 900px;
            margin: 0 auto;
            width: 100%;
          }
          
          .math-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin: 20px 0;
          }
          
          .math-vertical {
            display: flex;
            flex-direction: column;
            gap: 20px;
          }
          
          .math-card {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 10px;
            border-right: 4px solid #667eea;
          }
          
          .math-explanation {
            margin-top: 20px;
            padding: 20px;
            background: #e8f4f8;
            border-radius: 10px;
            color: #2c3e50;
          }
          
          .interactive-hint {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 15px 20px;
            border-radius: 30px;
            font-size: 0.9em;
            animation: pulse 2s infinite;
          }
          
          @keyframes pulse {
            0%, 100% { opacity: 0.8; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.05); }
          }
        </style>
      </head>
      <body>
        <div class="math-slide">
          <div class="math-slide-header">
            <h1 class="math-slide-title">${content.title || 'معادلات رياضية'}</h1>
            ${content.subtitle ? `<p class="math-slide-subtitle">${content.subtitle}</p>` : ''}
          </div>
          
          <div class="math-content">
    `;
    
    // إضافة المعادلات
    if (content.mathExpressions && content.mathExpressions.length > 0) {
      html += this.renderMathExpressions(content.mathExpressions, content.mathLayout || 'single', opts);
    }
    
    // إضافة النص التوضيحي
    if (content.text) {
      html += `
        <div class="math-explanation">
          <h3>الشرح:</h3>
          <p>${content.text}</p>
        </div>
      `;
    }
    
    // إضافة تلميح التفاعل
    if (opts.enableInteractivity) {
      html += `
        <div class="interactive-hint">
          💡 اضغط على المعادلات للتفاعل معها
        </div>
      `;
    }
    
    html += `
          </div>
        </div>
        ${latexRenderer.getScripts()}
        ${this.getAutoPlayScript(opts)}
      </body>
      </html>
    `;
    
    return html;
  }

  /**
   * عرض مجموعة معادلات
   */
  private renderMathExpressions(
    expressions: MathExpression[],
    layout: string,
    options: MathSlideOptions
  ): string {
    let html = '';
    
    const containerClass = layout === 'grid' ? 'math-grid' : 
                           layout === 'vertical' ? 'math-vertical' : '';
    
    if (containerClass) {
      html += `<div class="${containerClass}">`;
    }
    
    for (const expr of expressions) {
      if (options.enableInteractivity && expr.isInteractive) {
        html += latexRenderer.renderInteractiveExpression(expr);
      } else if (expr.steps && expr.steps.length > 0) {
        html += latexRenderer.renderWithSteps(expr, { showSteps: true });
      } else {
        html += latexRenderer.renderExpression(expr.latex, {
          displayMode: true,
          fontSize: 'large',
          enableZoom: true,
        });
      }
    }
    
    if (containerClass) {
      html += '</div>';
    }
    
    return html;
  }

  /**
   * توليد شريحة مسألة رياضية
   */
  async generateMathProblemSlide(
    problem: {
      title: string;
      question: string;
      equation?: string;
      hints?: string[];
      solution?: string;
      steps?: MathStep[];
    },
    theme: SlideTheme = 'default'
  ): Promise<string> {
    const mathExpression: MathExpression = {
      id: 'problem',
      latex: problem.equation || '',
      description: problem.question,
      type: 'equation',
      isInteractive: true,
      steps: problem.steps,
    };
    
    let html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>${problem.title}</title>
        ${this.getBaseStyles(theme)}
        ${latexRenderer.getStyles()}
        <style>
          .problem-slide {
            min-height: 100vh;
            padding: 40px;
            background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
            display: flex;
            align-items: center;
            justify-content: center;
          }
          
          .problem-card {
            background: white;
            border-radius: 20px;
            padding: 40px;
            max-width: 800px;
            width: 100%;
            box-shadow: 0 20px 60px rgba(0,0,0,0.2);
          }
          
          .problem-title {
            font-size: 2em;
            color: #2d3748;
            margin-bottom: 20px;
            text-align: center;
          }
          
          .problem-question {
            font-size: 1.3em;
            color: #4a5568;
            margin-bottom: 30px;
            padding: 20px;
            background: #f7fafc;
            border-radius: 10px;
            border-right: 4px solid #48bb78;
          }
          
          .problem-equation {
            margin: 30px 0;
            text-align: center;
          }
          
          .problem-hints {
            margin-top: 30px;
            padding: 20px;
            background: #fef5e7;
            border-radius: 10px;
          }
          
          .hint-item {
            margin: 10px 0;
            padding-right: 20px;
            position: relative;
          }
          
          .hint-item::before {
            content: "💡";
            position: absolute;
            right: 0;
          }
          
          .solution-section {
            margin-top: 30px;
            padding: 20px;
            background: #e6fffa;
            border-radius: 10px;
            display: none;
          }
          
          .solution-section.show {
            display: block;
            animation: slideDown 0.5s ease;
          }
          
          @keyframes slideDown {
            from { opacity: 0; transform: translateY(-20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          
          .action-buttons {
            margin-top: 30px;
            display: flex;
            gap: 15px;
            justify-content: center;
          }
          
          .btn {
            padding: 12px 30px;
            border: none;
            border-radius: 8px;
            font-size: 1.1em;
            cursor: pointer;
            transition: all 0.3s;
            font-weight: bold;
          }
          
          .btn-hint {
            background: #fbbf24;
            color: #78350f;
          }
          
          .btn-solve {
            background: #48bb78;
            color: white;
          }
          
          .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
          }
        </style>
      </head>
      <body>
        <div class="problem-slide">
          <div class="problem-card">
            <h2 class="problem-title">${problem.title}</h2>
            
            <div class="problem-question">
              ${problem.question}
            </div>
            
            ${problem.equation ? `
              <div class="problem-equation">
                ${latexRenderer.renderExpression(problem.equation, {
                  displayMode: true,
                  fontSize: 'xlarge',
                  enableZoom: true,
                })}
              </div>
            ` : ''}
            
            ${problem.hints && problem.hints.length > 0 ? `
              <div class="problem-hints" id="hints" style="display: none;">
                <h3>تلميحات:</h3>
                ${problem.hints.map(hint => `
                  <div class="hint-item">${hint}</div>
                `).join('')}
              </div>
            ` : ''}
            
            ${problem.solution ? `
              <div class="solution-section" id="solution">
                <h3>الحل:</h3>
                ${problem.steps ? 
                  latexRenderer.renderWithSteps(mathExpression, { showSteps: true }) :
                  `<p>${problem.solution}</p>`
                }
              </div>
            ` : ''}
            
            <div class="action-buttons">
              ${problem.hints ? `
                <button class="btn btn-hint" onclick="toggleHints()">
                  عرض التلميحات
                </button>
              ` : ''}
              ${problem.solution ? `
                <button class="btn btn-solve" onclick="toggleSolution()">
                  عرض الحل
                </button>
              ` : ''}
            </div>
          </div>
        </div>
        
        <script>
          function toggleHints() {
            const hints = document.getElementById('hints');
            hints.style.display = hints.style.display === 'none' ? 'block' : 'none';
          }
          
          function toggleSolution() {
            const solution = document.getElementById('solution');
            solution.classList.toggle('show');
          }
        </script>
      </body>
      </html>
    `;
    
    return html;
  }

  /**
   * توليد شريحة مقارنة معادلات
   */
  async generateComparisonSlide(
    equations: Array<{
      title: string;
      latex: string;
      description: string;
      color?: string;
    }>,
    theme: SlideTheme = 'default'
  ): Promise<string> {
    let html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>مقارنة المعادلات</title>
        ${this.getBaseStyles(theme)}
        ${latexRenderer.getStyles()}
        <style>
          .comparison-slide {
            min-height: 100vh;
            padding: 40px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          }
          
          .comparison-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 30px;
            max-width: 1200px;
            margin: 40px auto;
          }
          
          .equation-card {
            background: white;
            padding: 30px;
            border-radius: 15px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            transition: all 0.3s;
            border-top: 5px solid var(--card-color, #667eea);
          }
          
          .equation-card:hover {
            transform: translateY(-10px);
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          }
          
          .equation-title {
            font-size: 1.5em;
            color: #2d3748;
            margin-bottom: 20px;
          }
          
          .equation-latex {
            margin: 20px 0;
            text-align: center;
          }
          
          .equation-description {
            color: #718096;
            line-height: 1.6;
          }
        </style>
      </head>
      <body>
        <div class="comparison-slide">
          <h1 style="text-align: center; color: white; font-size: 3em; margin-bottom: 40px;">
            مقارنة المعادلات
          </h1>
          
          <div class="comparison-grid">
            ${equations.map(eq => `
              <div class="equation-card" style="--card-color: ${eq.color || '#667eea'};">
                <h3 class="equation-title">${eq.title}</h3>
                <div class="equation-latex">
                  ${latexRenderer.renderExpression(eq.latex, {
                    displayMode: true,
                    fontSize: 'large',
                  })}
                </div>
                <p class="equation-description">${eq.description}</p>
              </div>
            `).join('')}
          </div>
        </div>
      </body>
      </html>
    `;
    
    return html;
  }

  /**
   * Helper: الحصول على الأنماط الأساسية
   */
  private getBaseStyles(theme: SlideTheme): string {
    // يمكن استيراد الأنماط من SlideGenerator الأصلي
    return `
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Cairo', sans-serif;
          overflow-x: hidden;
        }
      </style>
    `;
  }

  /**
   * Helper: سكريبت التشغيل التلقائي للخطوات
   */
  private getAutoPlayScript(options: MathSlideOptions): string {
    if (!options.autoPlaySteps) return '';
    
    return `
      <script>
        window.addEventListener('load', function() {
          const steps = document.querySelectorAll('.math-step');
          let currentStep = 0;
          
          function showNextStep() {
            if (currentStep < steps.length) {
              steps[currentStep].style.display = 'block';
              steps[currentStep].style.animation = 'slideDown 0.5s ease';
              currentStep++;
              
              setTimeout(showNextStep, ${options.stepDelay || 2000});
            }
          }
          
          // إخفاء كل الخطوات
          steps.forEach(step => step.style.display = 'none');
          
          // بدء العرض
          setTimeout(showNextStep, 1000);
        });
      </script>
    `;
  }
}

// Export enhanced generator
export const mathSlideGenerator = new MathEnabledSlideGenerator();