export interface RenderScheduler {
  schedule: () => void;
}

export function createRenderScheduler(
  render: () => void,
  minRenderInterval = 16,
): RenderScheduler {
  let pendingRender = false;
  let lastRenderTime = 0;

  const schedule = (): void => {
    if (pendingRender) {
      return;
    }

    const now = performance.now();

    if (now - lastRenderTime < minRenderInterval) {
      pendingRender = true;

      requestAnimationFrame(() => {
        pendingRender = false;
        lastRenderTime = performance.now();
        render();
      });

      return;
    }

    lastRenderTime = now;
    render();
  };

  return { schedule };
}
