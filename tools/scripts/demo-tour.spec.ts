/**
 * Dora Demo Tour — High Production README GIF Recording Script
 *
 * Run with:
 *   npx playwright test tools/scripts/demo-tour.ts --headed --project=chromium
 */

import { test, Page } from '@playwright/test';

/// <reference types="node" />

// Configuration for cinematic recording
const RECORDING_WIDTH = 1200;
const RECORDING_HEIGHT = 750;
const BASE_URL = 'http://localhost:1420';

/**
 * Bezier easing for ultra-smooth cinematic movement
 */
function cubicBezier(t: number, p0: number, p1: number, p2: number, p3: number): number {
  const term1 = Math.pow(1 - t, 3) * p0;
  const term2 = 3 * Math.pow(1 - t, 2) * t * p1;
  const term3 = 3 * (1 - t) * Math.pow(t, 2) * p2;
  const term4 = Math.pow(t, 3) * p3;
  return term1 + term2 + term3 + term4;
}

/**
 * Smoothly moves the mouse cursor between two points using a Bézier curve
 */
async function smoothMove(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  durationMs: number = 800
): Promise<void> {
  const fps = 60;
  const steps = Math.floor((durationMs / 1000) * fps);
  
  // Use a slight curve for more natural movement
  const control1 = { 
    x: from.x + (to.x - from.x) * 0.3, 
    y: from.y + (to.y - from.y) * 0.1 
  };
  const control2 = { 
    x: from.x + (to.x - from.x) * 0.7, 
    y: from.y + (to.y - from.y) * 0.9 
  };

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = cubicBezier(t, from.x, control1.x, control2.x, to.x);
    const y = cubicBezier(t, from.y, control1.y, control2.y, to.y);
    await page.mouse.move(x, y);
    await page.waitForTimeout(1000 / fps);
  }
}

/**
 * Helper to click with a natural pause
 */
async function naturalClick(page: Page, element: any, currentPos: { x: number; y: number }): Promise<{ x: number; y: number }> {
    const box = await element.boundingBox();
    if (!box) {
        console.warn('Element not found for clicking, staying at', currentPos);
        return currentPos;
    }
    
    const target = { 
        x: box.x + box.width / 2, 
        y: box.y + box.height / 2 
    };
    
    await smoothMove(page, currentPos, target, 500);
    await page.waitForTimeout(200);
    await page.mouse.down();
    await page.waitForTimeout(100);
    await page.mouse.up();
    await page.waitForTimeout(200);
    return target;
}

test('Dora Demo Tour', async ({ page }) => {
  // Let the recording engine start (a small delay)
  await page.waitForTimeout(1000);
  
  // Setup viewport for clean recording
  await page.setViewportSize({ width: RECORDING_WIDTH, height: RECORDING_HEIGHT });
  
  let currentPos = { x: RECORDING_WIDTH / 2, y: RECORDING_HEIGHT / 2 };
  await page.mouse.move(currentPos.x, currentPos.y);

  // 1. App Launch
  console.log('Step 1: Launching app...');
  await page.goto(BASE_URL);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  // 2. Open Connection Switcher & New Connection
  console.log('Step 2: Connection switcher...');
  const switcher = page.locator('button').filter({ hasText: /postgresql|sqlite|demo/i }).first();
  currentPos = await naturalClick(page, switcher, currentPos);
  
  const addConn = page.getByText(/add connection|new connection/i).first();
  currentPos = await naturalClick(page, addConn, currentPos);
  await page.waitForTimeout(1000);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // 3. Switch to Analytics Platform
  console.log('Step 3: Switching connection...');
  currentPos = await naturalClick(page, switcher, currentPos);
  const analytics = page.getByText('Analytics Platform').first();
  currentPos = await naturalClick(page, analytics, currentPos);
  await page.waitForTimeout(1200);

  // 4. Sidebar Interaction
  console.log('Step 4: Sidebar context menu...');
  const firstTable = page.locator('div, span, button').filter({ hasText: /^page_views$|^customers$/ }).first();
  const tableBox = await firstTable.boundingBox();
  if (tableBox) {
    const target = { x: tableBox.x + tableBox.width / 2, y: tableBox.y + tableBox.height / 2 };
    await smoothMove(page, currentPos, target, 600);
    currentPos = target;
    await page.mouse.click(target.x, target.y, { button: 'right' });
    await page.waitForTimeout(400);
    
    const exportItem = page.getByText(/export/i).first();
    const exportBox = await exportItem.boundingBox();
    if (exportBox) {
        const exportTarget = { x: exportBox.x + exportBox.width / 2, y: exportBox.y + exportBox.height / 2 };
        await smoothMove(page, currentPos, exportTarget, 400);
        currentPos = exportTarget;
        await page.waitForTimeout(500);
    }
    
    const viewTable = page.getByText(/view table/i).first();
    currentPos = await naturalClick(page, viewTable, currentPos);
  }

    // 5. Selection
    console.log('Step 5: Row selection...');
    await page.waitForTimeout(800);
    
    // Click checkboxes for reliable selection
    const checkboxes = page.getByRole('checkbox', { name: /select row/i });
    
    // Select first row
    currentPos = await naturalClick(page, checkboxes.nth(0), currentPos);
    await page.waitForTimeout(300);

    // Ctrl+click others to show multi-selection
    await page.keyboard.down('Control');
    await naturalClick(page, checkboxes.nth(1), currentPos);
    await naturalClick(page, checkboxes.nth(2), currentPos);
    // Skip one
    await naturalClick(page, checkboxes.nth(4), currentPos);
    await page.keyboard.up('Control');
    await page.waitForTimeout(800);

    // 6. Delete
    console.log('Step 6: Deleting...');
    // The selection bar appears. Let's find the delete button in it.
    const deleteBtn = page.getByRole('button').filter({ hasText: 'Delete' }).first();
    await deleteBtn.waitFor({ state: 'visible', timeout: 8000 });
    currentPos = await naturalClick(page, deleteBtn, currentPos);
    await page.waitForTimeout(600);
    
    const confirmBtn = page.getByRole('button', { name: /confirm|delete/i }).last();
    await confirmBtn.waitFor({ state: 'visible', timeout: 5000 });
    currentPos = await naturalClick(page, confirmBtn, currentPos);
    await page.waitForTimeout(1000);

  // 7. Theme
  console.log('Step 7: Theme change...');
  const themeBtn = page.getByRole('button', { name: /all themes|theme/i }).first();
  currentPos = await naturalClick(page, themeBtn, currentPos);
  const claude = page.getByText(/claude light/i).first();
  currentPos = await naturalClick(page, claude, currentPos);
  await page.waitForTimeout(800);

  // 8. Docker
  console.log('Step 8: Docker manager...');
  const dockerNav = page.getByRole('menuitem', { name: /docker/i }).or(page.locator('[aria-label*="docker"]')).first();
  currentPos = await naturalClick(page, dockerNav, currentPos);
  
  // Final pause for the ending
  await page.waitForTimeout(2500);
});
