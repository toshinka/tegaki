// src/tools/toolset.js

export class BucketTool {
    constructor(app) {
        this.app = app;
    }

    fill(imageData, startX, startY, fillColor) {
        const { width, height, data } = imageData;
        startX = Math.floor(startX);
        startY = Math.floor(startY);

        const getPixelIndex = (x, y) => (y * width + x) * 4;

        const startNodeIndex = getPixelIndex(startX, startY);
        const startColor = {
            r: data[startNodeIndex],
            g: data[startNodeIndex + 1],
            b: data[startNodeIndex + 2],
            a: data[startNodeIndex + 3],
        };

        if (
            startColor.r === fillColor.r &&
            startColor.g === fillColor.g &&
            startColor.b === fillColor.b &&
            startColor.a === fillColor.a
        ) {
            return;
        }

        const queue = [[startX, startY]];
        const visited = new Set();
        visited.add(`${startX},${startY}`);

        while (queue.length > 0) {
            const [x, y] = queue.shift();
            
            const currentIndex = getPixelIndex(x, y);
            data[currentIndex] = fillColor.r;
            data[currentIndex + 1] = fillColor.g;
            data[currentIndex + 2] = fillColor.b;
            data[currentIndex + 3] = fillColor.a;

            [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].forEach(([nx, ny]) => {
                if (nx >= 0 && nx < width && ny >= 0 && ny < height && !visited.has(`${nx},${ny}`)) {
                    const neighborIndex = getPixelIndex(nx, ny);
                    if (
                        data[neighborIndex] === startColor.r &&
                        data[neighborIndex + 1] === startColor.g &&
                        data[neighborIndex + 2] === startColor.b &&
                        data[neighborIndex + 3] === startColor.a
                    ) {
                        visited.add(`${nx},${ny}`);
                        queue.push([nx, ny]);
                    }
                }
            });
        }
    }
}