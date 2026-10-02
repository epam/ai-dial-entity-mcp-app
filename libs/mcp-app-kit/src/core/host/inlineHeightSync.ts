/**
 * Keeps `<html>.style.height` equal to the content height. Some hosts read
 * the iframe document height from the DOM instead of listening to
 * `ui/notifications/size-changed`, so the SDK's `autoResize` alone never
 * tells them the content shrank. Inline display mode only.
 * @param root - element whose height is synced (defaults to `<html>`)
 */
export const startInlineHeightSync = (
  root: HTMLElement = document.documentElement,
): (() => void) => {
  let frame = 0;
  const measure = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      root.style.height = 'max-content';
      root.style.height = `${Math.ceil(root.getBoundingClientRect().height)}px`;
    });
  };
  measure();
  const observer = new ResizeObserver(measure);
  observer.observe(document.body);
  return () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
    root.style.height = '';
  };
};
