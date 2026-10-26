import type { KeyboardEvent } from "react";

/**
 * The WAI-ARIA radio-group pattern: Tab reaches the group once, arrow keys
 * move between options and select them, Home/End jump to the ends. Without
 * it every option is a separate Tab stop and arrows do nothing — which is
 * what a screen-reader user expects a radio group to do.
 */
export function radioKeyDown(e: KeyboardEvent<HTMLElement>) {
  const forward = e.key === "ArrowRight" || e.key === "ArrowDown";
  const back = e.key === "ArrowLeft" || e.key === "ArrowUp";
  if (!forward && !back && e.key !== "Home" && e.key !== "End") return;
  const group = e.currentTarget.closest('[role="radiogroup"]');
  if (!group) return;
  const radios = [...group.querySelectorAll<HTMLElement>('[role="radio"]:not([disabled])')];
  const i = radios.indexOf(e.currentTarget);
  if (i < 0 || radios.length === 0) return;
  const next = e.key === "Home" ? 0 : e.key === "End" ? radios.length - 1 : (i + (forward ? 1 : -1) + radios.length) % radios.length;
  e.preventDefault();
  radios[next].focus();
  radios[next].click();
}

/** Only the selected option — or the first, when nothing is selected yet — sits in the Tab order. */
export const rovingTabIndex = (active: boolean, index: number, anyActive: boolean) => (active || (!anyActive && index === 0) ? 0 : -1);
