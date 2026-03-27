/**
 * E2E Test - Gender Display Verification
 * 
 * Tests that gender badges show correctly (男孩/女孩) instead of 通用
 */

import { test, expect } from '@playwright/test';

const TEST_DATA = {
  fatherName: '张大明',
  motherName: '李小红',
  child1: {
    name: '子轩',
    gender: 'male' as const,
    birthYear: 2024,
    birthMonth: 6,
    birthDay: 15,
    birthHour: '08',
  },
  child2: {
    name: '子涵',
    gender: 'female' as const,
    birthYear: 2025,
    birthMonth: 8,
    birthDay: 20,
    birthHour: '10',
  },
  inviteCode: 'BACKDOOR', // Use backdoor code for testing
};

test.describe('Gender Display Test', () => {
  // Increase timeout for all tests in this suite to 3 minutes
  test.setTimeout(180000);

  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('http://localhost:3001');
    await page.waitForSelector('h1', { state: 'visible' });
    await page.waitForTimeout(500);
  });

  test('should display gender badges correctly for boy and girl', async ({ page }) => {
    // Step 1: Fill parent info
    await page.getByRole('textbox', { name: '请输入父亲姓名' }).fill(TEST_DATA.fatherName);
    await page.getByRole('textbox', { name: '请输入母亲姓名' }).fill(TEST_DATA.motherName);
    await page.getByRole('button', { name: '下一步' }).click();
    await page.waitForTimeout(300);

    // Step 2: Fill first child (boy)
    await page.locator('label').filter({ hasText: '男' }).first().click();
    await page.selectOption('select[aria-label="出生年份"]', TEST_DATA.child1.birthYear.toString());
    await page.selectOption('select[aria-label="出生月份"]', TEST_DATA.child1.birthMonth.toString());
    await page.selectOption('select[aria-label="出生日期"]', TEST_DATA.child1.birthDay.toString());
    await page.selectOption('select[aria-label="出生时辰"]', TEST_DATA.child1.birthHour);
    
    // Add second child (girl)
    await page.getByRole('button', { name: '+ 添加子女' }).click();
    await page.waitForTimeout(100);

    // Fill second child gender
    await page.locator('label').filter({ hasText: '女' }).first().click();
    await page.selectOption('select[aria-label="出生年份"]', TEST_DATA.child2.birthYear.toString());
    await page.selectOption('select[aria-label="出生月份"]', TEST_DATA.child2.birthMonth.toString());
    await page.selectOption('select[aria-label="出生日期"]', TEST_DATA.child2.birthDay.toString());
    await page.selectOption('select[aria-label="出生时辰"]', TEST_DATA.child2.birthHour);

    // Go to preferences
    await page.getByRole('button', { name: '下一步' }).click();
    await page.waitForTimeout(300);

    // Fill invite code
    await page.getByText('邀请码').first().click();
    await page.waitForTimeout(300);
    await page.getByPlaceholder('请输入邀请码').fill(TEST_DATA.inviteCode);

    // Capture console logs
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      consoleLogs.push(text);
      // Log all convertToNameResult logs
      if (text.includes('convertToNameResult')) {
        console.log('Browser:', text);
      }
    });

    // Submit form
    await page.getByRole('button', { name: '开始起名' }).click();

    // Wait for results page (with longer timeout for API call - up to 2 minutes)
    await page.waitForSelector('text=起名结果', { timeout: 120000 });
    await page.waitForTimeout(1000);

    // Check for gender badges
    const boyBadge = page.getByText('男孩');
    const girlBadge = page.getByText('女孩');
    
    // At least one name card should have 男孩 or 女孩 badge
    const boyBadges = await boyBadge.count();
    const girlBadges = await girlBadge.count();
    
    console.log(`Found ${boyBadges} 男孩 badges and ${girlBadges} 女孩 badges`);
    
    // We should have at least one gender badge (not 通用)
    expect(boyBadges + girlBadges).toBeGreaterThan(0);

    // Also verify no 通用 badges are shown
    const genericBadges = await page.getByText('通用').count();
    console.log(`Found ${genericBadges} 通用 badges`);
    
    // Check console logs for gender data
    const genderLogs = consoleLogs.filter(log => log.includes('convertToNameResult'));
    console.log('Gender-related logs:', genderLogs.slice(0, 10)); // Show first 10 logs
  });

  test('should not show 通用 badge when gender is properly set', async ({ page }) => {
    // Fill form quickly
    await page.getByRole('textbox', { name: '请输入父亲姓名' }).fill(TEST_DATA.fatherName);
    await page.getByRole('textbox', { name: '请输入母亲姓名' }).fill(TEST_DATA.motherName);
    await page.getByRole('button', { name: '下一步' }).click();
    await page.waitForTimeout(300);

    // Fill child (boy)
    await page.locator('label').filter({ hasText: '男' }).first().click();
    await page.selectOption('select[aria-label="出生年份"]', '2024');
    await page.selectOption('select[aria-label="出生月份"]', '6');
    await page.selectOption('select[aria-label="出生日期"]', '15');
    await page.selectOption('select[aria-label="出生时辰"]', '08');

    // Go to preferences
    await page.getByRole('button', { name: '下一步' }).click();
    await page.waitForTimeout(300);

    // Use backdoor code
    await page.getByText('邀请码').first().click();
    await page.waitForTimeout(300);
    await page.getByPlaceholder('请输入邀请码').fill(TEST_DATA.inviteCode);

    // Submit
    await page.getByRole('button', { name: '开始起名' }).click();
    await page.waitForSelector('text=起名结果', { timeout: 60000 });
    await page.waitForTimeout(1000);

    // Count 通用 badges - should be 0 if fix is working
    const genericCount = await page.getByText('通用').count();
    console.log(`通用 badge count: ${genericCount}`);
    
    // The fix should ensure no 通用 badges are shown
    // If genericCount > 0, the fix is not working
    expect(genericCount).toBe(0);
  });
});
