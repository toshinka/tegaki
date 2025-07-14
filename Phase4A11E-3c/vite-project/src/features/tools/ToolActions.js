/**
 * [クラス責務] ToolActions.js
 * 目的：ツール設定に対するユーザー操作のロジックをカプセル化する。
 */
export class ToolActions {
    constructor(toolStore) {
        this.toolStore = toolStore;
    }

    // 変更: setTool -> selectTool
    selectTool(tool) {
        this.toolStore.setState({ tool: tool });
    }

    setColor(color, target = 'main') {
        if (target === 'main') {
            this.toolStore.setState({ mainColor: color });
        } else {
            this.toolStore.setState({ subColor: color });
        }
    }

    setSize(size) {
        this.toolStore.setState({ size: size });
    }

    changeSize(increase) {
        const currentSize = this.toolStore.getState().size;
        const step = (currentSize < 10) ? 1 : (currentSize < 50) ? 2 : 5;
        let newSize = increase ? currentSize + step : currentSize - step;
        newSize = Math.max(1, Math.min(200, newSize)); // Clamp size between 1 and 200
        this.setSize(newSize);
    }

    swapColors() {
        const { mainColor, subColor } = this.toolStore.getState();
        this.toolStore.setState({ mainColor: subColor, subColor: mainColor });
    }
    
    resetColors() {
        this.toolStore.setState({ mainColor: '#800000', subColor: '#f0e0d6' });
    }

    // Flood fill logic from toolset.js
    fill(layer, startX, startY) {
        const { mainColor } = this.toolStore.getState();
        const hexToRgba = (hex) => {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16), a: 255 } : null;
        };
        const fillColor = hexToRgba(mainColor);
        if (!layer || !fillColor) return;

        const { width, height, data } = layer.imageData;
        startX = Math.floor(startX);
        startY = Math.floor(startY);

        const getPixelIndex = (x, y) => (y * width + x) * 4;
        const startNodeIndex = getPixelIndex(startX, startY);
        const startColor = { r: data[startNodeIndex], g: data[startNodeIndex+1], b: data[startNodeIndex+2], a: data[startNodeIndex+3] };
        
        if (startColor.r === fillColor.r && startColor.g === fillColor.g && startColor.b === fillColor.b && startColor.a === fillColor.a) return;

        const queue = [[startX, startY]];
        const visited = new Set([`${startX},${startY}`]);

        while (queue.length > 0) {
            const [x, y] = queue.shift();
            const currentIndex = getPixelIndex(x, y);
            data[currentIndex] = fillColor.r;
            data[currentIndex+1] = fillColor.g;
            data[currentIndex+2] = fillColor.b;
            data[currentIndex+3] = fillColor.a;

            [[x+1,y],[x-1,y],[x,y+1],[x,y-1]].forEach(([nx,ny]) => {
                if (nx >= 0 && nx < width && ny >= 0 && ny < height && !visited.has(`${nx},${ny}`)) {
                    const neighborIndex = getPixelIndex(nx, ny);
                    if (data[neighborIndex] === startColor.r && data[neighborIndex+1] === startColor.g && data[neighborIndex+2] === startColor.b && data[neighborIndex+3] === startColor.a) {
                        visited.add(`${nx},${ny}`);
                        queue.push([nx,ny]);
                    }
                }
            });
        }
        layer.gpuDirty = true;
    }
}