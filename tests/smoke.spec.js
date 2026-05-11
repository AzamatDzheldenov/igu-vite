import { expect, test } from '@playwright/test'

const smmCredentials = {
  login: 'smm',
  password: 'smm123',
}

test('homepage opens', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: /Колледж ИГУ/i })).toBeVisible()
  await expect(page.getByRole('navigation', { name: /Основная навигация/i }).first()).toBeVisible()
})

test('navigation works', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Абитуриентам' }).first().click()

  await expect(page).toHaveURL(/\/applicants$/)
  await expect(page.getByRole('heading', { name: /Выберите программу/i })).toBeVisible()
})

test('applicants form submits', async ({ page }) => {
  await page.goto('/applicants')

  await page.getByLabel('Имя').fill('Тестовый Абитуриент')
  await page.getByLabel('Телефон').fill('+996 700 123 456')
  await page.getByLabel('Почта').fill(`applicant-${Date.now()}@example.com`)
  await page.getByLabel('Программа').selectOption({ index: 1 })
  await page.getByLabel('Комментарий').fill('Production smoke test')
  await page.getByRole('button', { name: /Отправить заявку/i }).click()

  await expect(page.getByText(/Заявка отправлена/i)).toBeVisible()
})

test('admin login page opens', async ({ page }) => {
  await page.goto('/admin-login')

  await expect(page.getByRole('heading', { name: 'Админ-панель' })).toBeVisible()
  await expect(page.getByLabel('Логин')).toBeVisible()
})

test('smm cannot access applications export', async ({ request }) => {
  const loginResponse = await request.post('/api/auth/login', {
    data: smmCredentials,
  })
  expect(loginResponse.ok()).toBeTruthy()

  const exportResponse = await request.get('/api/admin/applications/export.csv')
  expect(exportResponse.status()).toBe(403)
})

test('healthz returns ok', async ({ request }) => {
  const response = await request.get('/healthz')
  const body = await response.json()

  expect(response.ok()).toBeTruthy()
  expect(body.status).toBe('ok')
  expect(body.checks).toEqual({
    database: 'ok',
    uploads: 'ok',
    backups: 'ok',
  })
  expect(typeof body.uptime_seconds).toBe('number')
})
