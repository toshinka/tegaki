import { Graphics, FillStyle, StrokeStyle } from 'pixi.js';
import { IDrawingTool } from './IDrawingTool';

interface Point {
  x: number;
  y: number;
  pressure?: number;
}

export class PenTool implements IDrawingTool {
  private graphics?: Graphics;
  private brushSize: number = 3;
  private brushColor: string = '#000000';
  private brushOpacity: number = 1.0;
  private lastPoint?: Point;
  private points: Point[] = [];

  startStroke(graphics: Graphics, point: Point): void {
    this.graphics = graphics;
    this.lastPoint = point;
    this.points = [point];
    
    // Set up the drawing style using v8.11 API
    const strokeStyle: StrokeStyle = {
      color: this.brushColor,
      width: this.brushSize,
      cap: 'round',
      join: 'round',
      alpha: this.brushOpacity
    };
    
    this.graphics.stroke(strokeStyle);
    
    // Start the path
    this.graphics.moveTo(point.x, point.y);
    
    // Draw initial point
    this.graphics.circle(point.x, point.y, this.brushSize / 2);
    this.graphics.fill({ color: this.brushColor, alpha: this.brushOpacity });
  }

  continueStroke(point: Point): void {
    if (!this.graphics || !this.lastPoint) return;
    
    this.points.push(point);
    
    // Apply pressure sensitivity if available
    let currentSize = this.brushSize;
    if (point.pressure !== undefined) {
      currentSize = this.brushSize * (0.5 + point.pressure * 0.5);
    }
    
    // Use quadratic curves for smoother lines
    if (this.points.length >= 3) {
      const prevPoint = this.points[this.points.length - 3];
      const midPoint = this.points[this.points.length - 2];
      const currentPoint = point;
      
      const controlX = (prevPoint.x + midPoint.x) / 2;
      const controlY = (prevPoint.y + midPoint.y) / 2;
      
      this.graphics.quadraticCurveTo(controlX, controlY, midPoint.x, midPoint.y);
    } else {
      this.graphics.lineTo(point.x, point.y);
    }
    
    this.lastPoint = point;
  }

  endStroke(point: Point): void {
    if (!this.graphics) return;
    
    this.points.push(point);
    
    // Finish the stroke
    if (this.lastPoint) {
      this.graphics.lineTo(point.x, point.y);
    }
    
    // Reset state
    this.lastPoint = undefined;
    this.points = [];
    this.graphics = undefined;
  }

  setBrushSize(size: number): void {
    this.brushSize = Math.max(1, Math.min(100, size));
  }

  setBrushColor(color: string): void {
    this.brushColor = color;
  }

  setBrushOpacity(opacity: number): void {
    this.brushOpacity = Math.max(0, Math.min(1, opacity));
  }

  getBrushSize(): number {
    return this.brushSize;
  }

  getBrushColor(): string {
    return this.brushColor;
  }

  getBrushOpacity(): number {
    return this.brushOpacity;
  }
}