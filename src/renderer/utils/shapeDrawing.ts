export function drawShape(
  ctx: CanvasRenderingContext2D,
  type: 'select' | 'ellipse' | 'arrow' | 'line' | 'rectangle',
  start: { x: number, y: number },
  end: { x: number, y: number },
  color: string,
  isSelected: boolean
) {
  if (type === 'select') return;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;
  switch (type) {
    case 'ellipse': {
      const radiusX = Math.abs(end.x - start.x);
      const radiusY = Math.abs(end.y - start.y);
      ctx.beginPath();
      ctx.ellipse(start.x, start.y, radiusX, radiusY, 0, 0, 2 * Math.PI);
      ctx.stroke();
      if (isSelected) drawEllipseHandles(ctx, start, radiusX, radiusY);
      break;
    }
    case 'rectangle': {
      const left = Math.min(start.x, end.x);
      const top = Math.min(start.y, end.y);
      const width = Math.abs(end.x - start.x);
      const height = Math.abs(end.y - start.y);
      ctx.beginPath();
      ctx.rect(left, top, width, height);
      ctx.stroke();
      if (isSelected) drawRectangleHandles(ctx, start, end);
      break;
    }
    case 'line': {
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      if (isSelected) drawLineHandles(ctx, start, end);
      break;
    }
    case 'arrow': {
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      const angle = Math.atan2(end.y - start.y, end.x - start.x);
      const headLength = 15;
      ctx.beginPath();
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(
        end.x - headLength * Math.cos(angle - Math.PI / 6),
        end.y - headLength * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        end.x - headLength * Math.cos(angle + Math.PI / 6),
        end.y - headLength * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fill();
      if (isSelected) drawLineHandles(ctx, start, end);
      break;
    }
  }
}

function drawRectangleHandles(
  ctx: CanvasRenderingContext2D,
  start: { x: number, y: number },
  end: { x: number, y: number }
) {
  const left = Math.min(start.x, end.x);
  const right = Math.max(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const bottom = Math.max(start.y, end.y);
  drawHandle(ctx, left, top);
  drawHandle(ctx, right, top);
  drawHandle(ctx, left, bottom);
  drawHandle(ctx, right, bottom);
}

function drawLineHandles(
  ctx: CanvasRenderingContext2D,
  start: { x: number, y: number },
  end: { x: number, y: number }
) {
  drawHandle(ctx, start.x, start.y);
  drawHandle(ctx, end.x, end.y);
}

function drawEllipseHandles(
  ctx: CanvasRenderingContext2D,
  center: { x: number, y: number },
  radiusX: number,
  radiusY: number
) {
  drawHandle(ctx, center.x, center.y);
  drawHandle(ctx, center.x + radiusX, center.y);
  drawHandle(ctx, center.x - radiusX, center.y);
  drawHandle(ctx, center.x, center.y - radiusY);
  drawHandle(ctx, center.x, center.y + radiusY);
}

function drawHandle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  fillColor: string = '#FFFFFF'
) {
  const handleSize = 8;
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#0000FF';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.rect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize);
  ctx.fill();
  ctx.stroke();
} 