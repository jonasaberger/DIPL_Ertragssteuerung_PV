import { postJson } from '../helper'

export async function verifyAdminPW(password: string): Promise<boolean> {
  try {
    const data = await postJson<{ success: boolean }>(
      '/devices/admin/verify_admin_pw',
      { password }
    )
    return Boolean(data && data.success === true)
  } catch (error) {
    console.error('Failed to verify admin password:', error)
    return false
  }
}