/**
 * E2E Regression Test - Complete Baby Naming Flow
 *
 * Tests the full user journey:
 * 1. Fill parent information
 * 2. Add children information (1-4 children)
 * 3. Set preferences
 * 4. Submit form and verify API response
 */

import { test, expect } from '@playwright/test';

// Mock data for testing
const MOCK_DATA = {
  fatherName: '张大明',
  motherName: '李小红',
  children: [
    {
      name: '子轩',
      gender: 'male' as const,
      birthYear: 2024,
      birthMonth: 6,
      birthDay: 15,
      birthHour: '08',
    },
    {
      name: '子涵',
      gender: 'female' as const,
      birthYear: 2025,
      birthMonth: 8,
      birthDay: 20,
      birthHour: '10',
    },
  ],
  generationChar: '子',
  stylePreference: '文雅',
  specialRequests: '希望名字有文化内涵，避免生僻字',
  phone: '13800138000',
  inviteCode: 'TEST123',
};

test.describe('Baby Naming - Complete Flow Regression Test', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app and wait for it to be fully loaded
    await page.goto('http://localhost:3001');
    await page.waitForSelector('h1', { state: 'visible' });
    // Wait for form to be interactive
    await page.waitForTimeout(500);
  });

  test('should complete the full naming flow with mock data', async ({ page }) => {
    // Step 1: Fill parent information
    await test.step('Fill parent information', async () => {
      await page.getByRole('textbox', { name: '请输入父亲姓名' }).fill(MOCK_DATA.fatherName);
      await page.getByRole('textbox', { name: '请输入母亲姓名' }).fill(MOCK_DATA.motherName);
    });

    // Step 2: Add children information
    await test.step('Add children information', async () => {
      // Wait for first child container to be visible
      await page.getByText('子女 1').waitFor({ state: 'visible' });
      await page.waitForTimeout(300);

      // First child name - use placeholder (optional field)
      const firstNameInput = page.getByPlaceholder('如家族有字辈要求可先填写，最终起名可参考').first();
      await firstNameInput.fill(MOCK_DATA.children[0].name);

      // Select gender for first child
      await page.getByRole('radio', { name: '男' }).first().check();

      // Set birth year for first child
      const yearSelects = page.locator('select').first();
      await yearSelects.selectOption(MOCK_DATA.children[0].birthYear.toString());

      // Set birth month for first child
      const monthSelects = page.locator('select').nth(1);
      await monthSelects.selectOption(MOCK_DATA.children[0].birthMonth.toString());

      // Set birth day for first child
      const daySelects = page.locator('select').nth(2);
      await daySelects.selectOption(MOCK_DATA.children[0].birthDay.toString());

      // Set birth hour for first child
      const hourSelects = page.locator('select').nth(3);
      await hourSelects.selectOption(MOCK_DATA.children[0].birthHour);

      // Add second child
      await page.getByRole('button', { name: '+ 添加子女' }).click();
      await page.waitForTimeout(500); // Wait for new child to render

      // Fill second child name
      const allNameInputs = page.getByPlaceholder('如家族有字辈要求可先填写，最终起名可参考');
      await allNameInputs.nth(1).fill(MOCK_DATA.children[1].name);

      // Select gender for second child
      const allFemaleRadios = page.getByRole('radio', { name: '女' });
      await allFemaleRadios.nth(1).check();

      // Set birth info for second child - use nth() for selects
      const allYearSelects = page.locator('select').nth(4);
      await allYearSelects.selectOption(MOCK_DATA.children[1].birthYear.toString());

      const allMonthSelects = page.locator('select').nth(5);
      await allMonthSelects.selectOption(MOCK_DATA.children[1].birthMonth.toString());

      const allDaySelects = page.locator('select').nth(6);
      await allDaySelects.selectOption(MOCK_DATA.children[1].birthDay.toString());

      const allHourSelects = page.locator('select').nth(7);
      await allHourSelects.selectOption(MOCK_DATA.children[1].birthHour);
    });

    // Step 3: Set preferences
    await test.step('Fill preferences', async () => {
      await page.getByPlaceholder('如家族有字辈要求请填写').fill(MOCK_DATA.generationChar);
      await page.getByPlaceholder('如：文雅、大气、古典等').fill(MOCK_DATA.stylePreference);
      await page.getByPlaceholder('其他特殊要求或说明').fill(MOCK_DATA.specialRequests);
      await page.getByPlaceholder('用于接收通知和找回结果').fill(MOCK_DATA.phone);
      await page.getByPlaceholder('如有邀请码请填写，解锁完整权益').fill(MOCK_DATA.inviteCode);
    });

    // Step 4: Submit form and verify
    await test.step('Submit form and verify API response', async () => {
      // Click submit button
      const submitButton = page.getByRole('button', { name: '开始起名' });
      await submitButton.scrollIntoViewIfNeeded();
      await submitButton.click();

      // Wait for network response with longer timeout
      const response = await page.waitForResponse(
        (res) => res.url().includes('/api/generate'),
        { timeout: 30000 }
      );

      const responseData = await response.json();

      // Log response for debugging
      console.log('API Response status:', response.status());
      console.log('API Response data:', JSON.stringify(responseData, null, 2));

      // Handle validation errors gracefully
      if (response.status() === 400) {
        console.log('Validation error:', responseData);
        // This is expected if invite code is invalid
        if (responseData.code === 'INVALID_INVITE_CODE') {
          console.log('Invalid invite code - this is expected for test code');
          // Retry without invite code
          await page.getByPlaceholder('如有邀请码请填写，解锁完整权益').clear();
          await submitButton.click();
          const retryResponse = await page.waitForResponse(
            (res) => res.url().includes('/api/generate'),
            { timeout: 30000 }
          );
          const retryData = await retryResponse.json();
          expect(retryData).toHaveProperty('sessionId');
          console.log('✓ Retry successful, Session ID:', retryData.sessionId);
          return;
        }
      }

      expect(response.status()).toBe(200);

      // Verify response structure
      expect(responseData).toHaveProperty('sessionId');
      expect(responseData.status).toBe('processing');
      expect(responseData.estimatedTime).toBeDefined();

      console.log('✓ Form submitted successfully');
      console.log('✓ Session ID:', responseData.sessionId);
      console.log('✓ Status:', responseData.status);
    });
  });

  test('should validate required fields', async ({ page }) => {
    // Try to submit without filling required fields
    await page.getByRole('button', { name: '开始起名' }).click();

    // Wait for validation
    await page.waitForTimeout(500);

    // Should still be on the same page (form not submitted)
    await expect(page.getByRole('textbox', { name: '请输入父亲姓名' })).toBeVisible();
  });

  test('should add and remove children correctly', async ({ page }) => {
    // Wait for page to be ready
    await page.getByText('子女信息').waitFor({ state: 'visible' });
    await page.waitForTimeout(300);

    // Add 3 children (max is 4)
    await page.getByRole('button', { name: '+ 添加子女' }).click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: '+ 添加子女' }).click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: '+ 添加子女' }).click();
    await page.waitForTimeout(300);

    // Should have 4 children now (1 default + 3 added)
    const childrenCount = await page.getByText(/子女 \d/).count();
    expect(childrenCount).toBe(4);

    // Try to add 5th child - button should be disabled, so we skip this assertion
    // The button being disabled is the expected behavior
    const addButton = page.getByRole('button', { name: '+ 添加子女' });
    await expect(addButton).toBeDisabled();

    // Remove one child
    const deleteButtons = page.getByRole('button', { name: '删除' });
    await deleteButtons.first().click();
    await page.waitForTimeout(300);

    const childrenCountAfterDelete = await page.getByText(/子女 \d/).count();
    expect(childrenCountAfterDelete).toBe(3);

    // Remove until 1 child left
    await deleteButtons.first().click();
    await page.waitForTimeout(300);
    await deleteButtons.first().click();
    await page.waitForTimeout(300);

    // Should only have 1 child left
    const finalCount = await page.getByText(/子女 \d/).count();
    expect(finalCount).toBe(1);

    // Last delete button should not exist (can't delete the last child)
    const lastDeleteButton = page.getByRole('button', { name: '删除' });
    await expect(lastDeleteButton).toHaveCount(0);
  });

  test('should format children data correctly for API', async ({ page }) => {
    // Wait for page to be ready
    await page.getByText('父母信息').waitFor({ state: 'visible' });
    await page.waitForTimeout(300);

    // Fill in the form
    await page.getByRole('textbox', { name: '请输入父亲姓名' }).fill(MOCK_DATA.fatherName);
    await page.getByRole('textbox', { name: '请输入母亲姓名' }).fill(MOCK_DATA.motherName);

    // Fill child name (optional field)
    await page.getByPlaceholder('如家族有字辈要求可先填写，最终起名可参考').first().fill('测试');

    // Select gender
    await page.getByRole('radio', { name: '男' }).first().check();

    // Set birth year
    const yearSelect = page.locator('select').first();
    await yearSelect.selectOption('2024');

    // Set birth month
    const monthSelect = page.locator('select').nth(1);
    await monthSelect.selectOption('1');

    // Set birth day
    const daySelect = page.locator('select').nth(2);
    await daySelect.selectOption('15');

    // Set birth hour
    const hourSelect = page.locator('select').nth(3);
    await hourSelect.selectOption('14');

    // Intercept the request to verify data format
    let requestBody: any = null;

    page.on('request', (request) => {
      if (request.url().includes('/api/generate')) {
        try {
          requestBody = JSON.parse(request.postData() || '{}');
        } catch (e) {
          console.error('Failed to parse request body:', e);
        }
      }
    });

    await page.getByRole('button', { name: '开始起名' }).click();

    // Wait for request to complete
    await page.waitForResponse((res) => res.url().includes('/api/generate'));
    await page.waitForTimeout(500);

    // Verify request body structure
    expect(requestBody).toBeDefined();
    expect(requestBody.fatherName).toBe(MOCK_DATA.fatherName);
    expect(requestBody.motherName).toBe(MOCK_DATA.motherName);

    // Verify children data format
    expect(requestBody.children).toBeDefined();
    expect(Array.isArray(requestBody.children)).toBe(true);
    expect(requestBody.children.length).toBe(1);

    const child = requestBody.children[0];
    expect(child.name).toBe('测试');
    expect(child.gender).toBe('male');
    // API returns birthTime without seconds (YYYY-MM-DDTHH:mm format)
    expect(child.birthTime).toBe('2024-01-15T14:00');

    console.log('✓ Children data formatted correctly:', JSON.stringify(child, null, 2));
  });
});
