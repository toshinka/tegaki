// ===== src/stores/ProjectStore.js =====
/**
 * ProjectStore - プロジェクト状態管理
 */
export class ProjectStore {
    constructor() {
        this.projectName = 'Untitled';
        this.version = '1.0.0';
        this.created = Date.now();
    }
    
    exportState() {
        return {
            projectName: this.projectName,
            version: this.version,
            created: this.created
        };
    }
}