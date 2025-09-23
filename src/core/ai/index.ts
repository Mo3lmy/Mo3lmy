// الوظيفة: تصدير موحد لكل خدمات AI لتجنب circular dependencies

// تصدير الأنواع أولاً
export * from './multi-agent.system';

// تصدير الخدمات
import { MultiAgentSystem } from './multi-agent.system';
import { ContentEnricherService } from './content-enricher.service';

// إنشاء instances
export const multiAgentSystem = new MultiAgentSystem();
export const contentEnricher = new ContentEnricherService();

// تصدير الكلاسات للاستخدام المباشر إذا لزم
export { MultiAgentSystem, ContentEnricherService };

// Debug logging
console.log('✅ AI Services initialized:');
console.log('   - MultiAgentSystem:', typeof multiAgentSystem);
console.log('   - ContentEnricher:', typeof contentEnricher);