const fs = require('fs');

const file = 'd:/GitHub/tegaki/tegaki_work/ui/layer-panel-renderer.js';
const content = fs.readFileSync(file, 'utf8');
const lines = content.split(/\r?\n/);

let startIndex = -1;
let endIndex = -1;

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('createCafReadonlyHeader() {')) {
        startIndex = i;
    }
    if (startIndex !== -1 && i > startIndex && lines[i].includes('_getSelectedClipAssetForLayerPanel()')) {
        // Trace back to the start of the block comment
        endIndex = i - 1;
        while (endIndex > startIndex && !lines[endIndex].includes('/**')) {
            endIndex--;
        }
        break;
    }
}

if (startIndex !== -1 && endIndex !== -1) {
    const newContentLines = `    createCafReadonlyHeader() {
        const animationTable = window.PopupManager?.get?.('animationTable');
        if (!animationTable || !animationTable.model) return null;

        const tree = animationTable.model.getFrameAssetTree();
        if (!tree || tree.groups.length === 0) return null;

        const header = document.createElement('div');
        header.className = 'caf-simple-header';

        let html = '';
        const selectedCelId = animationTable.selectedCelId;

        tree.groups.forEach(group => {
            const folderName = group.folderName === 'Uncategorized' ? 'Uncategorized' : group.folderName;
            html += \`
                <div class="caf-simple-group">
                    <div class="caf-simple-group-title">[CAF] \${this._escapeHtml(folderName)}</div>
            \`;

            group.clips.forEach(clipEntry => {
                const isSelected = selectedCelId === clipEntry.clipId;
                const selectedClass = isSelected ? ' is-selected' : '';
                const clipId = this._escapeHtml(clipEntry.clipId);
                const assetId = this._escapeHtml(clipEntry.assetId);

                html += \`
                    <div class="caf-simple-asset\${selectedClass}"
                         data-clip-id="\${clipId}"
                         data-asset-id="\${assetId}"
                         title="Click to select clip in Timeline">
                        Asset for \${this._escapeHtml(clipEntry.assetName)}
                    </div>
                \`;
            });

            html += \`</div>\`;
        });

        header.innerHTML = html;
        return header;
    }
`.split('\n');

    lines.splice(startIndex, endIndex - startIndex, ...newContentLines);
    fs.writeFileSync(file, lines.join('\n'));
    console.log('Successfully replaced createCafReadonlyHeader');
} else {
    console.error('Could not find start or end index', {startIndex, endIndex});
}
